# 낚시몰 (Fishing Mall)

Next.js 14 + TypeScript + PostgreSQL(Prisma) + TailwindCSS 기반의 한국형 낚시용품 쇼핑몰 보일러플레이트입니다.

## 주요 기능

- 상품 카탈로그 (카테고리/검색/정렬/페이지네이션)
- 상품 상세, 장바구니 (Zustand + localStorage 영속화)
- 회원가입 / 로그인 (NextAuth Credentials)
- 주문/결제 플로우 (3사 PG 연동)
  - 토스페이먼츠 (TossPayments)
  - KG이니시스 (INIStdPay)
  - 네이버페이 (NaverPay v2)
- 마이페이지 - 주문 내역 조회
- 관리자 시드 데이터: 카테고리 자동 생성 + 샘플 상품 300개

## 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS
- **Backend**: Next.js Route Handlers
- **DB / ORM**: PostgreSQL + Prisma
- **Auth**: NextAuth (Credentials Provider)
- **State**: Zustand (장바구니)
- **Validation**: Zod

## 빠른 시작 (Docker — 권장)

Docker Desktop 만 있으면 DB·Redis·앱·워커가 한 번에 뜹니다. 상품 등록·배너·공지 등 운영 준비를 로컬에서 끝낸 뒤 DB 만 운영으로 옮기는 흐름을 전제로 합니다.

```bash
cp .env.docker.example .env.docker   # 관리자 이메일/비밀번호, (선택) R2 키 입력
npm run docker:up                    # 첫 실행: 의존성 설치 → 스키마 반영 → 관리자·카테고리 시드 → next dev
```
- 쇼핑몰: http://localhost:3000 · 관리자: http://localhost:3000/admin — 기본 계정 **admin / admin** (`.env.docker` 의 `ADMIN_EMAILS` 앞부분 / `ADMIN_PASSWORD`)
- 이미 만든 관리자 비밀번호를 바꾸려면 `.env.docker` 에 `ADMIN_RESET_PASSWORD="true"` 넣고 `docker compose exec app npx tsx prisma/seed-admin.ts`
- 로그: `npm run docker:logs` · 중지: `npm run docker:down` · 전부 초기화: `npm run docker:reset`
- 코드 수정은 즉시 반영됩니다. `SEED_SAMPLE=true` 를 `.env.docker` 에 넣으면 샘플 상품도 들어갑니다.

**이미지 저장 위치**: `.env.docker` 의 `STORAGE_PROVIDER` 를 처음부터 `s3`(Cloudflare R2) 로 두면 로컬에서 올린 사진이 이미 클라우드에 있어 운영 이전 시 DB 만 옮기면 됩니다. `local` 이면 `public/uploads` 볼륨에 저장되므로 이전 시 이미지 업로드 + URL 치환이 추가로 필요합니다.

### 로컬에서 운영으로 옮기기
```bash
npm run docker:db:dump                       # ./fishing_mall.dump 생성 (pg_dump custom 포맷)
pg_restore --no-owner --no-privileges -d "$NEON_DATABASE_URL" fishing_mall.dump   # Neon 등 운영 DB 로 복원
```
그 뒤 Vercel(또는 `Dockerfile` 로 빌드한 컨테이너)에 같은 `ENCRYPTION_KEY` · `NEXTAUTH_SECRET` 과 운영 PG 키를 넣고 배포합니다. `ENCRYPTION_KEY` 가 다르면 암호화된 휴대폰번호 등을 읽을 수 없으니 로컬에서 쓴 값을 그대로 가져가세요.

## 빠른 시작 (Docker 없이)

### 1. 의존성 설치
```bash
npm install
```

### 2. PostgreSQL 준비
로컬 PostgreSQL 또는 Supabase / Neon / Railway 등 클라우드 DB 사용 가능.

### 3. 환경변수 설정
`.env.example` 을 `.env` 로 복사 후 값 입력:
```bash
cp .env.example .env
```

필수 항목:
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `NEXTAUTH_SECRET` - `openssl rand -base64 32` 으로 생성
- `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` - 토스페이먼츠 키
- `INICIS_MID`, `INICIS_SIGN_KEY` - KG이니시스 키
- `NAVERPAY_CLIENT_ID`, `NAVERPAY_CLIENT_SECRET`, `NAVERPAY_CHAIN_ID` - 네이버페이 키

