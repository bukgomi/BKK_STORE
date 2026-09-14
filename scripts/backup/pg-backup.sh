#!/usr/bin/env bash
# PostgreSQL 백업: 운영 compose 의 db 컨테이너에서 pg_dump(-Fc) → backups/ 저장 → rclone 으로 R2 업로드
#
#   ./scripts/backup/pg-backup.sh                 # 운영 (.env.production + docker-compose.prod.yml)
#   ./scripts/backup/pg-backup.sh --no-upload     # 로컬 파일만 남기고 R2 업로드 생략
#   ./scripts/backup/pg-backup.sh --dev           # 개발 compose(docker-compose.yml, fishing/fishing_mall) 대상 — 리허설용
#
# 보관: 로컬 7일, R2 30일. 실패하면 0 이 아닌 종료 코드와 stderr 메시지.
# cron 예시(매일 04:00): 0 4 * * * cd /opt/bkk-store && ./scripts/backup/pg-backup.sh >> /var/log/bkk-backup.log 2>&1
#
# 필요한 환경변수(.env.production): POSTGRES_USER, POSTGRES_DB, BACKUP_RCLONE_REMOTE (예: r2:bkk-backups/db-backups)
# rclone 리모트 설정 방법은 docs/BACKUP.md 참고.
#
# TODO: 실패 알림(슬랙/이메일) 연동 — 이번 범위 밖

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

UPLOAD=1
MODE=prod
for arg in "$@"; do
  case "$arg" in
    --no-upload) UPLOAD=0 ;;
    --dev) MODE=dev ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 2 ;;
  esac
done

# .env 파일에서 KEY="value" / KEY=value 한 줄 읽기 (셸 source 는 쓰지 않는다 — 특수문자 안전)
envget() { # envget FILE KEY
  local v
  v="$(grep -E "^${2}=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"
  printf '%s' "$v"
}

if [ "$MODE" = "prod" ]; then
  ENV_FILE=".env.production"
  [ -f "$ENV_FILE" ] || { echo "[backup] $ENV_FILE 이 없습니다" >&2; exit 1; }
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
  PGUSER="$(envget "$ENV_FILE" POSTGRES_USER)"
  PGDB="$(envget "$ENV_FILE" POSTGRES_DB)"
  REMOTE="${BACKUP_RCLONE_REMOTE:-$(envget "$ENV_FILE" BACKUP_RCLONE_REMOTE)}"
else
  COMPOSE=(docker compose -f docker-compose.yml)
  PGUSER="fishing"
  PGDB="fishing_mall"
  REMOTE="${BACKUP_RCLONE_REMOTE:-}"
fi
[ -n "$PGUSER" ] && [ -n "$PGDB" ] || { echo "[backup] POSTGRES_USER / POSTGRES_DB 를 읽지 못했습니다" >&2; exit 1; }

BACKUP_DIR="$ROOT/backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M)"
FILE="$BACKUP_DIR/fishing_mall_${STAMP}.dump"
TMP="$FILE.part"

trap 'rc=$?; if [ $rc -ne 0 ]; then echo "[backup] 실패 (exit $rc) — $(date "+%F %T")" >&2; rm -f "$TMP"; fi' EXIT

echo "[backup] $(date "+%F %T") pg_dump ${PGDB} (${MODE}) → $FILE"
"${COMPOSE[@]}" exec -T db pg_dump -U "$PGUSER" -d "$PGDB" -Fc --no-owner --no-privileges > "$TMP"
SIZE=$(stat -c %s "$TMP" 2>/dev/null || stat -f %z "$TMP")
[ "$SIZE" -gt 1024 ] || { echo "[backup] dump 파일이 비정상적으로 작습니다 (${SIZE} bytes)" >&2; exit 1; }
mv "$TMP" "$FILE"
echo "[backup] 저장 완료 $(( SIZE / 1024 )) KB"

# 로컬 보관 7일
find "$BACKUP_DIR" -name 'fishing_mall_*.dump' -type f -mtime +7 -print -delete | sed 's/^/[backup] 로컬 만료 삭제: /' || true

if [ "$UPLOAD" -eq 1 ]; then
  [ -n "$REMOTE" ] || { echo "[backup] BACKUP_RCLONE_REMOTE 가 비어 있어 업로드할 수 없습니다 (--no-upload 로 생략 가능)" >&2; exit 1; }
  if command -v rclone >/dev/null 2>&1; then
    RCLONE=(rclone)
    SRC="$FILE"
    DST="$REMOTE"
  else
    # rclone 미설치 시 도커 이미지 사용 (호스트의 ~/.config/rclone/rclone.conf 를 그대로 마운트)
    RCLONE=(docker run --rm -v "$HOME/.config/rclone:/config/rclone:ro" -v "$BACKUP_DIR:/data:ro" rclone/rclone)
    SRC="/data/$(basename "$FILE")"
    DST="$REMOTE"
  fi
  echo "[backup] R2 업로드 → $DST"
  "${RCLONE[@]}" copy "$SRC" "$DST" --s3-no-check-bucket
  # 원격 보관 30일
  "${RCLONE[@]}" delete "$DST" --min-age 30d --include 'fishing_mall_*.dump' || echo "[backup] 원격 만료 정리 실패(무시)" >&2
  echo "[backup] 업로드 완료"
else
  echo "[backup] 업로드 생략 (--no-upload)"
fi

echo "[backup] 완료 $(date "+%F %T")"
