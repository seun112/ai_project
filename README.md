# 생활비 관리 시스템

매달 쓸 총 금액을 먼저 정하고 분류별로 나눠 쓰면서 남은 돈과 초과분을 관리하는 웹 앱입니다.

- **완성작:** https://aiproject-v5el.vercel.app/

## 1. 제작한 것 소개

### 앱 소개

생활비 관리 시스템은 한 달에 쓸 돈을 정하고 지출을 기록하는 웹 앱입니다. 화면에는 "생활비 통장"이라는 이름으로 나옵니다. 매달 첫 접속 때 정산 창에서 지난달 결과를 처리하고 이번 달 총 금액을 분류별로 나눕니다. 그 뒤로는 대시보드에서 오늘 쓴 돈을 입력하고, 이번 달 남은 돈과 분류별 남은 돈을 바로 확인합니다.

### 해결하려는 문제

지출을 적기만 해서는 이번 달에 얼마가 남았는지, 어떤 분류를 넘겼는지 바로 알기 어렵습니다. 이 앱은 쓸 돈을 먼저 나눠 두고 남은 돈과 초과분을 한눈에 보여 줍니다. 지난달에 남거나 넘친 돈을 다음 달로 어떻게 넘길지도 매달 정하게 합니다.

### 주요 기능

- **로그인·회원가입:** 이메일과 비밀번호(8자 이상)를 씁니다. 확인 메일 없이 가입 즉시 로그인되고, 브라우저를 닫으면 로그아웃됩니다.
- **매달 첫 접속 정산 이벤트 창:** 1단계에서 지난달 남은 돈이나 초과분을 처리하고 총 금액을 정합니다. 2단계에서 분류별로 나눕니다. 끝내기 전에는 닫을 수 없습니다.
- **대시보드:** 오늘 지출 입력과 삭제, 오늘 쓴 돈, 이번 달 남은 돈, 저금통 잔액, 분류별 남은 돈을 보여 줍니다.
- **달력:** 날짜별 합계와 내역을 보고, 이번 달 오늘까지의 지출을 추가·수정·삭제합니다. 지난달은 볼 수만 있습니다.
- **설정:** 이번 달 총 금액과 분류별 배분을 고칩니다. 저장 전에 결과를 미리 보여 줍니다.

### 사용한 기술

| 구분 | 기술 |
|---|---|
| 화면 | HTML, CSS, JavaScript (프레임워크 없이 `index.html` 한 파일) |
| 글꼴 | Google Fonts의 Jua, Gowun Dodum |
| 로그인 | Supabase Auth |
| 데이터 저장 | Supabase PostgreSQL, Row Level Security, 저장 함수 `save_changes` |
| 라이브러리 | `@supabase/supabase-js` 2.118.0 (jsDelivr CDN) |
| 배포 | Vercel |
| 테스트 | Node.js 내장 테스트(`node:test`), Edge 또는 Chrome headless |

### 화면

| 로그인 | 회원가입 |
|---|---|
| ![로그인 화면](docs/screenshots/login.png) | ![회원가입 화면](docs/screenshots/signup.png) |

| 정산 창 1단계: 남은 돈 처리 | 정산 창 1단계: 초과 처리 |
|---|---|
| ![정산 창 1단계 남은 돈 처리](docs/screenshots/settle-leftover.png) | ![정산 창 1단계 초과 처리](docs/screenshots/settle-over.png) |

| 정산 창 2단계 | 대시보드 |
|---|---|
| ![정산 창 2단계 분류 배분](docs/screenshots/settle-allocate.png) | ![대시보드](docs/screenshots/dashboard.png) |

| 달력 | 설정 |
|---|---|
| ![달력](docs/screenshots/calendar.png) | ![설정](docs/screenshots/settings.png) |

스크린샷은 `tests/browser.mjs`와 가짜 Supabase 클라이언트로 예시 데이터를 넣어 찍었습니다.

### 실행 방법

**배포 주소에서 쓰기**

1. https://aiproject-v5el.vercel.app/ 에 접속합니다.
2. `회원가입` 탭에서 이메일과 비밀번호를 입력합니다.
3. 첫 달 정산 창에서 총 금액을 정하고 분류별로 나누면 시작됩니다.

**로컬에서 열기**

저장소를 내려받아 `index.html`을 브라우저로 엽니다. 설치와 빌드는 없습니다. 로컬에서 열어도 코드에 적힌 Supabase 프로젝트에 연결됩니다.

**테스트 실행**

```
node --test tests/utils.test.mjs
node tests/browser.mjs
```

- 첫 번째 명령은 계산, 검증, 저장 로직을 검사합니다.
- 두 번째 명령은 Edge 또는 Chrome을 headless로 띄워 화면 시나리오를 검사합니다. 실제 서버 대신 `tests/fake-supabase.js`를 쓰고, 스크린샷은 `tests/shots/`에 저장합니다.

**Supabase를 직접 설정할 때 필요한 것**

1. Supabase 프로젝트
2. Authentication의 Email 설정에서 Confirm email 끄기, 최소 비밀번호 길이 8
3. SQL Editor에서 `supabase/schema.sql` 전체를 한 번 실행
4. `index.html`의 `SUPABASE_URL`, `SUPABASE_KEY`에 자기 프로젝트의 Project URL과 공개용 키 넣기

비밀 키와 DB 비밀번호는 앱에 필요하지 않으며 저장소에 넣지 않습니다.

### 폴더 구조

```
.
├── index.html              앱 전체 (HTML, CSS, JS)
├── CLAUDE.md               작업 규칙
├── README.md               소개, PRD, Todo, 스킬
├── supabase/
│   └── schema.sql          테이블, Row Level Security, 저장 함수
├── tests/
│   ├── utils.test.mjs      로직 테스트
│   ├── browser.mjs         브라우저 실행 도구
│   ├── scenario.mjs        화면 시나리오
│   └── fake-supabase.js    테스트용 가짜 클라이언트
├── docs/
│   ├── design.md           화면 설계
│   ├── mockup.html         동작하는 화면 목업
│   ├── screenshots/        README 스크린샷
│   └── skills/             frontend-design 원문과 라이선스
└── .claude/skills/todo-commit-workflow/SKILL.md
```

## 2. PRD와 Todo 리스트

### 2-1. PRD

#### PRD: 생활비 관리 시스템

> 이 문서는 화면 설계(`docs/mockup.html`, `docs/design.md`)를 확정한 뒤 다시 쓴 버전이다.
> 처음 계획과 달라진 점은 `TODO.md`의 "변경 내역"에 모두 기록했다.

##### 1. 개요

- **목적**: 매달 쓸 수 있는 총 금액을 먼저 정하고, 분류별로 나눠 쓰면서 남은 돈과 초과분을 한눈에 관리하는 웹 앱
- **기준 화면**: 데스크톱 (좁은 화면에서 깨지지 않을 정도의 반응형만 지원)
- **계정**: 이메일과 비밀번호로 로그인한다. 이메일 확인 메일은 보내지 않고, 소셜 로그인은 없다.
- **저장**: 사용자별 데이터를 **DB**에 저장한다. (과제 필수 요건)
- **배포**: 서버에 **배포**해서 인터넷 주소로 접속한다. (과제 필수 요건)
- **개발 순서**: 화면과 기능은 먼저 브라우저 저장(localStorage)으로 만들고, 마지막에 로그인·DB·배포를 붙인다. 저장 코드는 `loadData`/`saveData` 한 곳에 모아 교체하기 쉽게 한다.
- **통화**: 원(₩), 정수만 허용

