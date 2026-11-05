# 자격판정기 (보조 프로젝트)

강원대 공지·외부 공모전·정부 지원사업을 모아 **내 조건으로 지원 가능 여부와 이유**를 보여 주는 단일 HTML 판정기입니다. 메인 앱(저장소 루트)과 별도로 실행됩니다.

## 주요 기능

- **판정** — Gemini가 공지에서 캠퍼스·학년·평점·서류·마감 조건을 읽고, 지원 가능 여부는 코드(`judge()`)가 계산합니다. 카드마다 이유를 표시합니다.
- **Gemini 학과 맞춤 추천** — 학과를 입력하면 그 순간 Gemini가 마감 전 공지 목록을 읽고 관련 공지와 이유 한 줄을 고릅니다. 응답이 없으면 "AI 아님 · 규칙 매칭"으로 표시합니다.
- **곰두리 에이전트** — 조건 저장, 공지 찾기, 할 일 체크리스트, 문의 메일 초안, 취업 상담(`lib/gomduri.js`). AI 한도가 차면 규칙 모드로 동작합니다.
- **데이터 수집** — 강원대 게시판(`scripts/collect.mjs`), 외부 공모전(`scripts/contests.mjs`), 정부·공공 API(`scripts/gov.mjs`: 한국장학재단·보조금24·K-Startup·복지로·Q-Net 시험일정·고용24 일학습병행·국가장학금 수혜 통계).
- **발표 자료 생성** — `scripts/deck/`(PPT 생성기, 화면 캡처 스크립트).

## 실행

Node.js 20 이상이 필요합니다 (외부 패키지 없이 동작, 발표 자료 생성만 `pptxgenjs`·`puppeteer-core` 필요).

```bash
cp .env.example .env       # 키 입력: GEMINI_API_KEY, DATA_GO_KR_KEY, DATA_GO_KR_KEY2, WORK24_KEY
npm test                   # 단위 테스트
npm run update             # 수집 → 분석 → data/notices.json
npm run dev                # http://localhost:5178 (키는 서버에만)
```

### 더블클릭용 단독 HTML

```bash
node scripts/export-standalone.mjs dist/KNU_놓치지마.html --no-key
```

`--no-key`를 빼면 `.env`의 Gemini 키가 HTML 안에 들어갑니다. 그 파일은 소스 보기로 키가 보이므로 **저장소나 인터넷에 올리지 마세요** (`dist/`는 `.gitignore`에 있음).

## 키 이름 (`.env`)

| 이름 | 용도 |
|---|---|
| `GEMINI_API_KEY` | 조건 분석·곰두리·학과 추천 |
| `DATA_GO_KR_KEY` | 공공데이터포털 (한국장학재단·보조금24·K-Startup·국가장학금 통계) |
| `DATA_GO_KR_KEY2` | 공공데이터포털 두 번째 계정 (Q-Net 시험일정·복지로) |
| `WORK24_KEY` | 고용24 일학습병행 |

## 알아 둘 점

- `scripts/deck/`와 `scripts/export-standalone.mjs`의 일부 저장 경로는 만든 사람의 PC 경로(`C:/Users/user/...`)로 되어 있습니다. 다른 PC에서는 경로 인자를 직접 넘기세요.
- 수집은 robots.txt·약관이 허용한 공개 페이지만, 1초 간격으로 합니다.
