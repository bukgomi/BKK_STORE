# DB 백업 · 복구 런북

운영 DB(PostgreSQL)는 **매일 새벽 자동 백업**하고, 백업 파일은 서버(7일)와 Cloudflare R2(30일)에 보관한다.
스크립트는 `scripts/backup/` 에 있다.

| 파일 | 역할 |
|---|---|
| `scripts/backup/pg-backup.sh` | `pg_dump -Fc` → `backups/fishing_mall_YYYYMMDD_HHMM.dump` 저장 → rclone 으로 R2 업로드 → 만료분 삭제 |
| `scripts/backup/pg-restore.sh` | dump 파일을 DB 에 `pg_restore --clean` 으로 복원 (DB 이름 입력 확인 필요) |

## 1. cron 등록 (서버에서 1회)

```bash
crontab -e
```

아래 한 줄을 추가한다 (매일 04:00, 로그는 `/var/log/bkk-backup.log`).

```
0 4 * * * cd /opt/bkk-store && ./scripts/backup/pg-backup.sh >> /var/log/bkk-backup.log 2>&1
```

로그 파일을 만들고 권한을 준다.

```bash
sudo touch /var/log/bkk-backup.log && sudo chown $USER /var/log/bkk-backup.log
```

수동 실행으로 먼저 확인한다.

```bash
cd /opt/bkk-store && ./scripts/backup/pg-backup.sh
ls -la backups/
```

## 2. rclone R2 리모트 설정

R2 는 S3 호환이라 rclone 의 `s3` 타입으로 붙인다. 키 값은 Cloudflare 대시보드 → R2 → "R2 API 토큰 관리" 에서 발급한다 (권한: 객체 읽기·쓰기, 대상 버킷 지정).

```bash
# rclone 설치 (Ubuntu)
sudo apt-get install -y rclone
mkdir -p ~/.config/rclone
```

`~/.config/rclone/rclone.conf` 에 아래를 넣는다 (파일 권한 600).

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <PLACEHOLDER: R2 Access Key ID>
secret_access_key = <PLACEHOLDER: R2 Secret Access Key>
endpoint = https://<PLACEHOLDER: R2 계정 ID>.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
```

```bash
chmod 600 ~/.config/rclone/rclone.conf
rclone lsd r2:            # 버킷 목록이 보이면 성공
```

`.env.production` 에 업로드 경로를 적는다. 이미지 버킷과 **다른 버킷**을 쓰는 것을 권장한다 (공개 버킷에 DB 덤프를 두지 않는다).

```
BACKUP_RCLONE_REMOTE="r2:<PLACEHOLDER: 백업 버킷명>/db-backups"
```

rclone 을 설치하지 않으면 스크립트가 `rclone/rclone` 도커 이미지를 대신 사용한다 (설정 파일 위치는 동일).

## 3. 복원 절차

```bash
cd /opt/bkk-store
# (선택) 최신 백업을 R2 에서 받기
rclone copy r2:<백업 버킷>/db-backups/fishing_mall_20260914_0400.dump backups/

# 앱·워커를 멈추고 복원 (DB 컨테이너는 그대로 둔다)
docker compose --env-file .env.production -f docker-compose.prod.yml stop app worker
./scripts/backup/pg-restore.sh backups/fishing_mall_20260914_0400.dump
#   → "계속하려면 데이터베이스 이름을 입력하세요" 에 .env.production 의 POSTGRES_DB 값을 그대로 입력
docker compose --env-file .env.production -f docker-compose.prod.yml start app worker
```

## 4. 복구 리허설 (별도 임시 Postgres 에 복원해 확인)

백업이 "있는 것" 과 "복원되는 것" 은 다르다. **운영 시작 후 첫 주 안에 1회, 이후 분기마다 1회** 아래 리허설을 한다.

```bash
cd /opt/bkk-store
LATEST=$(ls -t backups/fishing_mall_*.dump | head -1); echo "$LATEST"

# 1) 임시 Postgres 컨테이너 (운영과 무관, 포트 미공개)
docker run -d --name pg-rehearsal -e POSTGRES_PASSWORD=rehearsal -e POSTGRES_DB=rehearsal postgres:16-alpine
sleep 10

# 2) 복원
docker exec -i pg-rehearsal pg_restore -U postgres -d rehearsal --no-owner --no-privileges < "$LATEST"

# 3) 확인 — 회원/상품/주문 수가 운영과 비슷한지
docker exec pg-rehearsal psql -U postgres -d rehearsal -c 'SELECT count(*) AS users FROM "User";'
docker exec pg-rehearsal psql -U postgres -d rehearsal -c 'SELECT count(*) AS products FROM "Product";'
docker exec pg-rehearsal psql -U postgres -d rehearsal -c 'SELECT count(*) AS orders FROM "Order";'
docker exec pg-rehearsal psql -U postgres -d rehearsal -c 'SELECT max("createdAt") AS last_order FROM "Order";'

# 4) 정리
docker rm -f pg-rehearsal
```

숫자가 운영 관리자 화면과 맞고 `last_order` 가 백업 시각 직전이면 정상이다. 리허설 결과(날짜, 파일명, 건수)를 `docs/BACKUP-LOG.md` 같은 곳에 한 줄 남겨 둔다.

## 5. 문제가 생겼을 때

- 백업 로그에 `[backup] 실패` 가 찍히면: 디스크 용량(`df -h`), rclone 설정(`rclone lsd r2:`), db 컨테이너 상태(`npm run prod:ps`) 순으로 본다.
- 백업 파일이 비정상적으로 작으면(수 KB) DB 가 비어 있거나 권한 문제다. `pg_dump` 를 직접 실행해 에러를 본다.
- 실패 알림(슬랙/이메일)은 아직 연결되어 있지 않다. 주 1회 `tail /var/log/bkk-backup.log` 로 확인한다. (TODO)