##### 2. 화면 구성

| 화면 | 언제 보이나 | 내용 |
|---|---|---|
| 로그인 / 회원가입 | 로그인하지 않았을 때 | 이메일, 비밀번호, 오류 안내 |
| 정산 이벤트 창 | 로그인 후, 그 달 정산이 끝나지 않았을 때 (매달 첫 접속) | 1단계 지난달 처리 + 총 금액, 2단계 분류 배분 |
| 대시보드 | 매일 쓰는 메인 | 오늘 지출 입력, 오늘 쓴 돈, 이번 달 남은 돈, 저금통 잔액, 분류별 남은 돈 |
| 달력 | 탭 | 날짜별 지출 합계, 선택한 날의 내역, 이번 달 지출 추가·수정·삭제, 지난달 열람 |
| 설정 | 탭 | 이번 달 총 금액과 분류별 배분 수정 |

- 상단 폴더 탭은 `대시보드`, `달력`, `설정` 세 개다.
- 로그아웃 버튼은 두지 않는다.

##### 3. 핵심 사용 흐름

1. 이메일과 비밀번호로 로그인한다. (처음이면 회원가입)
2. 그 달 첫 접속이면 **정산 이벤트 창**이 대시보드 위에 뜬다. 끝내기 전에는 닫을 수 없다.
3. 정산을 마치면 대시보드가 보이고, 매일 지출을 입력한다.
4. 달력으로 날짜별 지출을 보고 빠뜨린 지출을 넣거나 고치고, 설정에서 이번 달 금액을 고칠 수 있다.
5. 다음 달 첫 접속에서 2번으로 돌아간다.

##### 4. 기능 요구사항

###### FR-1. 로그인과 회원가입

- 이메일: **이메일 형식**이어야 한다. 대문자로 입력해도 소문자로 맞춰서 비교하고, 이미 가입된 이메일은 가입할 수 없다.
- 비밀번호: **8자 이상**. 회원가입에서는 한 번 더 입력해 같은지 확인한다.
- 오류는 해당 입력칸 아래에 빨간 글씨 한 줄로 보여주고, 그 칸의 테두리도 빨갛게 한다.

| 상황 | 안내 문구 |
|---|---|
| 이메일 비어 있음 | 이메일을 입력해 주세요. |
| 비밀번호 비어 있음 | 비밀번호를 입력해 주세요. |
| 이메일 형식이 아님 | 이메일 형식으로 입력해 주세요. |
| 이미 가입된 이메일로 가입 | 이미 가입된 이메일이에요. |
| 비밀번호 8자 미만 | 비밀번호는 8자 이상으로 만들어 주세요. |
| 비밀번호 확인 비어 있음 | 비밀번호를 한 번 더 입력해 주세요. |
| 비밀번호 확인이 다름 | 비밀번호가 서로 달라요. |
| 로그인 실패 (없는 이메일, 틀린 비밀번호) | 이메일 또는 비밀번호가 맞지 않아요. (두 칸 모두 빨간 테두리) |
| 서버 오류, 연결 실패 | 지금은 처리할 수 없어요. 잠시 후 다시 시도해 주세요. |

- 이메일 확인 메일은 보내지 않는다. (Supabase의 "Confirm email"은 끈다.) 가입에 성공하면 바로 로그인된 상태로 정산 창 또는 대시보드로 들어간다.
- 로그인 상태는 **브라우저를 닫으면 끝난다.** 다음에 열면 다시 로그인한다.
- 비밀번호는 Supabase Auth가 **암호화(해시)해서** 저장한다. 화면과 저장소 코드에 비밀번호를 그대로 두지 않는다.

###### FR-2. 정산 이벤트 창 (매달 첫 접속)

- 이번 달 정산이 끝나지 않았으면 대시보드 위에 어두운 막과 함께 뜬다. 닫기 버튼이 없고, 끝내야 닫힌다.
- 단계는 **1단계(지난달 처리 + 총 금액)** 와 **2단계(분류 배분)** 두 개다. 처음 쓰는 달도 같은 두 단계이고, 지난달 결과 부분만 없다.
- 입력 중인 값은 저장하지 않고 마지막 `저장하고 시작`에서 한 번에 기록한다. 중간에 새로고침하면 처음부터 다시 뜬다.

**1단계: 지난달 처리**

| 지난달 결과 | 화면 | 규칙 |
|---|---|---|
| 남은 돈이 있음 (+) | `10월 남은 돈 +○원` 아래에서 `저금통에 저축`과 `다음 달로 이월` 금액을 입력 | **저축 + 이월 = 남은 금액**이어야 `다음`이 활성화된다. 다르면 총 금액 아래에 안내가 나온다. |
| 초과 지출 (−) | `10월 초과 지출 −○원` 아래에서 아래 셋 중 하나 선택 (라디오) | 아래 표 참고 |
| 처음 쓰는 달 | "처음 쓰는 달이라 지난달 결과가 없어요." 안내만 | 총 금액만 정한다. |
| 0원으로 딱 맞음 | 지난달 처리 부분 없이 총 금액만 | 총 금액만 정한다. "처음 쓰는 달" 안내 문구는 보이지 않는다. |

초과 처리 선택지:

| 선택 | 저금통에서 | 다음 달 총 금액에서 | 기록 |
|---|---|---|---|
| 다음 달 총 금액에서 차감 | 0 | 초과분 전체 | 없음 |
| 그냥 두기 | 0 | 0 | 미정산 금액으로 기록만 남김 (다음 달 예산에는 영향 없음) |
| 저금통에서 차감하고 나머지는 다음 달에서 차감 | `p`원 | `초과 − p`원 | 없음 |

- `p`는 저금통 잔액과 초과분 중 작은 값 이하여야 한다.
- 저금통에서 뺄 금액 입력칸은 세 번째 선택지를 골랐을 때만 열린다.

**1단계: 이번 달 총 금액**

- `기본 금액`을 입력하면 `지난달에서 이월`, `지난달 초과분 차감`과 함께 계산해서 이중선 아래에 크게 보여준다.
- `이번 달 총 금액 = 기본 금액 + 이월액 − 차감액`, **1원 이상**이어야 한다.

**2단계: 분류별 배분**

- 분류마다 금액을 입력한다. 빈칸은 0원으로 본다.
- 배분 합계와 **아직 나누지 않은 금액**을 입력할 때마다 보여준다. 총 금액보다 많이 나누면 `-`로 표시하고 빨간색으로 보인다.
- **합계 = 총 금액**일 때만 `저장하고 시작`이 활성화된다.
- 금액이 올바르지 않을 때만(소수점, 음수, 글자) 입력칸 테두리와 안내가 나온다.
- 분류 추가와 삭제는 FR-8에 따른다.
- `이전`으로 1단계에 돌아가도 입력값은 유지된다.

###### FR-3. 지출 입력·수정·삭제

- 입력 항목: **분류**(칩으로 하나 선택), **금액**(원 정수, 1원 이상), **메모**(선택, 30자 이내)
- **대시보드**: 오늘 날짜로만 입력한다. (날짜 선택 없음) 오늘 쓴 내역 목록에서 `×` 버튼으로 삭제할 수 있다.
- **달력**: 이번 달에서 **오늘까지의 날짜**를 선택하면 그날의 지출을 **추가, 수정, 삭제**할 수 있다. (FR-5 참고) 빠뜨린 지출을 나중에 넣거나 잘못 넣은 지출을 고칠 때 쓴다.
- 오늘 이후(미래) 날짜와 지난달 이전 기록은 추가, 수정, 삭제 모두 할 수 없다.
- 분류 배분액을 넘겨도 입력은 허용한다.
- Enter 키로도 추가·저장된다.

