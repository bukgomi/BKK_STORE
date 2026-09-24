# 운영용 이미지 (Vercel 대신 직접 서버/컨테이너 호스팅에 올릴 때)
#
#   docker build -t fishing-mall .
#   docker run --env-file .env.production -p 3000:3000 fishing-mall
#   워커:  docker run --env-file .env.production fishing-mall npm run worker
#
# 로컬 개발은 docker-compose.yml (next dev + bind mount) 을 사용한다.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --legacy-peer-deps && npx prisma generate

FROM node:22-bookworm-slim AS builder
WORKDIR /app
# 브라우저 번들에 인라인되는 NEXT_PUBLIC_* 는 "빌드 시점" 값이 굳는다 → compose build.args 로 전달 (값을 바꾸면 재빌드)
ARG NEXT_PUBLIC_TOSS_CLIENT_KEY
ARG NEXT_PUBLIC_INICIS_ENV=production
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_DSN
ENV NEXT_PUBLIC_TOSS_CLIENT_KEY=$NEXT_PUBLIC_TOSS_CLIENT_KEY \
    NEXT_PUBLIC_INICIS_ENV=$NEXT_PUBLIC_INICIS_ENV \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    SENTRY_DSN=$SENTRY_DSN
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 빌드 시점엔 DB 접속이 없어도 되도록 더미 URL (정적 프리렌더 페이지는 런타임에 다시 조회)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json package-lock.json next.config.js ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json ./
EXPOSE 3000
# 시작 시 미적용 마이그레이션만 적용(prisma migrate deploy) 후 서버 실행.
# 스키마 강제 동기화(prisma의 push 명령)는 컬럼 삭제·재생성으로 운영 데이터를 잃을 수 있어 운영 경로에서 쓰지 않는다.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
