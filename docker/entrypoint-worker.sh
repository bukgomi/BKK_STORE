#!/bin/sh
# 워커 컨테이너: app 컨테이너가 node_modules 설치를 끝낼 때까지 기다린 뒤 BullMQ 워커 실행
set -e
cd /app
until [ -d node_modules/next ] && [ -f node_modules/.package-lock.stamp ] && [ -d node_modules/.prisma/client ]; do
  echo "[worker] app 컨테이너의 설치 완료 대기…"
  sleep 5
done
exec npx tsx scripts/worker.ts