###### FR-4. 대시보드

- **오늘 쓴 돈**: 오늘 입력한 지출의 합계
- **오늘 지출 입력**과 **오늘 내역** (FR-3)
- **이번 달 남은 돈**: 가장 크게 보여주는 숫자. 음수면 `-`와 빨간색. 아래에 사용 비율 막대와 "총 ○원 중 ○원 사용", "○% 썼어요"
- **저금통 잔액**: 숫자만 보여준다. (버튼 없음)
- **분류별 남은 돈**: 분류마다 남은 금액, 막대, "배분 ○원 · 사용 ○원". 초과한 분류는 `-○원`, 빨간색, `초과` 라벨을 같이 붙여 색만으로 구분하지 않게 한다.
- 정산에서 "그냥 두기"로 기록된 **미정산 금액은 화면에 보여주지 않는다.** (데이터에만 남긴다.)

###### FR-5. 달력

- 월 달력, **월요일부터 일요일** 순서
- **모든 날짜 칸**에 그날의 총 사용 금액을 보여준다. 쓴 돈이 없는 날은 연하게 `0`. 지출이 있는 날은 연두색 칸, 오늘은 굵은 테두리와 `오늘` 표시
- 날짜를 누르면 **오른쪽**에 그날의 합계와 내역(분류, 메모, 금액)이 나온다. 좁은 화면에서는 달력 아래로 내려간다.
- **이번 달, 오늘까지의 날짜**:
  - 내역마다 연필(수정)과 `×`(삭제) 버튼이 있다.
  - 수정을 누르면 그 줄이 `지출 수정` 상자로 바뀐다. 분류, 금액, 메모를 고치고 `저장` 또는 `취소`한다.
  - 내역 아래의 `이 날 지출 추가` 상자에서 분류, 금액, 메모를 넣고 `추가`한다.
  - 금액 오류는 입력칸 아래에 안내한다. (FR-3의 입력 규칙과 같다.)
  - 저장·추가·삭제하면 달력 칸의 합계, 이 달 쓴 돈, 이번 달 남은 돈, 대시보드가 바로 바뀐다.
- **미래 날짜**: 날짜 칩과 `0원`, "이 날은 쓴 돈이 없어요.", "아직 오지 않은 날이에요.", 맨 아래 `이번 달 남은 돈`이 보인다. 연필·`×` 버튼과 `이 날 지출 추가` 상자는 없다.
- 위쪽에 `<`, `>` 버튼과 "이 달 쓴 돈". 데이터가 있는 가장 이른 달 이전과 이번 달 이후로는 넘어갈 수 없다.
- 이번 달: 오른쪽 아래에 "이번 달 남은 돈"을 보여준다.
- 지난달: **읽기 전용**이고 "지난달 기록 · 볼 수만 있어요" 라벨을 보여준다. 추가·수정·삭제 버튼과 입력 상자가 없다.

###### FR-6. 설정 (이번 달 금액 수정)

- `이번 달 총 금액`과 분류별 배분을 고칠 수 있다.
- 분류마다 "사용 ○원"을 같이 보여준다.
- 아직 나누지 않은 금액이 **0원**이고, 총 금액이 **1원 이상**이고, **바뀐 내용이 있을 때**만 `저장`이 활성화된다. 안내 문구로 이유를 보여준다. (예: "50,000원을 더 나눠야 저장할 수 있어요.", "바꾼 내용이 없어요.")
- 이미 쓴 금액보다 적게 배분하거나 총 금액을 이미 쓴 돈보다 적게 정해도 저장된다. 그 분류와 남은 돈은 `-`로 표시된다.
- 오른쪽 미리보기에 `현재 ○원 → 변경 ○원`과 바뀐 이번 달 남은 돈을 보여준다.
- 지난달 기록은 수정할 수 없다. ("지난달 기록은 수정할 수 없어요" 라벨)
- 저장하면 대시보드로 돌아가고, 이미 쓴 지출은 그대로 남는다.
- `취소`는 저장하지 않고 대시보드로 돌아간다.

###### FR-7. 저금통

- 저금통은 **정산 이벤트 창에서만** 변한다. (남은 돈 저축, 초과분 차감)
- 대시보드에 잔액만 보여준다. 저금통 화면과 `사용하기`는 없다.
- 정산 때 일어난 저축과 차감은 내역으로 기록한다. (`save`, `deficit`)

###### FR-8. 분류 관리 (정산 이벤트 창 2단계)

- 기본 분류: **식비, 의류, 취미, 교통, 기타** 다섯 개
- **추가**: 이름을 입력하고 `분류 추가`. 빈 이름, 10자 초과, 이미 있는 이름은 안내와 함께 막는다.
- **삭제**: 분류 옆 `×` 버튼을 누르면 "○○ 분류를 삭제할까요?" 확인이 나오고, 확인하면 삭제된다. 분류가 하나 남으면 삭제할 수 없다.
- 삭제한 분류는 **이번 달부터** 목록에서 빠지고, 이미 쓴 내역은 지난 기록에 그대로 남는다. 지출 내역이 있는 분류는 실제로 지우지 않고 숨김 처리한다.
- 설정 화면에서는 분류를 추가·삭제하지 않는다. (금액만 수정)

##### 5. 계산 규칙

```
총 잔액     = 이번 달 총 금액 − 이번 달 전체 지출 합계
분류 잔액   = 분류 배분액 − 분류 지출 합계   (초과 시 음수)
총 금액     = 기본 금액 + 이월액 − 차감액
```

- 잔액은 **저장하지 않고 매번 계산**한다.
- 분류 초과분은 총 잔액에서 자동으로 감액된다. (분류 잔액의 합 = 총 잔액)
- 이월금은 총 금액에만 더해지고, 분류 배분은 매달 새로 한다.
- 달력과 대시보드의 이번 달 계산은 **이번 달 날짜의 지출만** 합친다.

예시: 총 100만 원, 식비 40만 / 의류 60만 배분 → 식비 45만, 의류 10만 지출
→ 식비 잔액 **−5만**, 의류 잔액 **+50만**, 총 잔액 **45만**

##### 6. 예외 상황

| 상황 | 처리 |
|---|---|
| 처음 쓰는 달 (이전 정산 없음) | 지난달 처리 없이 총 금액만 정한다. |
| 한 달 이상 건너뛰고 접속 | 비어 있는 달은 지출 0원, 총 금액 미설정으로 자동 마감하고, 마지막으로 정산된 달의 결과만 정산 대상으로 한다. |
| 정산 도중 새로고침 | 정산이 끝나지 않은 상태로 유지되고 창이 처음부터 다시 뜬다. |
| 금액에 소수점, 음수, 문자 입력 | 입력을 거부하고 해당 칸 아래에 안내한다. |
| 저장 실패 (네트워크 오류 등) | 화면 위에 "저장하지 못했습니다" 안내를 띄우고, 다음 저장 때나 인터넷이 돌아오면 다시 보낸다. |
| 데이터 불러오기 실패 | "데이터를 불러오지 못했어요" 안내와 `다시 시도` 버튼만 보여 준다. 데이터를 지우는 초기화 기능은 두지 않는다. |

##### 7. 데이터 모델

