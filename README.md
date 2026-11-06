# KNU 놓치지마

강원대학교 춘천·삼척캠퍼스 공지, 장학금, 공모전, 지역행사를 모아 보고 곰두리와 상담하는 웹 프로젝트입니다.

이 폴더는 GitHub 업로드용 전체 프로젝트입니다. 2026-11-06 배포 버전 47을 기준으로 정리했습니다.

## 폴더 구성

| 경로 | 내용 |
| --- | --- |
| dist/index.html | 브라우저에서 열 수 있는 최신 HTML |
| dist/ | 웹 스타일, 스크립트, 공개 데이터와 빌드된 서버 |
| src/ | 화면, 검색, 상담, 데이터 수집 및 빌드 코드 |
| worker/ | 계정, API 연동, 데이터 캐시, AI 상담 서버 코드 |
| drizzle/ | SQLite / Cloudflare D1 데이터베이스 마이그레이션 |
| data/ | 공개 공지·행사·외부 공고·자격 종목 저장본 |
| test/ | 기능 검증 테스트 |
| assets/ | 보관된 곰두리 이미지 원본과 웹 이미지 |
| .env.example | 환경변수 이름. 인증키는 빈 값 |
| wrangler.local.jsonc | 로컬 서버와 D1 설정 |
| docs/기존_개발기록.md | 이전 개발 과정과 출처를 기록한 문서 |
| .openai/hosting.json | 기존 Sites 배포 설정 |

## HTML 열기

`dist/index.html`을 더블클릭하면 화면을 열 수 있습니다. 실시간 데이터와 AI 상담은 현재 배포 서버를 호출하므로 인터넷 연결이 필요합니다. 로컬 파일의 계정 기능은 브라우저의 쿠키 정책에 따라 제한될 수 있습니다. 전체 기능은 아래 로컬 서버 또는 배포 사이트에서 확인하세요.

배포 주소 https://knu-esungan-preview-20261105.hydroai4.chatgpt.site/

## 개발 서버 실행

Node.js 22.13 이상과 pnpm을 사용하세요. 테스트는 Node의 내장 SQLite를 사용합니다.

```powershell
pnpm install
Copy-Item .env.example .dev.vars
```

`.dev.vars`에 사용할 API 인증키를 입력한 뒤 실행하세요.

```powershell
pnpm build
pnpm dlx wrangler@4 d1 migrations apply knu-local --local --config wrangler.local.jsonc
pnpm dlx wrangler@4 dev --local --config wrangler.local.jsonc
```

Wrangler가 출력하는 로컬 주소를 브라우저에서 여세요.

## 환경변수

| 이름 | 용도 |
| --- | --- |
| DATA_GO_KR_SERVICE_KEY | 장학금·장학통계·창업지원·복지로·국가자격 일정 공공데이터 API |
| DATA_GO_KR_SCHOLARSHIP_PATH | 장학금 최신 자료 경로를 바꿀 때 지정. 빈 값이면 코드의 기본 경로 사용 |
| TOUR_API_KEY | 관광공사·춘천·삼척 지역행사 API |
| GEMINI_API_KEY | 곰두리 생성형 AI 상담 |
| WORK24_TRAINING_API_KEY | 고용24 일학습병행 훈련과정 |
| GOV24_BENEFITS_API_KEY | 정부24 공공서비스 혜택 |

각 API는 해당 서비스 활용 승인이 필요합니다. 실제 값은 로컬 `.dev.vars` 또는 배포 서버의 비밀 설정에 저장하세요.

## 검증과 데이터 수집

```powershell
pnpm test
pnpm collect
pnpm watch
```

`pnpm collect`는 공개 게시판의 새 자료를 수집합니다. `pnpm watch`는 실행 중 15분마다 수집합니다. 원본 사이트 구조가 바뀌면 수집 코드를 조정해야 합니다.

화면의 정적 구조와 일부 로직은 `dist/index.html`에 직접 들어 있습니다. `src/build-worker.mjs`는 지정된 `src/` 클라이언트를 HTML에 넣고 `worker/` 서버를 `dist/server/index.js`로 빌드합니다. 화면 변경 시 이 구조를 확인하세요.

## GitHub에 올리기

GitHub에서 빈 저장소를 만든 뒤, 이 폴더에서 아래 명령을 실행하세요.

```powershell
git init
git add .
git commit -m "Initial commit: KNU 놓치지마"
git branch -M main
git remote add origin https://github.com/YOUR_ID/YOUR_REPOSITORY.git
git push -u origin main
```

`YOUR_ID`와 `YOUR_REPOSITORY`를 본인 정보로 바꾸세요. GitHub의 파일 업로드 화면을 쓰면 이 폴더 안의 파일과 하위 폴더를 올리면 됩니다. 숨김 파일인 `.env.example`, `.gitignore`, `.openai/`도 포함해야 하므로 Git 명령 사용을 권합니다.

계정과 서버 API는 Worker와 D1을 사용하는 구조입니다. GitHub는 소스 저장소로 사용하고, 서비스를 운영하려면 서버와 DB가 있는 호스팅에 배포하세요. GitHub Pages에서는 정적 화면을 제공할 수 있습니다.

## 데이터 출처

앱 맨 아래에 API·게시판별 출처와 원문 링크가 있습니다. 주요 출처는 강원대학교 공개 게시판, 위비티, 한국장학재단, 한국관광공사, 춘천시, 삼척시·삼척관광문화재단, 창업진흥원, 고용24, 정부24, 복지로, 큐넷입니다. 공개 데이터의 원문 조건과 개인정보를 구분해 사용하세요.
