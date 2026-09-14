/**
 * 채비도 데이터 — 우리나라 시즌·지역별 주요 루어 대상어 15종 (탑캐스팅 상품에 맞춘 채비). 재실행 시 slug 기준 upsert
 *   docker compose exec app npx tsx scripts/migrate/seed-rigs.ts
 *
 * 시즌·지역 근거(대략): 국내 낚시 시즌 자료 종합 — 농어 서해·남해 5~10월/동해 6~9월, 무늬오징어·한치 5~10월,
 * 방어·부시리 9~1월, 대구·볼락·열기 겨울, 광어 4월~·우럭 5~6월 피크, 갑오징어·쭈꾸미 서해 가을(8~11월).
 * 어종 사진: public/uploads/rigs/species/<어종>.jpg (위키미디어 공용, credits.json 에 출처)
 */
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
const prisma = new PrismaClient();

const img = (ko: string) => (existsSync(`public/uploads/rigs/species/${ko}.jpg`) ? `/uploads/rigs/species/${ko}.jpg` : null);

async function ids(...names: string[]) {
  const rows = await prisma.product.findMany({ where: { isActive: true, OR: names.map((n) => ({ name: { contains: n } })) }, select: { id: true, name: true } });
  return names.flatMap((n) => rows.filter((r) => r.name.includes(n)).map((r) => r.id)).filter((v, i, a) => a.indexOf(v) === i);
}
const M = (...m: number[]) => m;
const ALL = M(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);