```js
{
  users: [{ id, email, createdAt }],                        // Supabase Auth가 관리, 비밀번호 해시는 Supabase에만 저장
  categories: [{ id, userId, name, hidden }],
  months: {
    "2026-11": {
      userId, baseAmount, carryIn, deduction, total,
      allocations: { [categoryId]: amount },                 // 합 = total
      settled: true
    }
  },
  expenses: [{ id, userId, date: "2026-11-14", categoryId, amount, memo }],
  piggy: {
    userId, balance,
    history: [{ id, date, type: "save|deficit", amount, memo }]
  },
  unsettled: [{ userId, month: "2026-10", amount }]
}
```

- 모든 데이터는 `userId`로 구분하고, 다른 사용자의 데이터는 읽거나 쓸 수 없다.
- 개발 단계의 브라우저 저장에서는 계정마다 따로 저장한다.

##### 8. 비기능 요구사항

- 데스크톱 브라우저 기준. 창을 좁혀도 가로 스크롤이 생기거나 글자가 겹치지 않는 정도로만 대응한다.
- 금액은 천 단위 쉼표와 `원`을 붙여 표시한다. (예: `1,200,000원`)
- 글꼴은 Google Fonts의 `Jua`(제목, 강조 숫자)와 `Gowun Dodum`(본문)을 쓰고, 불러오지 못하면 `Malgun Gothic`으로 대신한다.
- 키보드 포커스가 보여야 하고, 오류와 안내는 색만이 아니라 글자로도 전달한다.
- DB 접속 비밀번호, 서비스 키 같은 비밀 값은 **저장소에 올리지 않고** 호스팅 서비스의 환경 변수로 넣는다. (`.env`는 `.gitignore`)
- 서버에 배포해 인터넷 주소로 접속할 수 있어야 한다.

##### 9. 범위 제외

- 주간 화면과 주간 합계
- 저금통 화면, 저금통 `사용하기`
- 로그아웃 버튼, 소셜 로그인, 이메일 인증, 비밀번호 찾기
- 지난달 데이터 수정
- 대시보드에서 오늘이 아닌 날짜로 입력 (다른 날짜는 달력에서 한다)
- 미정산 금액을 보여주는 화면
- 설정 화면에서의 분류 추가·삭제와 이름 수정
- 모바일 전용 화면
- 소수점 금액, 외화
- 분류별 이월
- (선택) 백업 JSON 내보내기·가져오기 — 시간이 남을 때만

##### 10. 수용 기준 (테스트 시나리오)

1. 이메일 형식이 아니면 가입과 로그인이 막힌다. 대문자로 입력해도 같은 이메일로 처리된다.
2. 이미 가입된 이메일로 가입할 수 없고, 비밀번호가 8자 미만이거나 확인과 다르면 가입할 수 없다. 가입하면 확인 메일 없이 바로 로그인된다.
3. 틀린 비밀번호로 로그인하면 "이메일 또는 비밀번호가 맞지 않아요."가 나온다.
4. 다른 계정으로 로그인하면 그 계정의 데이터만 보인다.
5. 매달 첫 접속에서만 정산 창이 뜨고, 끝내기 전에는 닫을 수 없다.
6. 남은 돈은 저축 + 이월 = 남은 금액일 때만 다음으로 넘어가고, 저금통 잔액과 다음 달 총 금액에 각각 반영된다.
7. 초과 처리 세 가지가 각각 맞게 반영된다. 저금통 + 다음 달 차감은 합이 초과분과 같고, 저금통에서 뺄 금액은 잔액이나 초과분보다 클 수 없다.
8. 분류 합계가 총 금액과 다르면 `저장하고 시작`이 비활성이다.
9. 분류를 추가·삭제할 수 있고, 빈 이름·10자 초과·중복 이름은 막힌다. 삭제 전에 확인이 나온다.
10. 분류 초과 지출을 입력하면 해당 분류가 `-`와 `초과`로 표시되고 이번 달 남은 돈이 그만큼 줄어든다.
11. 대시보드의 오늘 내역에서 지출을 삭제하면 오늘 쓴 돈과 남은 돈이 바로 바뀐다.
12. 달력의 모든 날짜 칸에 그날 합계가 보이고, 날짜를 누르면 오른쪽에 내역이 나온다.
13. 지난달 달력은 볼 수만 있고, 지난달 지출은 추가·삭제·수정할 수 없다. 오늘 이후 날짜에는 입력 상자가 없다.
14. 설정에서 총 금액과 배분을 고칠 수 있고, 합계가 맞을 때만 저장된다. 이미 쓴 돈보다 적게 배분해도 저장되며 초과로 표시된다.
15. 두 달 이상 건너뛰고 접속해도 마지막 정산 달 기준으로 정산이 진행된다.
16. 배포한 주소에서 같은 기능이 그대로 동작하고, 새로고침해도 데이터가 DB에서 다시 불러와진다.
17. 달력에서 이번 달의 오늘까지 날짜에 지출을 추가·수정·삭제할 수 있고, 달력 칸 합계와 이번 달 남은 돈, 대시보드가 바로 바뀐다. 금액을 잘못 넣으면 안내가 나온다.

##### 11. 아직 정하지 못한 것

- **DB·서버 구조 (확정)**: 과제 안내문을 확인해 직접 만든 서버 없이 **DB와 로그인은 Supabase, 배포는 Vercel**을 쓴다. 제출은 GitHub 저장소로 하고 README에 완성작 링크를 올린다.
- **비밀번호를 잊었을 때**: 비밀번호 찾기가 없다.

### 2-2. Todo 리스트

#### Todo 리스트

> 처음 계획은 `docs/initial-todo.md`에 그대로 보존했다. 이 파일은 **화면 설계를 확정한 뒤 다시 짠 현재 계획**이고, 처음 계획과 달라진 점은 맨 아래 "변경 내역"에 모두 적는다.
> 계획이 바뀌면 이 파일의 변경 내역도 **같은 커밋**에 포함한다.

##### 진행 규칙

- 작업 단위마다 커밋하고, 푸시는 아래 **푸시 시점**마다 한다. 푸시는 사용자가 확인한 뒤에만 한다.
- 커밋 메시지 형식: `<타입>: <무엇을 왜 했는지>`
  - 타입: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  - 예: `feat: 분류 배분 합계 검증 추가 (총 금액과 불일치 시 저장 차단)`
- 끝낸 항목의 체크박스, 해당 테스트, 변경 내역을 같은 커밋에서 갱신한다.
- **화면은 `docs/mockup.html`을 기준으로 구현한다.** 디자인이나 화면 구성을 바꾸고 싶으면 먼저 사용자에게 물어본다.

##### 구현 기준 문서

| 파일 | 내용 |
|---|---|
| `PRD.md` | 기능 요구사항, 계산 규칙, 수용 기준 |
| `docs/design.md` | 화면별 구성, 디자인 토큰, 문구 |
| `docs/mockup.html` | 동작하는 화면 목업 (구현 기준) |
| `docs/initial-todo.md` | 처음 계획 (비교용, 수정하지 않음) |

##### 현재 Todo

###### T0. 프로젝트 준비 (푸시 1) ✔
- [x] Git 저장소 초기화, `.gitignore`
- [x] `PRD.md`, `TODO.md` 추가
- [x] `README.md` 뼈대
- [x] 커밋 규칙, 스킬 계획 정리
- [x] `todo-commit-workflow` 스킬 제작

###### T1. 데이터 모델과 저장 (푸시 2) ✔
- [x] `index.html` 기본 골격 (HTML, CSS, JS 한 파일)
- [x] 데이터 구조 정의 (categories, months, expenses, piggy, unsettled)
- [x] localStorage 저장/불러오기, 버전 필드
- [x] 금액 검증 유틸 (원 단위 정수만), 금액 포맷 유틸
- [x] 월/주 계산 유틸 (월~일 기준)