### 4. DB 마이그레이션 + 시드
```bash
npm run db:push      # 스키마 적용
npm run db:seed      # 카테고리 + 샘플 상품 300개 생성
```

### 5. 개발 서버 실행
```bash
npm run dev
```
http://localhost:3000 접속

## 프로젝트 구조

```
fishing-mall/
├── prisma/
│   ├── schema.prisma          # DB 스키마 (User, Category, Product, Order, ...)
│   └── seed.ts                # 샘플 데이터 시드
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 루트 레이아웃 (헤더/푸터/세션)
│   │   ├── page.tsx           # 홈 (히어로 + 추천 + 신상품)
│   │   ├── products/
│   │   │   ├── page.tsx       # 상품 목록 (검색/필터/정렬)
│   │   │   └── [id]/page.tsx  # 상품 상세
│   │   ├── cart/page.tsx      # 장바구니
│   │   ├── checkout/page.tsx  # 주문/결제
│   │   ├── login, register, mypage
│   │   └── api/
│   │       ├── auth/...       # NextAuth
│   │       ├── orders/        # 주문 생성
│   │       └── payments/      # PG 콜백
│   │           ├── toss/confirm/
│   │           ├── inicis/prepare, return/
│   │           └── naver/reserve, return/
│   ├── components/            # Header, Footer, ProductCard, ...
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   └── payments/toss-client.ts
│   └── store/cart.ts          # Zustand 장바구니 스토어
└── public/images/
```

## 결제 흐름 요약

1. 사용자가 `/checkout` 에서 주소/결제수단 입력 후 [결제하기] 클릭
2. `POST /api/orders` → DB에 `Order` 를 `PENDING` 상태로 생성 (서버에서 금액 재계산)
3. 선택한 PG에 따라 분기:
   - **토스**: 클라이언트에서 SDK 로 결제창 호출 → `/api/payments/toss/confirm` 에서 시크릿키로 승인
   - **이니시스**: `/api/payments/inicis/prepare` 로 서명 생성 → INIStdPay 결제창 → `/api/payments/inicis/return` 에서 승인 API 호출
   - **네이버페이**: `/api/payments/naver/reserve` 로 예약 → 결제창 → `/api/payments/naver/return` 에서 승인
4. 승인 성공시: 주문 상태 `PAID`, 재고 차감, `/checkout/success` 로 리다이렉트
5. 실패시: `/checkout/fail` 로 이동, 망취소 처리

### 보안 체크리스트

- [x] 결제금액 서버측 재계산 (클라이언트 금액 신뢰 X)
- [x] PG 콜백시 DB 주문번호 + 금액 일치 검증
- [x] 트랜잭션으로 주문 상태 + 재고 차감 원자 처리
- [ ] (운영시) HTTPS 필수
- [ ] (운영시) PG webhook 별도 등록하여 중복 검증 권장
- [ ] (운영시) `INIStdPay.js` 스크립트는 운영 도메인 등록 후 head 에 로드

## 토스페이먼츠 테스트

테스트 클라이언트키를 `.env` 에:
```
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm
TOSS_SECRET_KEY=test_sk_docs_OaPz8L5KdmQXkzRz3y47BMw6
```
테스트 카드 번호는 토스 공식 문서 참고.

## 이니시스 테스트

테스트 MID/SignKey 는 이미 `.env.example` 에 들어있습니다 (이니시스 공개 테스트 계정).
실제 운영시 가맹점 계약 후 발급받은 키로 교체하세요.

운영용 결제창 호출을 위해서는 `/_document` 또는 `app/layout.tsx`의 `<head>` 에 다음 스크립트를 추가하세요:
```html
<script src="https://stdpay.inicis.com/stdjs/INIStdPay.js"></script>
```

## 네이버페이

- 개발자센터 가입 후 가맹점 등록 → `chainId`, `clientId`, `clientSecret` 발급
- 테스트는 `dev-pub.apis.naver.com` 도메인 사용 (코드에 반영됨)
- 운영 전환시 도메인을 `apis.naver.com` 으로 교체

## 부가 기능 (구현 완료)

