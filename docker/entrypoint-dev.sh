#!/bin/sh
# 앱 컨테이너 시작 스크립트 (개발 모드)
# 1) 의존성 설치 (node_modules 볼륨이 비어 있거나 package-lock 이 바뀐 경우)
# 2) Prisma client 생성 + 스키마 반영 (db push — migrations 폴더 도입 전까지)
# 3) 최초 1회 시드: 관리자 계정 + 카테고리 (+ SEED_SAMPLE=true 면 샘플 상품)
# 4) next dev
set -e
cd /app

STAMP=node_modules/.package-lock.stamp
if [ ! -d node_modules/next ] || [ ! -f "$STAMP" ] || ! cmp -s package-lock.json "$STAMP"; then
  echo "[app] npm ci (의존성 설치 — 처음엔 1~3분 걸립니다)"
  npm ci --no-audit --no-fund --legacy-peer-deps
  cp package-lock.json "$STAMP"
fi

echo "[app] prisma generate + db push"
npx prisma generate >/dev/null
npx prisma db push --skip-generate

if [ ! -f node_modules/.seeded ]; then
  echo "[app] 최초 시드: 관리자 계정 + 카테고리"
  npx tsx prisma/seed-admin.ts
  npx tsx prisma/seed-categories.ts
  if [ "$SEED_SAMPLE" = "true" ]; then
    echo "[app] 샘플 상품 시드 (SEED_SAMPLE=true)"
    npx tsx prisma/seed-fresh.ts
  fi
  touch node_modules/.seeded
fi

echo "[app] next dev → http://localhost:3000"
exec npx next dev -H 0.0.0.0 -p 3000