###### T2. 정산 흐름 (푸시 3) ✔
- [x] 새 달 첫 접속 감지, 정산 창 자동 실행
- [x] 첫 실행 시 지난달 결과 단계 건너뛰기
- [x] 총 금액 설정 (기본 금액 + 이월 − 차감, 1원 이상)
- [x] 분류별 배분 입력, 미배분 금액 실시간 표시
- [x] 합계 검증 (합계 ≠ 총 금액이면 저장 차단)
- [x] 기본 분류에 `교통` 추가 (식비·의류·취미·교통·기타)
- [x] 정산 창에서 분류 추가·삭제 (삭제 확인, 이름 1~10자, 중복 불가, 최소 1개 유지)

###### T3. 화면 틀·디자인 적용과 정산 이벤트 창 전환 (푸시 4) ✔
- [x] `docs/mockup.html` 기준 디자인 적용 (색 변수, 글꼴, 체크 바탕, 바인더 노트 틀, 폴더 탭 `대시보드/달력/설정`)
- [x] 기존 종이 통장 디자인 교체
- [x] 정산 마법사를 **매달 첫 접속 이벤트 창**으로 전환 (대시보드 위, 닫기 불가, 1단계/2단계)
- [x] 1단계 지난달 남은 돈 처리 화면 (저축 + 이월 = 남은 금액 검증, 오류 안내)
- [x] 1단계 지난달 초과 처리 화면 (선택 3가지, 저금통 차감 입력과 한도 검증)
- [x] 처음 쓰는 달 화면 (지난달 결과 없이 총 금액만)
- [x] 데스크톱 기준 레이아웃, 좁은 화면에서 깨지지 않는 반응형
- [x] 기존 `tests/`를 새 화면에 맞게 수정

###### T4. 대시보드 (푸시 5) ✔
- [x] 오늘 지출 입력 (분류 칩, 금액, 메모), 오늘 날짜로만 기록
- [x] 오늘 쓴 돈, 오늘 내역 목록과 삭제 `×` (수정은 달력에서)
- [x] 이번 달 남은 돈 (큰 숫자, 사용 비율 막대, 음수는 `-`와 빨간색)
- [x] 분류별 남은 돈 (막대, 배분·사용, 초과 시 `-`와 `초과` 라벨)
- [x] 저금통 잔액 표시 (숫자만)
- [x] 이번 달 지출만 합산, 지난달 기록 잠금

###### T5. 달력 (푸시 6) ✔
- [x] 월 달력 (월~일), 모든 날짜 칸에 그날 합계(없으면 `0`), 오늘 표시
- [x] 날짜 선택 시 오른쪽에 그날 합계와 내역
- [x] `<`/`>` 달 이동 (가장 이른 달 이전, 이번 달 이후 막음)
- [x] 이번 달 남은 돈 표시, 지난달은 읽기 전용 라벨
- [x] 이번 달 오늘까지의 날짜: 내역마다 수정(연필)·삭제(`×`) 버튼, `지출 수정` 상자(저장/취소)
- [x] 이번 달 오늘까지의 날짜: `이 날 지출 추가` 상자, 금액 오류 안내
- [x] 미래 날짜는 입력 없이 "아직 오지 않은 날이에요.", 지난달은 버튼·입력 모두 없음
- [x] 추가·수정·삭제가 달력 칸 합계, 남은 돈, 대시보드에 바로 반영되는 테스트

###### T6. 설정: 이번 달 금액 수정 (푸시 7) ✔
- [x] 총 금액과 분류별 배분 수정, 사용 금액 표시
- [x] 저장 조건 검증 (미배분 0원, 총 금액 1원 이상, 바뀐 내용 있음)과 안내 문구
- [x] 이미 쓴 돈보다 적게 정해도 저장, 초과로 표시
- [x] 저장 전 미리보기(`현재 → 변경`, 바뀐 남은 돈), 취소, 지난달 수정 불가 라벨

###### T7. 월 정산 결과 반영 (푸시 8) ✔
- [x] 남은 돈: 저금통 저축 + 다음 달 이월 반영
- [x] 초과 지출: 다음 달 차감 / 그냥 두기(미정산 기록) / 저금통 차감 + 나머지 다음 달 차감
- [x] 저금통 잔액·내역(`save`, `deficit`) 기록
- [x] 건너뛴 달 자동 마감
- [x] 위 규칙의 단위 테스트

###### T8. 로그인과 회원가입 (푸시 9) ✔
- [x] 로그인/회원가입 화면 (비밀번호 8자 이상, 비밀번호 확인. 처음에는 아이디로 구현했고 T9에서 이메일로 변경)
- [x] 오류 안내 (입력칸 아래 빨간 글씨, 빨간 테두리)
- [x] 로그인 후 정산 창 또는 대시보드로 이동, 로그아웃 버튼 없음
- [x] 계정별 데이터 분리 (브라우저 저장 단계)

###### T9. Supabase 연결 (푸시 10)
- [x] 로그인 입력을 아이디에서 이메일로 변경하고 테스트 수정
- [x] Supabase 프로젝트 준비 (Confirm email 끄기)
- [x] 분류·월·지출·저금통·미정산 테이블 설계와 Row Level Security
- [x] Supabase Auth로 회원가입·로그인 교체 (비밀번호 해시는 Supabase가 저장, 사용자별 접근 제한)
- [x] `loadData`/`saveData`를 Supabase 호출로 교체, 저장 실패 안내
- [x] 비밀 키와 DB 비밀번호는 저장소에 올리지 않기, `.env`는 `.gitignore`에 추가

###### T10. Vercel 배포 (푸시 11)
- [x] GitHub 저장소를 Vercel에 연결하고 배포 설정
- [x] 배포 주소에서 PRD 수용 기준 점검
- [x] 배포 주소와 접속 방법을 README에 기록

###### T11. 테스트와 다듬기 (푸시 12)
- [x] PRD 수용 기준 17개 시나리오 점검
- [x] 월 전환 시나리오 테스트 (날짜를 바꿔서 검증)
- [x] 버그 수정, 접근성(키보드 포커스, 색만으로 구분하지 않기) 점검
- [x] 주간 뷰 삭제로 쓰이지 않는 코드(`weeksOfMonth` 등) 정리
- [ ] (선택) 백업 JSON 내보내기·가져오기

###### T12. 문서 마무리 (최종 푸시)
- [x] README 1차 작성(소개, PRD·Todo, 스킬)
- [x] 완성작 링크와 최종 스크린샷 반영
- [ ] 느낀 점(직접 작성)

##### 사용한 스킬

| 스킬 | 구분 | 용도 |
|---|---|---|
| `frontend-design` | 기존 스킬 | 처음 화면 방향과 타이포를 잡는 데 참고. 최종 디자인은 사용자가 고른 레퍼런스(연두색 노트·미니홈피 느낌)를 기준으로 바뀜 |
| `todo-commit-workflow` | 직접 제작 | Todo 완료 시 변경 내역 기록과 커밋 메시지 작성을 같은 절차로 반복 |

##### 변경 내역 (처음 계획 대비)

