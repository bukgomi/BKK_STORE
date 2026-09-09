@echo off
chcp 65001 >nul
REM ─────────────────────────────────────────────
REM  낚시몰 로컬(Docker) 업데이트 — 더블클릭 한 번으로
REM   1) git pull (최신 코드)  2) 컨테이너 재시작  3) 카테고리·관리자 시드 갱신
REM ─────────────────────────────────────────────
cd /d "%~dp0"

echo [1/4] 최신 코드 받는 중...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo !! git pull 실패. 로컬에서 파일을 고친 게 있으면 되돌리거나 커밋한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

echo [2/4] 컨테이너 기동/재시작...
docker compose up -d
docker compose restart app worker

echo [3/4] 앱이 뜰 때까지 대기...
set /a tries=0
:wait
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:3000/ 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 goto ready
if %tries% geq 60 (
  echo !! 3분 안에 앱이 뜨지 않았습니다. docker compose logs app 으로 확인하세요.
  pause
  exit /b 1
)
timeout /t 3 >nul
goto wait

:ready
echo [4/4] DB 시드 갱신 (카테고리 아이콘/관리자)...
docker compose exec -T app npx tsx prisma/seed-categories.ts
docker compose exec -T app npx tsx prisma/seed-admin.ts

echo.
echo ✔ 업데이트 완료  →  http://localhost:3000   (관리자: http://localhost:3000/admin)
pause