### 다음 우편번호 검색
- `src/components/AddressSearch.tsx` 컴포넌트
- 카카오(다음) Postcode API — 무료, 키 발급 불필요
- 체크아웃 페이지에서 자동 우편번호 + 도로명 주소 채움

### 택배 추적 (스마트택배 / SweetTracker)
- `src/lib/tracker.ts`, `/api/tracking?courier=...&invoice=...`
- 관리자 주문 상세에서 자동 조회 + 새로고침
- 고객 페이지 `/orders/[orderNo]/tracking` 에서도 조회
- API 키: https://info.sweettracker.co.kr/apikey 에서 발급 → `.env`의 `SWEETTRACKER_API_KEY`

### 상품 일괄 등록 (엑셀 / CSV)
- `/admin/products/bulk`
- **엑셀(.xlsx)** 과 **CSV** 양쪽 모두 지원
- **3-시트 엑셀 템플릿** 다운로드: 안내 / 상품등록 / 카테고리목록
- 한글 컬럼 헤더(상품명, 판매가 등) 또는 영문 키(name, price 등) **모두 인식**
- SKU(상품코드)가 이미 있으면 자동 수정, 없으면 신규 등록
- 행별 검증 → 미리보기에서 신규/수정/오류 색상 구분 → 일괄 처리
- 검증 실패행만 모아서 별도 엑셀로 다운로드 가능 (수정 후 재업로드)
- 한 번에 최대 2,000행 처리

### 매출 대시보드 (Recharts)
- `/admin` 페이지 상단에 최근 30일 일별 매출(라인) + 주문수(바) 차트
- 재고 부족 위젯 동시 표시

### 재고 부족 알림 (이메일 + Slack)
- 글로벌 임계치(`LOW_STOCK_THRESHOLD`) 또는 상품별 개별 임계치
- 결제 완료 후 임계치 도달시 자동 알림 (비동기)
- `/admin/stock` 에서 수동 일괄 알림 가능
- Cron으로 호출하려면: `POST /api/admin/stock/check`, 헤더 `x-cron-token: ${NOTIFY_CRON_TOKEN}`

## 운영 환경 추가 환경변수

```bash
# 스마트택배
SWEETTRACKER_API_KEY=

# 재고 알림
LOW_STOCK_THRESHOLD=10
ADMIN_NOTIFY_EMAIL=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...     # Gmail은 앱 비밀번호 사용
SMTP_FROM="낚시몰 <noreply@example.com>"

# Slack (선택)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Cron 호출용 토큰
NOTIFY_CRON_TOKEN=random-32-byte-string
```

## 회원 기능 (v3 추가)

### 상품 옵션 (색상별 재고 / 수량 조절)
- `ProductVariant` 모델 — 옵션별 재고/추가금/색상칩
- 상품 상세에서 다중 색상 선택 → 색상별 수량 조절 → 장바구니 (각 옵션 독립)
- 옵션이 1개 이상이면 옵션 재고로, 없으면 상품 재고로 판매
- 결제 완료시 옵션별로 재고 차감
- 관리자 상품 폼에 인라인 옵션 편집기 (색상 피커 포함)

### 쿠폰 시스템
- 정액(원) / 정률(%) 쿠폰, 최소주문액, 최대할인 상한, 발급수량 제한
- 회원이 코드로 등록 (`/mypage/coupons`) → 결제시 선택 사용
- 관리자가 쿠폰 생성/수정 (`/admin/coupons`)
- 결제완료 시점에 쿠폰 사용 마킹 + 발급/사용 카운트 증가

### 적립금
- 가입시 1,000원 자동 지급
- 결제 완료시 결제금액의 1% 자동 적립 (1년 유효)
- 마이페이지에서 보유 적립금 + 이력 조회 (`/mypage/points`)
- 결제시 1원 단위로 사용

### 위시리스트
- 상품 상세에서 ❤ 버튼으로 토글
- `/mypage/wishlist` 에서 한눈에 관리

### 리뷰 / 평점 (구매 인증)
- DELIVERED 상태 주문에서만 작성 가능
- `orderItemId` 기반 1주문상품 1리뷰 — 중복 작성 방지
- 작성자 이름 마스킹 (홍길동 → 홍*동) 노출
- 평균 평점 + 리뷰 갯수 상품 상세에 표시
- 관리자가 부적절한 리뷰 숨김 처리 (`/admin/reviews`)

