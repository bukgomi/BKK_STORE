# VPS 운영 배포 런북

이 문서는 **국내 VPS 1대(Ubuntu 22.04, 4GB RAM)** 에 탑캐스팅 쇼핑몰을 올리는 절차다. 명령을 위에서부터 그대로 실행하면 된다.
`<PLACEHOLDER>` 로 표시된 값은 본인 것으로 바꾼다.

구성: Caddy(HTTPS) → Next.js 앱, 백그라운드 워커, PostgreSQL, Redis — 전부 `docker-compose.prod.yml` 한 파일로 뜬다.

---

## 1. VPS 준비

- Ubuntu 22.04 LTS, RAM 4GB 이상, 디스크 50GB 이상, 공인 IP 1개
- 아래에서 서버 IP 를 `<SERVER_IP>` 로 적는다

### 1-1. 카페24 가상서버호스팅으로 샀을 때

- 신청 시 **OS: Ubuntu 22.04**, **설치사양: OS만 설치** 를 골라야 한다. "OS+APM" 을 고르면 Apache 가 80 포트를 차지해 Caddy 와 충돌한다.
- 서버 IP 와 **임시 root 비밀번호**는 카페24 → 나의서비스관리 → 가상서버호스팅 → 서버 정보에서 본다. SSH 키 등록 화면은 없으므로 첫 접속은 root 비밀번호로 하고, 2-2 에서 키를 넣은 뒤 비밀번호 로그인을 끈다.
- 카페24 콘솔에 방화벽 설정이 따로 있으면 22/80/443 만 허용으로 맞춘다 (없으면 서버 안 ufw 만으로 충분).
- 첫 접속 후 Apache 가 없는지 확인한다. 아무것도 안 나오면 정상이다.

```bash
systemctl status apache2 --no-pager 2>/dev/null | head -3
ss -tlnp | grep -E ':80 |:443 '
```

### 1-2. 내 PC 에서 SSH 키 만들기 (Windows PowerShell, 1회)

```powershell
ssh-keygen -t ed25519 -C "topcasting-deploy"      # 질문은 전부 Enter (비밀문구 없이)
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub    # 이 한 줄이 공개키 — 2-2 에서 서버에 넣는다
```

## 2. 최초 접속 후 보안 기본 설정

내 PC 에서 root 로 접속한다.

```bash
ssh root@<SERVER_IP>
```

### 2-1. 일반 사용자 만들기 + sudo

```bash
adduser deploy            # 비밀번호는 sudo 용으로만 쓴다 (길게)
usermod -aG sudo deploy
```

### 2-2. SSH 키 등록

내 PC 의 공개키(1-2 에서 출력된 `ssh-ed25519 AAAA... topcasting-deploy` 한 줄)를 서버의 deploy 사용자에 넣는다.

```bash
mkdir -p /home/deploy/.ssh
echo "<PLACEHOLDER: 공개키 한 줄>" >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

(업체 콘솔에서 이미 root 에 키를 넣었다면 `cp /root/.ssh/authorized_keys /home/deploy/.ssh/` 로 복사해도 된다.)

**다른 터미널을 하나 더 열어** `ssh deploy@<SERVER_IP>` 가 되는지 먼저 확인한다. 되면 계속한다.

### 2-3. 비밀번호 로그인 · root 접속 끄기

```bash
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication .*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart ssh
```

이후 작업은 모두 `deploy` 사용자로 한다. `exit` 후 `ssh deploy@<SERVER_IP>`.

### 2-4. 방화벽 (ufw): 22 / 80 / 443 만 허용

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable
sudo ufw status
```

> Docker 가 `ports:` 로 공개한 포트는 ufw 를 우회한다. 그래서 운영 compose 는 **db(5432)·redis(6379)·app(3000)을 아예 공개하지 않는다.** 방화벽이 아니라 compose 설정으로 막는 것이다.

### 2-5. 자동 보안 업데이트 + fail2ban

```bash
sudo apt-get update
sudo apt-get install -y unattended-upgrades fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades    # "Yes" 선택
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## 3. Docker 설치

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
exit
```

다시 접속(`ssh deploy@<SERVER_IP>`)한 뒤 확인한다.

```bash
docker --version && docker compose version
```

## 4. 코드 배치

```bash
sudo mkdir -p /opt/bkk-store && sudo chown deploy:deploy /opt/bkk-store
git clone https://github.com/bukgomi/BKK_STORE.git /opt/bkk-store
cd /opt/bkk-store
git checkout <PLACEHOLDER: 배포할 브랜치 또는 태그>
```

Node 는 서버에 설치하지 않아도 된다 (빌드·실행 모두 Docker 안에서 한다). `npm run prod:*` 스크립트를 쓰려면 아래처럼 node 만 가볍게 설치한다. 없으면 `package.json` 의 해당 `docker compose ...` 명령을 직접 친다.

```bash
sudo apt-get install -y nodejs npm
```

### 4-1. 운영 환경변수

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

반드시 채울 것:

| 키 | 값 |
|---|---|
| `PUBLIC_DOMAIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `ALLOWED_ORIGINS` | 실제 도메인 (`https://` 포함 여부는 예시 파일 그대로) |
| `ACME_EMAIL` | 인증서 만료 알림 이메일 |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `NEXTAUTH_SECRET`, `CRON_SECRET`, `NOTIFY_CRON_TOKEN` | `openssl rand -hex 24` 등으로 새로 생성 |
| `ENCRYPTION_KEY` | **로컬 `.env.docker` 의 값을 그대로 복사** (다르면 암호화된 회원정보를 못 읽는다. 완전히 새 DB 로 시작할 때만 새로 생성) |
| `S3_*`, `IMAGE_REMOTE_HOSTS` | Cloudflare R2 버킷·API 토큰·공개 주소 |
| `TOSS_*`, `INICIS_*`, `NAVERPAY_*` | PG 운영 키 (테스트 기간엔 테스트 키) |
| `ADMIN_EMAILS`, `ADMIN_PASSWORD` | 최초 관리자 (시드 후 제거) |
| `BACKUP_RCLONE_REMOTE` | 백업 업로드 경로 (docs/BACKUP.md) |

## 5. 가비아 DNS

가비아 → My가비아 → 도메인 관리 → DNS 설정에서:

| 타입 | 호스트 | 값 | TTL |
|---|---|---|---|
| A | `@` | `<SERVER_IP>` | 300 |
| A | `www` | `<SERVER_IP>` | 300 |

- **전환 전날** TTL 을 300 으로 미리 낮춰 둔다 (기본 3600 이면 변경 반영에 1시간 걸린다).
- 반영 확인: 내 PC 에서 `nslookup <도메인>` 결과가 `<SERVER_IP>` 이면 된다.
- 인증서(Let's Encrypt)는 DNS 가 서버를 가리켜야 발급되므로, DNS 반영 후에 6번을 실행한다.

## 6. 기동

```bash
cd /opt/bkk-store
npm run prod:up          # 이미지 빌드(첫 회 5~10분) + 전체 기동
npm run prod:logs        # Ctrl+C 로 빠져나온다
```

로그에서 확인할 것:

- `app` : `No pending migrations` 또는 `Applying migration ...` → `Ready`
- `caddy` : `certificate obtained successfully` (도메인 인증서 발급)
- `worker` : 에러 없이 대기

```bash
npm run prod:ps          # 모든 서비스가 running / healthy
```

## 7. 최초 관리자 시드

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npx tsx prisma/seed-admin.ts
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npx tsx prisma/seed-categories.ts
```

`https://<도메인>/admin` 에 `ADMIN_EMAILS` / `ADMIN_PASSWORD` 로 로그인 → 관리자 > 보안에서 비밀번호를 바꾼다.
그 다음 `.env.production` 에서 `ADMIN_PASSWORD` 줄을 지우거나 비운다 (다음 재시작부터 시드가 비밀번호를 만지지 않는다).

## 8. 백업 cron 등록

[docs/BACKUP.md](BACKUP.md) 의 1·2번을 따라 rclone 리모트를 만들고 cron 을 등록한다. 등록 후 한 번 수동 실행해 `backups/` 와 R2 에 파일이 생기는지 본다.

## 9. 업데이트(배포) 절차

```bash
cd /opt/bkk-store
git pull
npm run prod:up          # 바뀐 코드로 이미지를 다시 빌드하고 app/worker 만 교체 (db/redis 는 그대로)
npm run prod:logs
```

문제가 생기면 이전 커밋으로 되돌린다.

```bash
git log --oneline -5              # 직전 커밋 해시 확인
git checkout <sha>
npm run prod:up
```

> 마이그레이션이 포함된 배포를 되돌릴 때는 DB 스키마는 되돌아가지 않는다. 배포 직전 `./scripts/backup/pg-backup.sh` 를 한 번 돌려 두는 습관을 들인다.

## 10. 점검 체크리스트

- [ ] `https://<도메인>` 접속, 주소창 자물쇠 정상, `http://` 와 `www.` 가 `https://<도메인>` 으로 넘어간다
- [ ] 회원가입 → 로그인 → 상품 담기 → 결제 테스트 (PG 테스트 모드) → 관리자 주문 목록에 보인다
- [ ] `npm run prod:ps` 전 서비스 `running` / `healthy`
- [ ] 서버 재부팅(`sudo reboot`) 후 1~2분 뒤 사이트가 다시 뜬다 (`restart: unless-stopped`)
- [ ] 외부(내 PC)에서 `nc -zv <SERVER_IP> 5432` 와 `nc -zv <SERVER_IP> 6379` 가 **실패**한다 (연결되면 안 된다)
- [ ] `nc -zv <SERVER_IP> 3000` 도 실패한다
- [ ] 백업 cron 실행 후 `backups/` 와 R2 `db-backups/` 에 파일이 생긴다
- [ ] `docs/BACKUP.md` 4번 복구 리허설을 첫 주 안에 1회 수행했다

## 11. 자주 쓰는 명령

```bash
npm run prod:ps                                   # 상태
npm run prod:logs                                 # 로그
docker compose --env-file .env.production -f docker-compose.prod.yml restart app     # 앱만 재시작
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npx prisma migrate status
docker system df && docker image prune -f         # 디스크 정리 (오래된 이미지)
```
