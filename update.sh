#!/bin/sh
# 낚시몰 로컬(Docker) 업데이트 — Mac/Linux:  ./update.sh
#  1) git pull  2) 컨테이너 재시작  3) 카테고리·관리자 시드 갱신
set -e
cd "$(dirname "$0")"

echo "[1/4] 최신 코드 받는 중..."
git pull --ff-only

echo "[2/4] 컨테이너 기동/재시작..."
docker compose up -d
docker compose restart app worker

echo "[3/4] 앱이 뜰 때까지 대기..."
for i in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)" = "200" ]; then break; fi
  [ "$i" = "60" ] && { echo "!! 3분 안에 앱이 뜨지 않았습니다. docker compose logs app 으로 확인하세요."; exit 1; }
  sleep 3
done

echo "[4/4] DB 시드 갱신 (카테고리 아이콘/관리자)..."
docker compose exec -T app npx tsx prisma/seed-categories.ts
docker compose exec -T app npx tsx prisma/seed-admin.ts

echo
echo "✔ 업데이트 완료 → http://localhost:3000  (관리자: http://localhost:3000/admin)"