## 보안 강화

| 영역 | 적용 내용 |
|------|----------|
| 비밀번호 정책 | 12자 이상 + 대/소/숫/특수문자 중 3종 이상, bcrypt cost 12, 약한 비번 거부 |
| 비밀번호 변경 | `/mypage/security` 에서 현재 비밀번호 검증 후 변경 |
| 로그인 시도 제한 | 동일 이메일 5회 / IP 20회 / 10분 (DB 기반 카운트) |
| 로그인 이력 | 모든 시도 기록 (성공/실패/IP/User-Agent) — 마이페이지에서 조회 |
| 세션 보안 | HttpOnly + SameSite=Lax + Secure (운영) + 7일 만료 + JWT |
| 보안 헤더 | CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS |
| CSRF | NextAuth 자동 보호 |
| SQL Injection | Prisma 파라미터 바인딩으로 차단 |
| XSS | React 자동 escape + `dangerouslySetInnerHTML` 미사용 |
| 결제 위변조 | DB 금액 ↔ PG 승인금액 검증, 트랜잭션 처리, 망취소 |
| 약관 동의 | 회원가입시 이용약관/개인정보처리방침 명시 동의 |

## 회원 기능 (v4 추가)

### 휴대폰 인증 (SMS)
- `/mypage/security` 에서 휴대폰 번호 인증 가능
- 6자리 OTP, 5분 유효 / 1시간 5회 발급 제한 / 60초 재발송 쿨다운 / 5회 시도 제한
- SMS 코드는 SHA-256 해시로 저장 (평문 미저장)
- 알리고(Aligo) API 기본 지원, 환경변수 미설정시 개발용 콘솔 모드
- 인증 완료시 `User.phoneVerifiedAt` 저장

### 소셜 로그인 (네이버 / 카카오)
- NextAuth + `@next-auth/prisma-adapter`
- 동일 이메일 자동 계정 연결 (Adapter)
- 소셜 가입자에게도 가입 축하 적립금 1,000원 자동 지급
- 환경변수 설정시 자동으로 로그인 페이지에 버튼 노출

### 리뷰 사진 업로드
- 리뷰 작성 폼에 최대 5장 사진 첨부
- JPEG/PNG/WebP/HEIC, 8MB 이하
- 회원만 업로드 가능 + 분당 30회 레이트 리밋
- `/uploads/reviews/` 디렉토리에 저장 (운영시 S3/R2 등으로 교체)

## 운영 환경 추가 환경변수

```bash
# 알리고 SMS (선택, 미설정시 콘솔 모드)
ALIGO_API_KEY=
ALIGO_USER_ID=
ALIGO_SENDER=01012345678   # 사전등록된 발신번호

# 네이버 로그인
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
# 콜백 URL: {NEXTAUTH_URL}/api/auth/callback/naver

# 카카오 로그인
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
# Redirect URI: {NEXTAUTH_URL}/api/auth/callback/kakao
```

## 카카오 알림톡 (v5 추가)

### 자동 발송 시점
| 단계 | 트리거 | 발송 |
|------|--------|------|
| 주문/결제 완료 | PG 결제 콜백 | `notifyOrderPaid` |
| 배송 시작 | 관리자가 SHIPPED 처리 | `notifyShippingStarted` (배송조회 버튼) |
| 배송 완료 | 관리자가 DELIVERED 처리 | `notifyDeliveryCompleted` (리뷰 작성 버튼) |
| 주문 취소 | 관리자가 CANCELLED 처리 | `notifyOrderCancelled` |
| 환불 완료 | 관리자가 REFUNDED 처리 | `notifyOrderRefunded` |

### 구조
- `src/lib/alimtalk.ts` — Aligo AlimTalk API + 콘솔 폴백
- 5개 표준 템플릿 정의 (운영시 카카오에 사전 심사/등록 필요)
- 카카오톡 미수신/차단시 자동 SMS 폴백 (`failover: Y`)
- 비동기 발송 (실패해도 결제/주문 흐름에 영향 없음)
- 환경변수 미설정시 서버 콘솔에 메시지 출력 → 즉시 개발 가능