| 시점 | 구분 | 항목 | 변경 내용 | 이유 |
|---|---|---|---|---|
| T0 | 추가 | 세부 규칙 2건 확정 | PRD 10장에 기록: ① 저축+이월은 남은 금액 전액 배분 ② 저금통 차감 후 남은 초과분은 자동으로 다음 달 차감 | 처음 설명에 없던 세부 규칙을 사용자 확인 후 명시하기 위해 |
| T0 | 변경 | 저장소 초기화 | 새로 초기화하지 않고 원격 `main` 이력 위에서 시작 | 원격에 이미 커밋과 README가 있어서 |
| T0 | 변경 | PRD 초과분 규칙 | PRD FR-1과 10장을 자동 다음 달 차감으로 수정 | PRD와 TODO의 내용이 달라서 |
| T0 | 변경 | README | 뼈대로 교체하고, T8에서 PRD 전문과 초기 Todo(`docs/initial-todo.md`)를 README에 직접 포함 | README 하나에서 PRD와 처음 계획을 바로 볼 수 있게 하기 위해 (※ 문서 단계는 설계 변경으로 T12로 번호가 바뀜) |
| T0 | 추가 | 스킬 제작 | T0에 `todo-commit-workflow` 스킬 제작 항목을 추가하고 `SKILL.md` 작성 | 스킬 제작을 T0에서 끝내기로 해서 |
| T1 전 | 추가 | 초기 Todo 보존 | 첫 커밋의 계획을 `docs/initial-todo.md`로 저장 | 처음 계획과 현재 Todo를 비교할 수 있게 하기 위해 |
| T1 전 | 추가 | 스킬 원문 보존 | `frontend-design` 원문과 라이선스를 `docs/skills/`에 저장 | 플러그인 설치 없이 저장소에서 참고한 스킬을 확인할 수 있게 하기 위해 |
| T1 | 변경 | 손상 데이터 복구 | T1에는 초기화만 넣고, 백업 JSON 가져오기는 T7에서 구현할 때 이 오류 화면에 연결 | JSON 가져오기가 T7의 선택 항목이라서 (※ 선택 항목은 현재 T11) |
| T1 후 | 추가 | 검증 스크립트 | 임시 폴더의 유틸 테스트와 브라우저 확인 스크립트를 `tests/`로 옮겨 커밋 | T1 계획은 커밋하지 않기로 했지만, 저장소에서 같은 검증을 다시 실행할 수 있게 하기 위해 |
| 설계 확정 | 추가 | 화면 설계와 목업 | 화면을 먼저 설계하고 동작 목업(`docs/mockup.html`)과 화면 문서(`docs/design.md`)를 구현 기준으로 추가 | 구현 전에 화면을 사용자가 직접 보고 정하기 위해 |
| 설계 확정 | 변경 | 정산 마법사 → 정산 이벤트 창 | 전체 화면 마법사 대신 **매달 첫 접속에만** 대시보드 위에 뜨는 창으로 바꿈. 닫기 버튼이 없어 끝내야 닫힘 | 정산은 한 달에 한 번이고, 매일 쓰는 메인 화면이 따로 필요해서 |
| 설계 확정 | 변경 | 정산 단계 구성 | "지난달 결과 → 총 금액 → 배분" 3단계를 **1단계(지난달 처리 + 총 금액), 2단계(분류 배분)** 로 합침. 처음 쓰는 달은 지난달 부분만 빠짐 | 지난달 처리 결과가 총 금액에 바로 반영되는 걸 한 화면에서 보며 정하려고 |
| 설계 확정 | 변경 | 디자인 | 종이 통장(옅은 청록·소나무색) → **연두색 체크 바탕 + 바인더 노트 + 폴더 탭 + 토마토 캐릭터**, 글꼴 `Jua`/`Gowun Dodum` | 사용자가 고른 레퍼런스(미니홈피·노트 느낌)를 따르기 위해 |
| 설계 확정 | 변경 | 기준 화면 | 모바일 시안을 빼고 **데스크톱 기준**으로 변경, 좁은 화면은 깨지지 않는 정도만 지원 | 사용자 결정 |
| 설계 확정 | 추가 | 분류 | 기본 분류에 **교통** 추가 (식비·의류·취미·교통·기타) | 사용자 요청 |
| 설계 확정 | 추가 | 분류 추가·삭제 | 정산 창 2단계에서 분류를 추가·삭제 (삭제 확인, 이름 10자 이하·중복 불가, 최소 1개 유지) | 사용자 요청 |
| 설계 확정 | 변경 | 분류 관리 위치 | 설정 화면의 분류 관리(처음 FR-7) 대신 정산 창에서 추가·삭제. 이름 수정과 설정 화면 관리는 제외 | 분류는 매달 정산할 때 정하는 흐름으로 정리해서 |
| 설계 확정 | 삭제 | 주간 뷰 | 주간 화면과 주간 합계 삭제 (처음 T4의 주간 뷰, FR-5). 달력만 남김 | 사용자 결정 |
| 설계 확정 | 변경 | 저금통 | 저금통 화면과 `사용하기` 삭제. 정산 창의 저축·차감만 유지하고 대시보드에 **잔액만** 표시 | 사용자 결정 |
| 설계 확정 | 변경 | 설정 화면 | 설정을 분류 관리 화면에서 **이번 달 총 금액·분류 배분 수정** 화면으로 바꿈. 합계가 맞고 바뀐 내용이 있을 때만 저장, 이미 쓴 돈보다 적게 정해도 저장하며 초과로 표시, 지난달은 수정 불가 | 한 달 중간에 예산을 고치고 싶어서 (사용자 요청) |
| 설계 확정 | 변경 | 대시보드 | 처음 계획의 "총 잔액·분류별 잔액 보기"를 **오늘 지출 입력, 오늘 쓴 돈, 이번 달 남은 돈, 저금통 잔액, 분류별 남은 돈**이 있는 메인 화면으로 구체화 | 매일 입력하고 확인하는 화면이 필요해서 (사용자 요청) |
| 설계 확정 | 변경 | 지출 입력 방식 | 처음 계획의 "날짜를 고르는 입력·수정·삭제"를 둘로 나눔. **대시보드**는 오늘 날짜로만 입력하고 오늘 내역 삭제만, **달력**에서는 이번 달 오늘까지의 날짜에 지출을 **추가·수정·삭제** (오늘 이후와 지난달은 불가) | 대시보드는 오늘 쓴 돈을 빠르게 입력하는 화면으로 두고, 빠뜨린 지출과 수정은 달력에서 하게 하려고 (사용자 결정) |
| 설계 확정 | 삭제 | 미정산 금액 화면 표시 | 처음 계획의 "대시보드에 미정산 금액 표시"를 삭제. "그냥 두기"로 기록한 미정산 금액은 데이터에만 남김 | 화면 설계에서 대시보드에 넣지 않기로 해서 |
| 설계 확정 | 변경 | 달력 | 달력 칸마다 그날 합계(없으면 `0`)를 보여주고, 날짜를 누르면 오른쪽에 내역과 `이 날 지출 추가`. 지난달은 읽기 전용 | 사용자 요청 |
| 설계 확정 | 변경 | 안내 문구 정리 | 정산·설정·달력 화면의 설명 문구 일부 삭제 (예: "그냥 두기" 설명 괄호, 합계 안내 줄, 이월·저축 빠른 입력 버튼, 분류 삭제 안내 문구) | 화면을 간결하게 하려는 사용자 결정 |
| 설계 확정 | 추가 | 로그인·회원가입 | **아이디(영문·숫자만) + 비밀번호(8자 이상)** 로그인, 소셜 로그인 없음, 로그아웃 버튼 없음, 오류는 입력칸 아래 빨간 글씨 | 사용자 요청 (DB에 사용자별 데이터를 저장하기 위해 필요) |
| 설계 확정 | 추가 | DB와 서버 배포 | 처음 계획의 "서버/DB 없이 브라우저 저장(localStorage)"을 바꿔 **DB 연결(T9)과 서버 배포(T10)** 추가. 화면·기능은 먼저 브라우저 저장으로 만들고 마지막에 붙임 | 과제 필수 요건 |
| 설계 확정 | 변경 | 일정 번호 | 처음 T2~T8을 **T2~T12**로 다시 번호 매김 (처음 T3 지출→T4 대시보드, T4 달력·주간→T5 달력, T5 저금통→삭제, T6 월말 정산→T7, T7 테스트→T11, T8 문서→T12) | 위 변경으로 단계가 늘고 줄어서 |
| 설계 확정 | 변경 | 월/주 계산 유틸 | T1에서 만든 `weeksOfMonth`는 주간 뷰 삭제로 쓰일 곳이 거의 없음. 달력은 월~일 배치만 사용. 정리는 T11에서 | 주간 뷰 삭제 |
| T8 | 추가 | 로그인 유지 기간 | PRD 11장의 미정 항목을 **브라우저를 닫으면 로그아웃**으로 확정하고 FR-1로 옮김 (`sessionStorage` 사용) | 로그아웃 버튼이 없어서 계정을 바꾸려면 유지 기간이 필요했고, T8 시작 전에 사용자가 결정 |
| T8 | 추가 | 브라우저 단계 비밀번호 해시 | 서버가 없는 T8에서도 비밀번호를 PBKDF2로 해시해 저장. T9에서 서버 해시로 교체 | PRD가 저장소에 비밀번호 원문을 두지 못하게 해서 |
| T9 전 | 변경 | 로그인 방식 | 아이디(영문·숫자) → 이메일 주소, 이메일 확인 메일 없음 | Supabase 기본 로그인 방식에 맞추고 아이디를 이메일로 바꾸는 우회를 없애려고 |
| T9 전 | 변경 | DB·서버 구조 | 직접 서버 대신 Supabase와 Vercel을 쓰는 걸로 확정, 제출은 GitHub 저장소 + README 링크 | 과제 요건 확인 |
| T9 | 추가 | 서버 오류 문구 | FR-1에 "서버 오류, 연결 실패" 안내 추가, 응답을 기다리는 동안 버튼 비활성 | 로그인이 네트워크를 타면서 연결 실패를 "비밀번호가 틀렸다"로 잘못 안내하지 않으려고 |
| T9 | 삭제 | 브라우저 단계 비밀번호 해시 | T8의 PBKDF2 해시와 브라우저 계정 목록 삭제 | Supabase Auth가 계정과 비밀번호 해시를 맡아서 |
| T9 | 변경 | 손상 데이터 복구 | `데이터 초기화`와 두 번 확인을 삭제하고 "데이터를 불러오지 못했어요" + `다시 시도`로 교체. 버전 필드와 형식 검사도 삭제 | 서버 데이터는 잠깐의 연결 실패로도 못 읽을 수 있어서, 초기화를 두면 멀쩡한 데이터를 지울 위험이 있고 형식은 DB가 보장해서 (사용자 결정) |
| T9 | 추가 | 저장 방식 | 전체를 덮어쓰는 대신 바뀐 행만 한 트랜잭션으로 저장하고, 저장은 순서대로 하나씩 보냄. 실패한 변경은 다음 저장이나 인터넷 복구 때 다시 보냄 | 정산은 여러 테이블을 함께 바꿔서 일부만 저장되면 금액이 어긋나고, 저장 순서가 뒤집히면 옛 값이 남아서 |
| T9 | 변경 | 기존 브라우저 데이터 | Supabase로 옮기지 않음 | 연습용 샘플이라서 (사용자 결정) |
| T11 | 변경 | 백업 JSON 내보내기·가져오기 | 선택 항목을 구현하지 않고 넘김 | 데이터가 Supabase에 저장되어 브라우저가 바뀌어도 남고, 복구 화면의 초기화도 없어져 쓸 곳이 줄어서 |
| T11 | 삭제 | 쓰이지 않는 코드 | `weeksOfMonth`, `formatSigned`, `.jua`, `.check` 삭제 | 주간 뷰 삭제와 화면 설계 변경으로 테스트 말고는 쓰는 곳이 없어서 |
| T9 | 추가 | 저장 직후 창 닫기 | 저장 요청에 `keepalive`를 붙여 새로고침이나 창 닫기로 끊기지 않게 함 | 실제 서버 검사에서 저장 직후 새로고침하면 변경이 사라지는 것을 발견해서 |
| T12 | 변경 | README 구조 | 처음 계획의 5개 항목을 제출 형식 4개 부분(소개, PRD·Todo, 스킬, 느낀 점)으로 정리하고 Todo를 README 안에 포함 | 과제 제출 형식에 맞추려고 |
| T12 | 삭제 | 제출 항목 | T12의 "GitHub 저장소로 제출" 항목 삭제 | 제출은 사용자가 직접 해서 |