async function main() {
  const rigs = [
    { slug: "갑오징어-쭈꾸미-선상-에깅", species: "갑오징어·쭈꾸미", img: "갑오징어", title: "선상 에깅 채비", fishingType: "eging",
      regions: ["west-north", "west-south", "south-west"], months: M(8, 9, 10, 11),
      summary: "가을 서해 선상 갑오징어·쭈꾸미 기본 채비. 봉돌 아래 에기 1~2개를 다는 다운샷 형태",
      components: [
        { name: "낚싯대", spec: "쭈갑 전용 베이트로드 1.8~2.1m", productIds: [] },
        { name: "릴", spec: "베이트릴 100~200번, PE 0.8~1호 100m 이상", productIds: [] },
        { name: "채비", spec: "쭈꾸미·갑오징어 전용 봉돌 채비 또는 다운샷", productIds: await ids("문어채비구슬", "문어반짝이채비") },
        { name: "에기", spec: "2.5~3.5호, 야광·핑크·오렌지 계열", productIds: await ids("SLT 2.5", "SLT 3.0", "뉴사파이어 2.5", "진주 구슬", "소프트 애기") },
        { name: "봉돌", spec: "15~25호 (조류에 따라)", productIds: [] },
      ],
      content: "<p>조류가 약할 때는 가벼운 봉돌로 바닥을 살살 끌고, 세질 때는 무게를 올려 바닥을 확실히 찍어 줍니다. 입질은 무게감이 툭 얹히는 느낌이니 살짝 들어 무게가 실리면 천천히 감아 올리세요.</p>" },
    { slug: "쭈꾸미-워킹-에깅", species: "쭈꾸미", img: "쭈꾸미", title: "워킹 에깅 채비", fishingType: "eging",
      regions: ["west-north", "west-south"], months: M(9, 10, 11),
      summary: "방파제·갯바위에서 가벼운 봉돌과 에기로 바닥을 더듬는 쭈꾸미 워킹 채비",
      components: [
        { name: "낚싯대", spec: "에깅 로드 8ft 전후 또는 볼락 로드", productIds: [] },
        { name: "릴", spec: "스피닝릴 2500번, PE 0.6~0.8호", productIds: [] },
        { name: "에기", spec: "2.0~2.5호 소형 에기, 야광", productIds: await ids("SLT 2.5", "뉴사파이어 2.5", "진주 구슬") },
        { name: "봉돌", spec: "3~8호 유동 봉돌", productIds: [] },
      ],
      content: "<p>바닥에 닿은 뒤 1~2초 멈춤을 반복합니다. 무게가 실리면 챔질 없이 천천히 감아 올리면 됩니다.</p>" },
    { slug: "문어-선상-문어에기", species: "문어", img: "문어", title: "선상 문어 에기 채비", fishingType: "eging",
      regions: ["west-north", "west-south", "south-east", "east-south"], months: M(6, 7, 8, 9, 10),
      summary: "왕발이·3훅 문어 에기 2개를 봉돌 위아래로 배치하는 여름~가을 문어 채비",
      components: [
        { name: "낚싯대", spec: "문어 전용 로드 1.5~1.8m, 강한 허리", productIds: [] },
        { name: "릴", spec: "베이트릴 300번 이상, PE 2~3호", productIds: [] },
        { name: "채비", spec: "문어 채비 구슬 + 반짝이 채비", productIds: await ids("문어채비구슬", "문어반짝이채비") },
        { name: "에기", spec: "문어 에기 3.0~3.5호 (3훅·왕발이)", productIds: await ids("문어애기 3훅", "문어애기 왕발이", "TIP RUN 문어", "문어 꼴뚜기") },
        { name: "봉돌", spec: "30~60호", productIds: [] },
      ],
      content: "<p>바닥에 붙여 두고 로드 팁으로 톡톡 두드리다 멈추는 동작을 반복합니다. 묵직하게 눌리는 입질이 오면 강하게 챔질해 바닥에서 떼어내는 것이 핵심입니다.</p>" },
    { slug: "무늬오징어-에깅", species: "무늬오징어", img: "무늬오징어", title: "에깅 채비", fishingType: "eging",
      regions: ["south-east", "south-west", "east-south", "jeju"], months: M(5, 6, 9, 10, 11),
      summary: "가을 새끼 무늬오징어부터 봄 대물까지, 에기 3.0~3.5호 캐스팅 에깅",
      components: [
        { name: "낚싯대", spec: "에깅 전용 로드 8.3~8.6ft M", productIds: [] },
        { name: "릴", spec: "스피닝릴 2500~3000번 (섈로우 스풀)", productIds: [] },
        { name: "원줄", spec: "PE 0.6~0.8호 150m", productIds: [] },
        { name: "리더", spec: "카본 2~2.5호 1.5m", productIds: [] },
        { name: "에기", spec: "3.0~3.5호 (가을 3.0 / 봄 3.5)", productIds: await ids("사파이어 애기 3.0", "SLT 3.0", "SLT 3.5") },
        { name: "소품", spec: "에기 스냅", productIds: await ids("탑 원터치 링", "스텐다드 링") },
      ],
      content: "<p>캐스팅 후 바닥까지 가라앉힌 뒤 2~3회 샤크리(저킹)와 폴을 반복합니다. 입질은 대부분 폴 중에 오므로 라인의 움직임을 잘 보세요.</p>" },
    { slug: "한치-선상-지깅", species: "한치", img: "한치", title: "선상 한치 지깅·에깅 채비", fishingType: "jigging",
      regions: ["jeju", "south-east", "south-west"], months: M(6, 7, 8),
      summary: "여름 제주·남해 밤낚시. 야광 에기와 소프트 에기를 층별로 다는 한치 채비",
      components: [
        { name: "낚싯대", spec: "한치 전용 로드 또는 라이트 지깅 로드", productIds: [] },
        { name: "릴", spec: "베이트릴 200번, PE 0.8~1호", productIds: [] },
        { name: "에기", spec: "야광 소프트 에기 2.5~3.0호 2~3개 (가지채비)", productIds: await ids("소프트 애기", "진주 구슬", "SLT 2.5") },
        { name: "봉돌", spec: "20~40호", productIds: [] },
      ],
      content: "<p>집어등 아래 수심 10~30m를 층별로 탐색합니다. 살짝 들어 올렸다 멈추는 동작에서 입질이 옵니다.</p>" },
    { slug: "호래기-워킹", species: "호래기", img: "호래기", title: "워킹 호래기 채비", fishingType: "eging",
      regions: ["south-east", "south-west"], months: M(11, 12, 1, 2),
      summary: "겨울 남해 방파제 밤낚시. 초소형 에기와 가벼운 봉돌",
      components: [
        { name: "낚싯대", spec: "볼락 로드 7ft 전후 UL", productIds: [] },
        { name: "릴", spec: "스피닝릴 1000~2000번, PE 0.3~0.4호", productIds: [] },
        { name: "에기", spec: "호래기 전용 1.5~1.8호", productIds: await ids("호래기 1.8") },
        { name: "봉돌", spec: "1~3호", productIds: [] },
      ],
      content: "<p>가로등 불빛 경계에서 느리게 감다 멈추기를 반복합니다. 살짝 걸리는 느낌이 입질입니다.</p>" },
    { slug: "광어-우럭-다운샷", species: "광어·우럭", img: "광어", title: "다운샷 채비", fishingType: "lure",
      regions: ["west-north", "west-south", "south-west", "south-east"], months: M(4, 5, 6, 7, 8, 9, 10, 11),
      summary: "서해 광어·우럭 선상 다운샷. 지그헤드 또는 다운샷 훅에 4~5인치 웜",
      components: [
        { name: "낚싯대", spec: "다운샷 전용 베이트로드 2.0~2.3m", productIds: [] },
        { name: "릴", spec: "베이트릴 200~300번", productIds: [] },
        { name: "원줄", spec: "PE 1.5~2호", productIds: [] },
        { name: "지그헤드", spec: "1/2~1oz, 조류에 맞춰 선택", productIds: await ids("편탁지그헤드", "대포 바다지그헤드", "측광 바다지그헤드") },
        { name: "웜", spec: "4~5인치 새드·섀드테일", productIds: await ids("T-LINE LT", "T-LINE TD", "울트라 R93 새드 5인치", "울트라 탑 MINNOW", "T 어쎄신") },
        { name: "훅", spec: "와이드갭 훅 3/0~5/0 (텍사스 리그 시)", productIds: await ids("와이드갭 훅", "옵셋 훅") },
      ],
      content: "<p>바닥을 찍고 20~50cm 띄운 상태에서 리프트 앤 폴을 반복합니다. 광어는 바닥에 붙어 있으므로 폴링 중 입질이 많고, 우럭은 인공어초 주변 바닥층에서 반응합니다.</p>" },
    { slug: "우럭-선상-지깅", species: "우럭", img: "우럭", title: "선상 메탈 지깅 채비", fishingType: "jigging",
      regions: ["west-north", "west-south", "east-south"], months: M(4, 5, 6, 9, 10, 11),
      summary: "인공어초·침선 주변 우럭을 노리는 메탈지그 채비",
      components: [
        { name: "낚싯대", spec: "라이트 지깅 로드 1.9~2.1m", productIds: [] },
        { name: "릴", spec: "베이트릴 300번, PE 1.5~2호", productIds: [] },
        { name: "메탈지그", spec: "60~120g 슬로우 지그", productIds: await ids("슬로우지그", "TCLL55A", "TCLL55B", "TOP LT 메탈") },
        { name: "훅", spec: "어시스트훅 (앞뒤)", productIds: await ids("멀티5 야광 어시스트훅") },
      ],
      content: "<p>바닥 부근에서 슬로우 피치로 지그를 띄웠다 폴시키는 동작을 반복합니다. 침선 걸림에 주의하세요.</p>" },
    { slug: "갈치-선상-지깅", species: "갈치", img: "갈치", title: "선상 갈치 지깅 채비", fishingType: "jigging",
      regions: ["south-west", "south-east", "jeju", "east-south"], months: M(7, 8, 9, 10, 11),
      summary: "야광 메탈지그와 갈치 전용 웜·지그헤드를 쓰는 가을 갈치 선상 지깅",
      components: [
        { name: "낚싯대", spec: "갈치 지깅로드 1.8~2.0m", productIds: [] },
        { name: "릴", spec: "베이트릴 300번, PE 1.5~2호", productIds: [] },
        { name: "리더", spec: "와이어 리더 또는 갈치 전용 리더 채비", productIds: await ids("갈치·삼치 WIDE LEADER") },
        { name: "메탈지그", spec: "80~120g 야광 제브라", productIds: await ids("칼립소 멀티 갈치메탈", "TOP LT 메탈", "TCLL 68 메탈") },
        { name: "지그헤드", spec: "갈치 텐야·3WAY 지그헤드 3~5g", productIds: await ids("TOP TEN 텐야", "멀티-L 3WAY", "멀티-S 3WAY") },
        { name: "웜", spec: "갈치 웜 (TOP FLEX)", productIds: await ids("TOP FLEX-S", "TOP FLEX-T") },
        { name: "훅", spec: "야광 어시스트훅", productIds: await ids("멀티5 야광 어시스트훅") },
      ],
      content: "<p>집어등 불빛 경계 수심을 중심으로 천천히 감아 올리는 슬로우 리트리브가 기본입니다. 이빨이 날카로우니 리더는 반드시 와이어나 굵은 카본을 쓰세요.</p>" },
    { slug: "참돔-타이라바", species: "참돔", img: "참돔", title: "타이라바 채비", fishingType: "jigging",
      regions: ["south-west", "south-east", "west-south", "jeju"], months: M(4, 5, 6, 9, 10, 11),
      summary: "봄·가을 참돔 선상 타이라바. 유동식 헤드 60~120g에 스커트·넥타이",
      components: [
        { name: "낚싯대", spec: "타이라바 전용 로드 2.0~2.2m", productIds: [] },
        { name: "릴", spec: "베이트릴 200번 (카운터 유용), PE 0.8~1호", productIds: [] },
        { name: "리더", spec: "카본 3~4호 3m", productIds: [] },
        { name: "타이라바", spec: "유동식 60~120g, 오렌지·레드·골드", productIds: await ids("사파이어 유동식 타이라바", "칼립소 유동식 타이라바 헤드") },
      ],
      content: "<p>바닥에 닿자마자 일정한 속도로 감아 올리는 '등속 리트리브'가 기본입니다. 입질이 와도 챔질하지 말고 그대로 감아 무게가 실리면 로드를 세우세요.</p>" },
    { slug: "농어-미노우-캐스팅", species: "농어", img: "농어", title: "미노우·바이브 캐스팅 채비", fishingType: "lure",
      regions: ["west-north", "west-south", "south-west", "south-east", "jeju"], months: M(5, 6, 7, 8, 9, 10),
      summary: "갯바위·방파제·선상 농어 캐스팅. 90~130mm 미노우와 싱킹 바이브",
      components: [
        { name: "낚싯대", spec: "시배스 로드 9~10ft ML~M", productIds: [] },
        { name: "릴", spec: "스피닝릴 3000~4000번, PE 1~1.5호", productIds: [] },
        { name: "리더", spec: "카본 4~5호 1.5m", productIds: [] },
        { name: "미노우", spec: "90~130mm 플로팅·서스펜드", productIds: await ids("사파이어 TCS103", "사파이어 TCS112", "사파이어 TCS67", "사파이어 TCS190A") },
        { name: "바이브", spec: "싱킹 바이브 15~25g (수심 깊거나 조류 셀 때)", productIds: await ids("사파이어 TCS24", "사파이어 TCS23", "사파이어 TCS115") },
        { name: "소품", spec: "스냅, 트레블훅 교체용", productIds: await ids("탑 원터치 링", "울트라 트레블훅") },
      ],
      content: "<p>해질녘과 새벽, 물돌이 시간이 골든타임입니다. 미노우는 느린 리트리브에 짧은 트위치를 섞고, 바이브는 폴 후 리프트를 반복합니다.</p>" },
    { slug: "삼치-부시리-메탈-캐스팅", species: "삼치·부시리", img: "삼치", title: "메탈 캐스팅·지깅 채비", fishingType: "jigging",
      regions: ["east-south", "south-east", "south-west", "jeju"], months: M(8, 9, 10, 11, 12),
      summary: "가을 회유어 시즌. 메탈지그를 멀리 던져 빠르게 감는 캐스팅 지깅",
      components: [
        { name: "낚싯대", spec: "쇼어지깅 로드 9.6~10ft M~MH", productIds: [] },
        { name: "릴", spec: "스피닝릴 4000~5000번, PE 1.5~2호", productIds: [] },
        { name: "리더", spec: "카본 6~8호 (삼치는 와이어 권장)", productIds: await ids("갈치·삼치 WIDE LEADER") },
        { name: "메탈지그", spec: "30~60g 캐스팅용", productIds: await ids("TOP LT 메탈", "TCLL55A", "TCLL55B", "TCLL 68") },
        { name: "스푼", spec: "20~30g (삼치 표층)", productIds: await ids("TPIAA 스푼 은색", "TPIAA 스푼 금색") },
        { name: "훅", spec: "트레블훅·어시스트훅", productIds: await ids("크롬 트레블훅", "멀티5 야광 어시스트훅") },
      ],
      content: "<p>보일(수면 폭발)이 보이면 그 너머로 던져 빠르게 감습니다. 삼치는 이빨이 날카로워 리더를 자주 확인하세요.</p>" },
    { slug: "대구-선상-지깅", species: "대구", img: "대구", title: "선상 대구 지깅 채비", fishingType: "jigging",
      regions: ["east-south", "east-north", "south-east"], months: M(12, 1, 2),
      summary: "겨울 동해 심해 대구. 400g 전후 대구 전용 메탈과 슬로우 지그",
      components: [
        { name: "낚싯대", spec: "심해 지깅 로드 1.8~2.0m, 300~500g 대응", productIds: [] },
        { name: "릴", spec: "전동릴 또는 대형 베이트릴, PE 3~4호 300m", productIds: [] },
        { name: "메탈지그", spec: "300~450g 야광", productIds: await ids("대구 전용 메탈", "슬로우지그") },
        { name: "훅", spec: "대형 어시스트훅", productIds: await ids("멀티5 야광 어시스트훅") },
      ],
      content: "<p>수심 100m 전후 바닥에서 크게 들었다 내리는 롱폴 액션이 주효합니다. 케미를 꽂아 집어 효과를 더하세요.</p>" },
    { slug: "볼락-전갱이-라이트-지깅", species: "볼락·전갱이", img: "볼락", title: "볼락·아징 지그헤드 채비", fishingType: "lure",
      regions: ["south-east", "south-west", "east-south", "jeju"], months: M(10, 11, 12, 1, 2, 3, 4),
      summary: "가을~봄 방파제 밤낚시. 1~3g 지그헤드에 1.5~2인치 웜",
      components: [
        { name: "낚싯대", spec: "볼락·아징 로드 6.8~7.6ft UL", productIds: [] },
        { name: "릴", spec: "스피닝릴 1000~2000번, PE 0.3호 또는 카본 3lb", productIds: [] },
        { name: "지그헤드", spec: "1~3g 소형", productIds: await ids("스텐다드지그헤드", "플레이더지그헤드") },
        { name: "웜", spec: "1.5~2인치 글럽·핀테일", productIds: await ids("오로라 C 글럽 1.5인치", "오로라 C 글럽 2인치", "오로라 I 글럽 1.8인치", "오로라 C 글럽 1인치") },
      ],
      content: "<p>가로등 불빛과 그림자 경계를 카운트다운으로 층을 나눠 탐색합니다. 초슬로우 리트리브가 기본이며 전갱이는 살짝 튕기는 액션에 반응합니다.</p>" },
    { slug: "배스-루어", species: "배스", img: "배스", title: "배스 루어 기본 채비", fishingType: "fresh",
      regions: ["fresh"], months: M(3, 4, 5, 6, 7, 8, 9, 10, 11),
      summary: "봄 산란기·가을 턴오버 시즌의 배스. 텍사스 리그·스피너베이트·프로그",
      components: [
        { name: "낚싯대", spec: "배스 로드 6.6~7ft M~MH (베이트)", productIds: [] },
        { name: "릴", spec: "베이트릴, 카본 12~16lb", productIds: [] },
        { name: "웜 (텍사스·프리 리그)", spec: "4~5인치 호그·새드·크리쳐", productIds: await ids("칼라 R25 호그", "울트라 BB 호그", "울트라 R93 새드 4인치", "칼라 R21 새드", "울트라 R70 더블링거") },
        { name: "훅", spec: "와이드갭·옵셋 훅 2/0~4/0", productIds: await ids("와이드갭 훅", "옵셋 훅", "언더 훅") },
        { name: "스피너베이트·채터베이트", spec: "3/8~1/2oz (봄·가을 커버 주변)", productIds: await ids("스피너베이트", "채터베이트", "러버지그") },
        { name: "프로그", spec: "여름 수초 위 탑워터", productIds: await ids("개구리 FG-B", "개구리 FG-C", "개구리 FG-E", "개구리 FG-F") },
      ],
      content: "<p>봄에는 산란장 주변 얕은 곳을 느리게, 여름에는 수초·그늘을 프로그와 텍사스로, 가을에는 스피너베이트로 넓게 탐색합니다.</p>" },
    { slug: "쏘가리-루어", species: "쏘가리", img: "쏘가리", title: "쏘가리 지그헤드·스푼 채비", fishingType: "fresh",
      regions: ["fresh"], months: M(5, 6, 7, 8, 9, 10),
      summary: "여울과 바위 밑을 노리는 쏘가리. 지그헤드 + 2인치 글럽, 스푼",
      components: [
        { name: "낚싯대", spec: "쏘가리 로드 6.6~7ft L~ML", productIds: [] },
        { name: "릴", spec: "스피닝릴 2000~2500번, 카본 6~8lb", productIds: [] },
        { name: "지그헤드", spec: "1/16~1/8oz", productIds: await ids("편탁지그헤드") },
        { name: "웜", spec: "2~3인치 글럽 (펄·화이트·차트)", productIds: await ids("오로라 C 글럽 2인치", "오로라 C 글럽 3인치 원톤", "오로라 I 글럽 1.8인치") },
        { name: "스푼", spec: "5~9g", productIds: await ids("TPIAA 스푼 은색", "TPIAA 스푼 금색", "TPIAA 털스푼 은색") },
      ],
      content: "<p>여울 상류로 던져 물살에 태워 흘리면서 바위 뒤 소용돌이에 루어가 머물게 합니다. 해뜰 무렵과 해질 무렵이 좋습니다.</p>" },
    { slug: "송어-스푼", species: "송어", img: "송어", title: "송어 스푼·미노우 채비", fishingType: "fresh",
      regions: ["fresh"], months: M(11, 12, 1, 2, 3),
      summary: "겨울 송어 낚시터. 3~7g 스푼과 소형 미노우",
      components: [
        { name: "낚싯대", spec: "트라우트 로드 6~6.6ft UL", productIds: [] },
        { name: "릴", spec: "스피닝릴 1000~2000번, 나일론 3~4lb", productIds: [] },
        { name: "스푼", spec: "3~7g, 골드·실버·오렌지", productIds: await ids("TPIAA 스푼 금색", "TPIAA 스푼 은색", "TPIAA 털스푼 금색") },
        { name: "미노우", spec: "40~60mm 싱킹", productIds: await ids("사파이어 TCS90A", "사파이어 TCS45") },
      ],
      content: "<p>활성이 낮은 겨울에는 느린 리트리브와 폴을 섞습니다. 색상 로테이션이 조과를 좌우합니다.</p>" },
  ];
  for (const r of rigs) {
    const { slug, components, img: imgKey, ...rest } = r;
    const data = { ...rest, speciesImage: img(imgKey), components };
    await prisma.rigGuide.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    console.log(`✔ ${r.species} ${r.title} — 구성품 ${components.length}, 추천상품 ${components.reduce((n, c) => n + c.productIds.length, 0)}, 사진 ${data.speciesImage ? "O" : "-"}`);
  }
}
main().finally(() => prisma.$disconnect());