### 관리자 페이지
- `/admin/notifications` — 등록된 템플릿 5종 미리보기 + 카카오톡 말풍선 형태 노출
- 본인 휴대폰으로 **테스트 발송** 기능 내장
- 환경변수 설정 여부 자동 감지 (활성/콘솔 모드 표시)

### 운영 도입 절차
1. 카카오톡 비즈니스 채널 개설 + 알림톡 사용 신청
2. `src/lib/alimtalk.ts` 의 5개 템플릿 본문을 그대로 카카오에 사전 심사 요청 (영업일 1~3일)
3. `.env` 의 `ALIMTALK_*` 환경변수 입력
4. 승인된 템플릿 코드를 `ALIMTALK_TPL_*` 환경변수에 매핑

## 백엔드 인프라 (v6 추가)

### 데이터베이스
- **Prisma migrate 전환** — `db:migrate` (개발), `db:migrate:deploy` (운영)
- **인덱스 최적화** — `Order.userId+createdAt`, `Product.categoryId+isActive`, `LoginLog.email+createdAt` 등 핫패스에 인덱스 적용
- 신규 모델: `IdempotencyKey`, `AuditLog`, `RefundRequest`, `ReturnRequest`, `ReturnRequestItem`

### 동시성 / 정합성
- **재고 race-condition 방어** — `updateMany({ where: stock >= qty })` 조건부 차감으로 oversell 방지
- **쿠폰 reservation hold** — PENDING 단계에서 다른 결제가 같은 쿠폰 사용 못 하게 점유
- **PENDING 30분 자동 만료** — `/api/cron/expire-pending` (CRON_SECRET 필요)

### PG Webhook (결제 누락 방지)
- `/api/payments/toss/webhook` — 토스 PAYMENT_STATUS_CHANGED + HMAC-SHA256 서명 검증
- `/api/payments/inicis/notify` — 이니시스 노티 URL (서버 통보)
- `/api/payments/naver/webhook` — 네이버페이 취소/환불 통보
- 결제창 닫혀도 PG 통보로 DB 자동 동기화

### 개인정보 보호 (전자상거래/개인정보보호법)
- **AES-256-GCM 암호화** (`lib/crypto.ts`) — 휴대폰 번호 등 PII 암호화 저장
- **검색용 HMAC-SHA-256 해시** — 동등 검색 가능, 역추적 불가
- **회원 탈퇴 흐름** — `/mypage/withdraw` + `/api/me/withdraw` (PII 즉시 익명화 + 주문 5년 보관)
- **휴면 회원 자동 처리** — `/api/cron/dormant-users` (1년 미접속 → DORMANT, 5년 → 파기)

### RBAC
- `User.role`: CUSTOMER / CS_AGENT / ADMIN / SUPER_ADMIN
- `User.status`: ACTIVE / DORMANT / WITHDRAWN / SUSPENDED
- `ADMIN_EMAILS` env는 부트스트랩용으로 유지 (해당 이메일 자동 ADMIN 승격)

### 운영 모듈
- `lib/logger.ts` — 구조화 로거 (운영시 JSON 라인, 개발시 가독성 출력)
- `lib/idempotency.ts` — `Idempotency-Key` 헤더 기반 중복 요청 방지
- `lib/queue.ts` — 백그라운드 작업 큐 (인메모리, BullMQ로 교체 가능)
- `/api/health` — `?deep=1`로 DB 연결까지 점검

### 한국 e-commerce 특화
- **현금영수증 발행** (`lib/cash-receipt.ts` + `/api/admin/cash-receipts`)
- **부분 환불** — `/api/admin/refunds` (전액/부분, 적립금 복구, 쿠폰 복구 옵션)
- **반품/교환** — `/api/returns` (회원), `/api/admin/returns/[id]` (관리자)
  - DELIVERED 후 7일 이내 신청
  - 상태 머신: REQUESTED → APPROVED → PICKED_UP → COMPLETED

### 테스트 / CI
- `npm test` — Vitest 단위 테스트 (쿠폰 계산, 암호화 등)
- `.github/workflows/ci.yml` — push/PR시 자동 lint + test + build
- PostgreSQL 서비스 컨테이너로 통합 테스트 가능