## 3. 스킬

### todo-commit-workflow (직접 만든 스킬)

Todo 항목을 끝내고 커밋할 때 쓰는 절차입니다.
완료 확인, 변경 내역 기록, 커밋 메시지 작성, 커밋, 푸시 판단 순서를 정해 둡니다.
TODO.md 체크와 변경 내역을 작업 파일과 같은 커밋에 넣게 합니다.

<details>
<summary>SKILL.md 전문 펼치기</summary>

````markdown
---
name: todo-commit-workflow
description: TODO.md의 작업 항목을 끝내고 커밋할 때 사용한다. Todo 완료 처리, 변경 내역 기록, 규칙에 맞는 커밋 메시지 작성을 같은 절차로 반복한다.
---

# Todo 커밋 절차

Todo 항목 하나를 끝낼 때마다 아래 순서를 그대로 따른다.

## 1. Todo 완료 확인

- 실제로 동작하는지 확인한다. 확인하지 못한 항목은 완료로 표시하지 않는다.
- `TODO.md`에서 끝낸 항목의 체크박스를 `- [x]`로 바꾼다.

## 2. 변경 내역 기록

처음 계획과 달라졌다면 `TODO.md`의 **변경 내역** 표에 행을 추가한다.

| 칸 | 내용 |
|---|---|
| 시점 | 작업 단계 (예: `T2`) |
| 구분 | `추가`, `변경`, `삭제` |
| 항목 | 바뀐 Todo나 규칙의 이름 |
| 변경 내용 | 무엇이 어떻게 바뀌었는지 |
| 이유 | 왜 바꿨는지 |

항목 추가, 삭제, 순서 변경, 규칙 변경, 완료하지 못하고 넘긴 작업이 모두 기록 대상이다. 계획대로 끝났다면 이 단계는 건너뛴다.

## 3. 커밋 메시지 작성

형식은 `<타입>: <무엇을 왜 했는지>`다.

| 타입 | 쓰는 경우 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 동작이 같은 코드 구조 변경 |
| `test` | 테스트 추가, 수정 |
| `chore` | 설정, 도구 등 그 외 작업 |

내용 없는 메시지는 금지한다.

- 나쁜 예: `feat: 기능 추가`, `fix: 버그 수정`, `update`, `수정`
- 좋은 예: `feat: 분류 배분 합계 검증 추가 (총 금액과 불일치 시 저장 차단)`

## 4. 커밋

- 작업 파일과 `TODO.md`를 **같은 커밋**에 스테이징한다.
- `git add .` 대신 파일을 지정해서 의도하지 않은 파일이 섞이지 않게 한다.
- 커밋 후 `git log --oneline -1`로 메시지를 확인한다.

