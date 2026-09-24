import { Queue, Worker, QueueEvents, UnrecoverableError, type Processor, type ConnectionOptions } from "bullmq";
import { getRedis, isRedisAvailable } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * 백그라운드 작업 큐 (BullMQ + Redis)
 *
 * 특징
 *  - Redis 사용시: 분산 큐 (지수 백오프 재시도, persistent)
 *  - Redis 미설정시: 인메모리 폴백 (단일 인스턴스, dev 편의)
 *
 * 등록 가능한 작업 타입은 JOBS 상수에 정의 (worker 가 처리)
 */

export const JOBS = {
  ALIMTALK_SEND: "alimtalk-send",
  SMS_SEND:      "sms-send",
  EMAIL_SEND:    "email-send",
  STOCK_NOTIFY:  "stock-notify",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

const QUEUE_NAME = "fishing-mall";
const DEFAULT_RETRY = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 },  // 1일 보존, 최대 1000건
  removeOnFail: { count: 1000, age: 7 * 24 * 60 * 60 },  // 7일 보존
};

/* ─────────────────────────────────────────────
   BullMQ Queue (생산자)
   ───────────────────────────────────────────── */
let _queue: Queue | null = null;

function getQueue(): Queue | null {
  if (_queue) return _queue;
  const redis = getRedis();
  if (!redis) return null;
  _queue = new Queue(QUEUE_NAME, { connection: redis as unknown as ConnectionOptions });
  return _queue;
}

/* ─────────────────────────────────────────────
   인메모리 폴백 (Redis 없을때 dev 편의)
   ───────────────────────────────────────────── */
type MemHandler = (data: any) => Promise<void>;
const memHandlers = new Map<string, MemHandler>();
const memQueue: Array<{ name: string; data: any; attempts: number }> = [];
let memRunning = false;

async function memRunLoop() {
  if (memRunning) return;
  memRunning = true;
  try {
    while (memQueue.length > 0) {
      const job = memQueue.shift()!;
      const handler = memHandlers.get(job.name);
      if (!handler) {
        logger.warn("queue.no_handler_mem", { jobName: job.name });
        continue;
      }
      try {
        await handler(job.data);
      } catch (e: any) {
        const attempts = job.attempts + 1;
        if (attempts < 5) {
          const delay = 5000 * Math.pow(2, attempts - 1);
          logger.warn("queue.retry_mem", { jobName: job.name, attempts, delay, error: e.message });
          setTimeout(() => { memQueue.push({ ...job, attempts }); void memRunLoop(); }, delay);
        } else {
          logger.error("queue.failed_mem", { jobName: job.name, attempts, error: e.message });
        }
      }
    }
  } finally { memRunning = false; }
}

/* ─────────────────────────────────────────────
   Public API
   ───────────────────────────────────────────── */

/**
 * 작업 큐에 추가
 * - Redis 있으면 BullMQ
 * - 없으면 인메모리 큐
 */
export async function enqueue<T = any>(name: JobName | string, data: T, opts?: {
  attempts?: number;
  delayMs?: number;        // 처리 지연 시작
  backoffMs?: number;      // 첫 백오프
  jobId?: string;          // 멱등성 (같은 jobId 중복 enqueue 방지)
}): Promise<void> {
  const q = getQueue();
  if (q) {
    await q.add(name, data as any, {
      ...DEFAULT_RETRY,
      attempts: opts?.attempts ?? DEFAULT_RETRY.attempts,
      delay: opts?.delayMs,
      backoff: opts?.backoffMs ? { type: "exponential", delay: opts.backoffMs } : DEFAULT_RETRY.backoff,
      jobId: opts?.jobId,
    });
    return;
  }
  // 인메모리 폴백 (지연 무시, 즉시 처리)
  memQueue.push({ name, data, attempts: 0 });
  void memRunLoop();
}

/**
 * 워커 등록 — 큐 작업이 들어오면 호출됨
 * - 본 함수는 worker 프로세스에서만 호출 (next.js 서버는 호출 X)
 * - Redis 없을때는 인메모리 핸들러로 등록
 */
const _activeWorkers: Worker[] = [];
// 잡 이름 → 핸들러. BullMQ 는 job.name 으로 워커를 고르지 않으므로(아무 워커나 잡을 집어감) 큐당 Worker 는 하나만 두고 여기서 분기한다
const _handlers = new Map<string, Processor<any, any>>();

export function registerWorker(name: JobName | string, processor: Processor<any, any>): void {
  if (isRedisAvailable()) {
    _handlers.set(name, processor);
    if (_activeWorkers.length === 0) {
      const worker = new Worker(QUEUE_NAME, async (job) => {
        const handler = _handlers.get(job.name);
        // 핸들러 없는 잡은 재시도해도 소용없음 → 즉시 실패 처리 (조용히 completed 되지 않게)
        if (!handler) throw new UnrecoverableError(`no handler for job "${job.name}"`);
        return handler(job, job.token!);
      }, {
        connection: getRedis() as unknown as ConnectionOptions,
        concurrency: 5,
      });

      worker.on("completed", (job) => {
        logger.debug("queue.completed", { name: job.name, id: job.id });
      });
      worker.on("failed", (job, err) => {
        logger.error("queue.failed", { name: job?.name, id: job?.id, attempts: job?.attemptsMade, error: err.message });
      });

      _activeWorkers.push(worker);
    }
    logger.info("queue.worker_started", { name });
  } else {
    memHandlers.set(name, async (data) => { await processor({ name, data } as any, "" as any); });
    logger.info("queue.worker_started_mem", { name });
  }
}

/**
 * 모든 워커 정리 (graceful shutdown)
 */
export async function shutdownWorkers(): Promise<void> {
  for (const w of _activeWorkers) {
    await w.close().catch(() => {});
  }
  _activeWorkers.length = 0;
  if (_queue) {
    await _queue.close().catch(() => {});
    _queue = null;
  }
}

/* ─────────────────────────────────────────────
   대시보드용 통계
   ───────────────────────────────────────────── */
export async function queueStats() {
  const q = getQueue();
  if (!q) {
    return {
      backend: "memory" as const,
      pending: memQueue.length,
      handlers: Array.from(memHandlers.keys()),
    };
  }
  const counts = await q.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
  return {
    backend: "redis" as const,
    waiting:    counts.waiting    || 0,
    active:     counts.active     || 0,
    completed:  counts.completed  || 0,
    failed:     counts.failed     || 0,
    delayed:    counts.delayed    || 0,
    paused:     counts.paused     || 0,
  };
}

/** 실패한 작업 목록 (관리자 조회용) */
export async function getFailedJobs(limit = 20) {
  const q = getQueue();
  if (!q) return [];
  const jobs = await q.getJobs(["failed"], 0, limit - 1, false);
  return jobs.map((j) => ({
    id: j.id,
    name: j.name,
    failedReason: j.failedReason,
    attemptsMade: j.attemptsMade,
    timestamp: j.timestamp,
    finishedOn: j.finishedOn,
    data: j.data,
  }));
}

/** 실패한 작업 재시도 */
export async function retryFailedJob(jobId: string): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  const job = await q.getJob(jobId);
  if (!job) return false;
  await job.retry();
  return true;
}

/**
 * 호환성 유지용 (기존 코드가 사용)
 * @deprecated enqueue() 직접 사용 권장
 */
export function registerHandler(name: string, handler: (data: any) => Promise<void>): void {
  registerWorker(name as JobName, async (job) => { await handler(job.data); });
}