## 운영 배포 체크리스트

```bash
# 1. 환경변수 필수 설정
ENCRYPTION_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
TOSS_WEBHOOK_SECRET=...      # 토스 콘솔에서 발급

# 2. 마이그레이션 적용
npm run db:migrate:deploy

# 3. PG Webhook URL 등록 (각 PG 콘솔)
# Toss: {NEXTAUTH_URL}/api/payments/toss/webhook
# 이니시스: {NEXTAUTH_URL}/api/payments/inicis/notify
# 네이버: {NEXTAUTH_URL}/api/payments/naver/webhook

# 4. Cron 등록 (Vercel Cron / 외부)
# */5 * * * * curl -H "x-cron-token: $CRON_SECRET" {URL}/api/cron/expire-pending
# 0 4 * * *   curl -H "x-cron-token: $CRON_SECRET" {URL}/api/cron/dormant-users

# 5. 스토리지 S3 활성화 (lib/storage.ts 의 S3Storage 주석 해제 + S3_* 설정)

# 6. /api/health?deep=1 호출하여 모든 의존성 정상 확인
```

## Sentry 에러 트래킹 (v7 추가)

### 자동 캡쳐 범위
- 클라이언트(브라우저) 미처리 예외 + 세션 리플레이 (에러 발생 세션만 100%)
- 서버(Node) Route Handler / RSC throw 자동 캡쳐 (`onRequestError` hook)
- `global-error.tsx` 루트 레이아웃 에러 안전 화면 + 캡쳐
- `logger.error()` / `logger.warn()` 자동 전파 (warn → breadcrumb)
- Prisma 쿼리 자동 트레이싱

### 보안
- `sendDefaultPii: false` (개인정보 미전송이 기본)
- 요청 헤더 중 `cookie / authorization / x-cron-token` 자동 제거
- `?token=...` 등 민감 쿼리 파라미터 마스킹
- 세션 리플레이는 `maskAllText + blockAllMedia` 적용
- `SENTRY_INCLUDE_PII=true` 환경변수 명시할 때만 사용자 이메일 전송

### 노이즈 필터
다음은 무시 (의미 없는 알림 방지):
- 클라이언트: `Network Error / Failed to fetch / ResizeObserver / ChunkLoadError / CredentialsSignin`
- 서버: `OutOfStockError`(비즈니스), Prisma `P2025`(record not found)

### 광고차단기 우회
`tunnelRoute: "/monitoring"` 자동 라우트 → uBlock 등이 sentry.io 도메인을 막아도 캡쳐 가능

### 테스트
관리자 로그인 후:
```bash
curl http://localhost:3000/api/admin/sentry-test?type=message
curl http://localhost:3000/api/admin/sentry-test?type=error
curl http://localhost:3000/api/admin/sentry-test?type=throw
curl http://localhost:3000/api/admin/sentry-test?type=logger
```

### 도입 절차
1. https://sentry.io 가입 → 프로젝트 생성 (Next.js 선택)
2. `.env`에 `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` 입력 (보통 같은 값)
3. 소스맵 업로드는 선택 — `SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN` 추가시 빌드 후 자동 업로드
4. CI에서 `SENTRY_RELEASE=$GITHUB_SHA` 주입하면 릴리스별 에러 추적 가능

DSN 미설정 시 Sentry 코드는 no-op으로 동작 (빌드/런타임 영향 없음).

## Phase 3+4 (v8 추가)

### 상품 Q&A
- 상품 상세에서 비공개/공개 문의 작성 (`ProductQnaSection`)
- 비공개 글은 작성자/관리자만 본문 노출 (다른 회원에게는 마스킹)
- `/api/products/[id]/questions` GET/POST, `/api/admin/questions/[id]` PATCH/DELETE (답변·숨김)

### 1:1 문의 티켓
- `/support` 회원 + 비회원(이메일 기반) 모두 작성 가능
- 카카오톡 형태의 채팅 UI (`SupportMessage` 의 `CUSTOMER` / `ADMIN` 분리)
- 7개 카테고리, 4단계 상태 (OPEN / PENDING / ANSWERED / CLOSED)
- 관리자 `/admin/support` 에서 상태 필터링 + 답변