## 5. 푸시

- `TODO.md`의 푸시 시점이 아니면 푸시하지 않는다.
- 푸시 시점이면 결과를 보고하고 사용자 확인을 받은 뒤에만 `git push`한다.
- 강제 푸시는 하지 않는다.
````

</details>

**작업에서 어떻게 쓰였는지**

- T0에서 만들었습니다 (`b574710`).
- T2에서 Claude Code의 스킬로 불러 썼습니다. 총 금액 설정(`6c17521`)과 T2 남은 항목(`c4b4fb2`, `2f5e972`, `4619091`, `b3d2e94`)을 커밋할 때입니다.
- T3 이후에는 스킬을 다시 불렀다는 기록이 없습니다. 같은 규칙을 `CLAUDE.md`(`d3629bb`)에 적어 두고 그 절차대로 커밋했습니다.

**이 스킬을 고른 이유**

Todo 완료, 변경 내역 기록, 커밋 메시지 작성을 매번 같은 절차로 하려고 직접 만들었습니다. 커밋 `b574710`의 메시지에도 같은 이유가 적혀 있습니다.

### frontend-design (기존 스킬)

화면을 만들거나 고칠 때 뚜렷하고 의도적인 디자인을 잡도록 돕는 스킬입니다.
주제에 맞는 시각적 방향, 글꼴, 레이아웃을 정하라고 안내합니다.
흔한 템플릿처럼 보이는 기본 선택을 피하게 합니다.

<details>
<summary>frontend-design 전문 펼치기</summary>

````markdown
---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Approach this as the design lead at a design studio known for giving every client a distinct visual identity that is not mistaken for anyone else's. This client has already rejected proposals that felt cliché or templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take aesthetic risk if justified.

## Ground your designs in the subject matter

If the brief does not identify what the product or subject matter is, identify it yourself before designing, and confirm with the client. You can come up with one concrete subject, the design's audience, and the design's primary job, as a proposal. If there's any information in your memory about the client's preferences or context about what they're building, use that as a hint. The subject's industry, subject matter, materials, and vernacular are where distinctive visual choices come from — a design for a toy for girls aged 8–11 will be very aesthetically different from a dashboard for financial analysts. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is the first thing viewers will see. Open with the most characteristic thing in the subject's world, in the form that is most appropriate: a headline, an image, an animation, a live demo, an interactive moment, or other treatments. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the default treatment, so only use it if that's truly the best option.

Typography carries the personality of the page. You don't need a different typeface for display or headline text and body content: use one family or two, and if two, make them clearly distinct.

Choose your typefaces deliberately, not the default families you would reach for on any other project, and set a clear type scale following the default guidance of The Elements of Typographic Style with intentional weights, widths, and spacing. When type is used as a headline or visual element, use the type treatment itself as an active part of the design, not a neutral delivery vehicle for the content.

Default to line lengths of less than 80 characters. Serif typefaces can have slightly longer line lengths; give serif body text slightly more line-height than a sans-serif.

Avoid these default typographic treatments; they are the commonest tells of a generated page:
- Accenting just a single word or phrase in a headline, like putting one word in italic/bold or a different color.
- Using all caps for labels.
- Adding unnecessary typographic labels above content.

Visual structure is information. Structural devices like outlines, borders, numbering, eyebrows, dividers, labels, etc., encode useful information about the content rather than decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence — like a stepped process or a timeline. Before adding numbered markers, check the content really is a sequence.

Use non-user-triggered motion sparingly and deliberately, only to draw attention. A single orchestrated moment — one page-load sequence or one reveal — lands better than scattered effects; fade-and-slide-up entrances on each section and hover transitions on every card are the generic default and read as AI-generated. Motion that answers a person's action (opening, expanding, confirming) is welcome when it shows what changed.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy and placeholder content. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: plan, review against the brief, build, critique

For calibration, AI-generated design right now clusters around some traits:
1. a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta or warm-clay accent (often near #D97757 — Anthropic's own Claude-interaction accent, so on a user's brief it reads as a tell);
2. a near-black background with a single bright acid-green or vermilion accent;
3. a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns;
4. the SaaS-card kit: content chopped into identical rounded cards, one border-radius on everything regardless of hierarchy, the same soft grey shadow (rgba(0,0,0,.1)) under each, and gradient washes as decoration;
5. template chrome that appears whatever the subject: a tracked-out ALL-CAPS eyebrow label above every heading; meta strings joined with middle dots ('A · B · C'); labels built as 'WORD — fragment' with a spaced em dash; tinted near-black (#0B0B0B, #111) standing in for black; a monospace face for small data labels; a '→' appended to link and button text.

All traits are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. As with a hired human designer, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

Work in two passes. First, brainstorm a short design plan based on the client's design brief: create a compact token system with color, type, layout, and principles.
- Color: describe the core base palette as 4–6 named hex values.
- Type: the typefaces and their roles.
- Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Include alignment guidance; should the content be left aligned, center aligned, justified?
- Principles: the high-level guidance for what makes this page unique.

Then review that plan against the brief before building: if any part of it reads like the generic default you would produce for any similar page (work through a similar prompt to see if you arrive somewhere similar) rather than a choice made for this specific brief — revise that part, say what you changed and why. Only after you've confirmed the relative uniqueness of your design plan should you start to write the code, following the revised plan.

When writing the code, be careful of structuring your CSS selector specificities. It's easy to generate CSS classes that cancel each other out (especially with a type-based selector like .section and an element-based selector like .cta). This can happen often with padding/margin between sections.

## Restraint and self-critique

Spend your boldness in one place. Let one element be the memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected, visually accessible, harmonious color palettes. Critique your own work as you build, taking screenshots to review if your environment supports it — a picture is worth 1000 tokens. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory. Human creatives have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand and use. They are design content, not decoration. Bring the same intentionality and minimalism to copywriting that you would bring to spacing and color. Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's perspective. Name things by what users will understand in simple language, not by how the system is built. A user manages notifications, not webhook config. Describe what something is or does in plain terms rather than selling it. Being specific and legible to new users is always better than being clever.

Use active voice as default. A CTA says exactly what happens when it is used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published." The vocabulary of an interface is the signposting for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the tone conversational: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each written element do exactly one job.
````

</details>

라이선스 전문은 [docs/skills/LICENSE.txt](docs/skills/LICENSE.txt)에 있습니다.

**작업에서 어떻게 쓰였는지**

- 처음 계획에서는 T1, T3, T7의 UI 방향, 타이포, 색상을 정할 때 쓰기로 했습니다.
- 실제로는 T0을 끝내기 전에 플러그인의 스킬 파일을 직접 읽어 참고했습니다. 스킬로 호출한 기록은 없고, T3와 T7에서 다시 읽은 기록도 없습니다.
- 원문과 라이선스는 저장소에서 확인할 수 있게 `docs/skills/`에 넣었습니다 (`a191744`).
- 첫 화면 골격(`10d1b82`)은 종이 통장 디자인이었습니다. 최종 디자인은 사용자가 고른 레퍼런스(연두색 노트·미니홈피 느낌)를 따랐습니다 (`2d35949`, `ce9caaf`).

**이 스킬을 고른 이유**

화면이 흔한 템플릿처럼 보이지 않게 방향을 잡으려고 골랐습니다. 처음 계획의 용도는 "UI 방향, 타이포, 색상 결정"이고, 스킬 설명에도 템플릿 같은 기본 선택으로 보이지 않게 한다는 내용이 있습니다.

## 4. 느낀 점과 결론

(직접 작성 예정)
