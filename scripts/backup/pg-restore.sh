#!/usr/bin/env bash
# PostgreSQL 복원: dump 파일을 운영 compose 의 db 컨테이너에 pg_restore --clean 으로 덮어쓴다
#
#   ./scripts/backup/pg-restore.sh backups/fishing_mall_20260914_0400.dump          # 운영
#   ./scripts/backup/pg-restore.sh --dev backups/fishing_mall_20260914_0400.dump    # 개발 compose 대상 (리허설)
#
# 실행 전 "데이터베이스 이름" 을 그대로 입력해야 진행된다 (오타 방지용 확인).
# 복원 중에는 앱을 멈추는 것이 안전하다:  npm run prod:down 대신  docker compose ... stop app worker
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE=prod
DUMP=""
for arg in "$@"; do
  case "$arg" in
    --dev) MODE=dev ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) DUMP="$arg" ;;
  esac
done
[ -n "$DUMP" ] || { echo "사용법: $0 [--dev] <dump 파일>" >&2; exit 2; }
[ -f "$DUMP" ] || { echo "[restore] 파일이 없습니다: $DUMP" >&2; exit 1; }

envget() {
  local v
  v="$(grep -E "^${2}=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"
  printf '%s' "$v"
}

if [ "$MODE" = "prod" ]; then
  ENV_FILE=".env.production"
  [ -f "$ENV_FILE" ] || { echo "[restore] $ENV_FILE 이 없습니다" >&2; exit 1; }
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
  PGUSER="$(envget "$ENV_FILE" POSTGRES_USER)"
  PGDB="$(envget "$ENV_FILE" POSTGRES_DB)"
else
  COMPOSE=(docker compose -f docker-compose.yml)
  PGUSER="fishing"
  PGDB="fishing_mall"
fi

echo "!! 운영 DB(${PGDB}, ${MODE})를 '${DUMP}' 내용으로 덮어씁니다. 기존 데이터는 사라집니다."
printf "계속하려면 데이터베이스 이름을 입력하세요 [%s]: " "$PGDB"
read -r CONFIRM
[ "$CONFIRM" = "$PGDB" ] || { echo "[restore] 이름이 일치하지 않아 중단합니다" >&2; exit 1; }

echo "[restore] $(date "+%F %T") pg_restore → ${PGDB}"
# --clean --if-exists: 기존 객체를 지우고 다시 만든다. --no-owner/--no-privileges: 덤프의 소유자/권한 무시
"${COMPOSE[@]}" exec -T db pg_restore -U "$PGUSER" -d "$PGDB" --clean --if-exists --no-owner --no-privileges --exit-on-error < "$DUMP"
echo "[restore] 완료 $(date "+%F %T")"
echo "[restore] 확인:  ${COMPOSE[*]} exec db psql -U $PGUSER -d $PGDB -c 'SELECT count(*) FROM \"User\";'"