### 송장 일괄 처리
- `/admin/orders/bulk-shipping` — XLSX/CSV 업로드 → 일괄 SHIPPED 처리
- 주문번호 + 택배사 + 송장번호 한 번에 수십~수백건
- 처리 후 자동 알림톡 발송 (개별 비동기 큐)
- 템플릿 엑셀 다운로드 제공

### 이미지 자동 처리 (sharp)
- `lib/image.ts` — 다중 사이즈 자동 생성 (thumb / medium / large) + WebP 변환
- HEIC / HEIF (아이폰 사진) → WebP 자동 변환
- EXIF 회전 적용 후 EXIF 메타데이터 제거 (위치정보 등 PII 보호)
- GIF 는 첫 프레임 손상 방지 위해 원본 보존
- `/api/admin/upload` 가 자동으로 thumbnailUrl / mediumUrl / largeUrl 반환

### 2단계 인증 (TOTP)
- Google Authenticator / Authy / 1Password 호환 (otplib + qrcode)
- `/mypage/security` 3단계 위자드 — QR 스캔 → 코드 검증 → 백업코드 8자리×10
- TOTP secret 은 AES-256-GCM 암호화하여 DB 저장
- 백업코드는 bcrypt 해시 (1회용)
- **로그인 챌린지** — `totpEnabled` 회원은 비번 통과 후 OTP 6자리 또는 백업코드 필수
- **재사용 방어** — 동일 (userId, code) 90초 내 재사용 거부 (Redis NX + 인메모리 폴백)
- 2FA 해제는 비밀번호 재인증 필수

### 이메일 인증 (가입시)
- 가입시 24시간 유효 토큰 발송 (NextAuth `VerificationToken` 모델 활용)
- `/verify-email?token=...` 클릭 → `User.emailVerified` 업데이트
- 마이페이지에서 인증 메일 재발송 (10분 3회 제한)

### PWA
- `src/app/manifest.ts` — 모바일 "홈 화면에 추가" + 데스크탑 설치 가능
- 단축 아이콘: 장바구니 / 마이페이지
- 아이콘 192/512 + maskable

## 운영 모듈 (v9 추가 — 최신)

### 비밀번호 찾기 / 재설정
- `/forgot-password` — 이메일 입력시 토큰 메일 발송 (가입자/미가입자 구분 노출 안 함, 사용자 열거 방어)
- `/reset-password?token=...` — 토큰 검증 후 새 비밀번호 설정
- 토큰 1시간 유효 + 1회용 + IP 레이트리밋 (`api/auth/forgot-password`, `api/auth/reset-password`)
- 재설정 완료시 모든 기존 세션 무효화 권장 (로그아웃 안내)

### 공지 / FAQ CMS
- `/admin/notices`, `/admin/faq` — 관리자 작성/수정/순서 관리
- 사용자 노출: `/notice`, `/notice/[id]`, `/faq` (`FaqAccordion`)
- `NoticeBar` — 상단 공지 띠 (활성 공지 자동 노출)
- `lib/cms.ts` — 공지/FAQ 조회 헬퍼

### 사이트 설정
- `/admin/site` (`SiteSettingsForm`) — 로고, 히어로 슬라이드, 배너, 상호 등 런타임 편집
- DB에 키-값 저장 (`SiteSetting` 모델), `lib/site-settings.ts` 캐시
- 빌드 재배포 없이 메인 페이지 슬라이드/배너 교체

### 검색 자동완성
- `HeaderSearch` — 입력시 디바운스로 `/api/search/suggest` 호출
- 상품명/카테고리명 부분일치 → 키보드 ↑↓/Enter 네비게이션

### 위시리스트 (zustand)
- `src/store/wishlist.ts` — localStorage 영속화
- 4개 컴포넌트:
  - `WishlistButton` — 일반 토글
  - `WishlistHeartButton` — 카드 우상단 하트
  - `WishlistBadge` — 헤더 카운트
  - `WishlistInitializer` — 마운트시 서버 sync
- 비회원도 사용 가능 (로컬 저장), 로그인시 서버 동기화

