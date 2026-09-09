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
# 시작 시 스키마 반영 후 서버 실행 (migrations 도입 후에는 prisma migrate deploy 로 교체)
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p 3000"]