### 재입고 알림
- `StockNotifyButton` — 품절 상품에서 "재입고시 알림" 등록
- `/api/stock-notifications` — `StockNotification` 모델
- 재고 복구시 등록자에게 자동 메일/알림톡 (기존 알림 모듈 재사용)

### 비회원 주문 조회
- `/guest-orders` — 주문번호 + 휴대폰 뒷자리 4개로 조회
- `/api/orders/guest-lookup` — 결제수단/배송정보/현재 상태/송장번호 노출

### 주문 취소 / 반품 플로우 (사용자 셀프)
- `/mypage/orders` 의 `OrderActionButtons`
  - PAID 상태: 즉시 취소 가능
  - DELIVERED 후 7일 이내: 반품 신청 (`ReturnForm`)
- `/api/orders/[id]/cancel` — 결제 망취소 + 재고 복구 + 쿠폰/적립금 복구
- `lib/payments/refund.ts` — 토스/이니시스/네이버 환불 통합 모듈
- `lib/payments/order-access.ts` — 주문 소유자 검증 가드

### 감사로그 (Audit)
- `lib/audit.ts` — `AuditLog` 모델에 관리자 행동 기록 (행위자/대상/액션/메타)
- `/admin/audit` — 검색/필터로 누가 무엇을 언제 했는지 조회
- 회원 권한 변경, 환불, 상품 삭제, 강제 로그아웃 등 민감 액션 자동 기록

### 회원 등급 / 권한 관리 (RBAC)
- `/admin/users/[id]` 의 `UserRoleEditor` — 역할 변경 UI
- `/api/admin/users/[id]/role` — 역할 변경 API (감사로그 자동 기록)
- `lib/membership.ts` — 회원 등급(누적 구매액 기반) 자동 계산

### TOTP 코드 재사용 방어
- `markTotpCodeUsed(userId, code)` — Redis NX (`SET ... EX 90 NX`)
- Redis 미설정시 인메모리 Map 폴백 (단일 인스턴스 한정)
- 동일 코드 90초 내 두 번째 사용은 거부 → 화면캡처/네트워크 가로채기 방어

### Cron 정리 작업
- `/api/cron/cleanup` — `IdempotencyKey` / `LoginLog` / `DataExportRequest` 만료분 일괄 삭제
- `lib/cron-auth.ts` — `x-cron-token` 검증
- 권장 주기: 매일 04:30

### 추가 환경변수

```bash
# 비밀번호 재설정 (별도 키 없음 — SMTP_* 재사용)

# 사이트 기본 URL (메일 링크용, NEXTAUTH_URL 폴백)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Redis (TOTP 재사용 방어 + 분산 레이트리밋 + 큐)
REDIS_URL=redis://localhost:6379

# 비즈니스 표시명 (TOTP issuer, 메일 발신, manifest 등 공통)
NEXT_PUBLIC_BUSINESS_NAME=낚시몰
```

## 다음 단계로 추가하면 좋은 기능

이미 구현 완료 (체크):

- [x] 2단계 인증 (TOTP / OTP App) — v8
- [x] 이메일 인증 (가입시) — v8
- [x] Redis 도입 (세션 캐시, 분산 레이트리밋) — v6/v9
- [x] BullMQ 백그라운드 큐 (alimtalk 재시도) — v6
- [x] 비밀번호 재설정 (이메일 토큰 기반) — v9

남은 후보:

- [ ] 사이즈 옵션 (색상 + 사이즈 조합 SKU)
- [ ] 알림 수신 동의 관리 (회원별 채널 ON/OFF)
- [ ] Postgres tsvector + 형태소 분석 검색 (현재는 LIKE 자동완성)
- [ ] 비밀번호 재설정 (휴대폰 인증 경로 추가 — 현재는 이메일만)
- [ ] 회원 가입시 휴대폰 본인인증 (PASS / NICE)
- [ ] 가격비교 EP 멀티채널 (다나와, 에누리)
- [ ] 정산 자동화 (일/주/월 매출 → 회계 시스템 export)
- [ ] Service Worker (오프라인 PWA — 현재는 manifest만)
- [ ] 라이브커머스 / 실시간 재고 (WebSocket)
- [ ] AI 상품 추천 (협업필터링 또는 임베딩)

## 라이선스

MIT — 자유롭게 수정/사용 가능합니다.
