# JKSpeak 계정·개인화 온보딩 연결

## 구현 범위와 공개 배포 조건

xiulin wang의 PR #1(`fd5024d`)의 splash / welcome / login / avatar / auth.css를 현재 JKSpeak에 통합했다. 원래 PR의 ‘coming soon’ 동작 대신 Supabase 이메일/비밀번호 인증과 학습 프로필 저장을 연결한다. 미지원 소셜 로그인 버튼을 실제 로그인처럼 표시하지 않는다.

현재 `auth-config.json`에는 사용자가 제공한 Supabase 프로젝트 URL과 publishable 공개 키를 연결했다. 실제 프로젝트의 SQL·Auth URL·이메일 발송 설정은 별도 검증해야 한다. 공개 설정이 비어 있으면 가입/로그인 입력을 비활성화하고, 존재하지 않는 계정 생성이나 성공을 보여주지 않는다. 설정·SQL의 연결 확인과 회귀 검증 후 계정 진입을 배포한다. 실제 이메일 수신과 첫 계정 생성은 배포 후 사용자가 자신의 이메일로 확인하며, 그 결과를 검증 전 완료로 표시하지 않는다.

## 화면 이동

- 첫 방문 `/`(`index.html`, splash와 동일): 캐릭터 시작 화면 → `welcome.html`.
- 환영: 처음이면 `signup.html`, 기존 계정이면 `login.html`.
- 가입: ① 이메일·비밀번호 ② 학습 프로필 ③ 내용 확인·정보 사용 고지 확인.
- 이메일 확인 필요: 계정이 생성돼도 메인으로 보내지 않고 확인 메일 안내 → `login.html`에서 링크 확인 → 메인.
- 확인이 불필요한 설정이면 실제 인증 세션을 받은 뒤 메인으로 이동.
- 로그인: Supabase 인증 → 프로필 조회 → `app.html`. 프로필이 없는 기존 회원은 `profile.html`을 먼저 완료.
- 이미 로그인한 사용자가 시작/환영/로그인 페이지를 열면 메인으로 이동.
- 메인 직접 접속은 유효한 인증을 확인하며, 로그아웃 상태에서는 로그인 페이지로 이동.
- 비밀번호 복구: `recover.html` → 이메일 → `reset-password.html` → 비밀번호 변경 후 재로그인.

## 수집 정보와 사용

| 정보 | 필요성 | 사용 |
|---|---|---|
| 이메일·비밀번호 | 계정 필수 | Supabase Auth 인증. 비밀번호를 프로필·AI 문맥·앱 저장소에 넣지 않음 |
| 사용할 이름 | 프로필 필수 | 인사·연습 준비. 법적 이름을 요구하지 않음 |
| 과목 | 프로필 필수 | 새 연습의 기본 과목 |
| 시험 유형 | 기본 선택 | University Oral / Viva / Presentation Q&A |
| 자기보고 영어 수준 | 기본 ‘모름’ 가능 | 안내 난이도의 향후 입력. 공식 평가로 사용하지 않음 |
| 집중할 기술 | 기본 선택 | 구조·근거·추론·관련성 중 초기 연습 목표 |
| 답변 방식·연습 시간·주간 목표 | 기본 선택 | 직접 입력/말하기 선호와 세션 기본값 |
| 시간대 | 브라우저 값, 변경 가능 | 향후 일정·연습 계획 |
| 시험일·구체적 목표·어려운 점 | 선택 | 향후 학습 계획과 개인화 |
| AI 개인화 동의 | 선택, 기본 꺼짐 | 향후 연결된 AI 기능에서 학습 문맥을 활용할지 여부 |

생년월일·주소·학생번호·성적·국적·건강정보는 요구하지 않는다. `buildAgentContext()`는 명시적으로 동의한 경우에만 학습 필드를 반환하고 이메일·비밀번호·토큰·계정 ID·표시 이름을 제외한다. 이 함수 자체는 AI에 전송하지 않으며 AI 제공자는 여전히 미연결이다. 과목/유형/집중 기술/연습 시간/주간 목표는 실제 앱 기본값에 반영한다.

## 1. Supabase 프로젝트 생성과 SQL

1. Supabase에서 본인 프로젝트를 생성한다. 데이터 지역·플랜·보관 정책은 프로젝트 소유자가 선택한다.
2. SQL Editor에서 [202610180001_learning_profiles.sql](../supabase/migrations/202610180001_learning_profiles.sql)의 전체 내용을 실행한다.
3. 이 SQL은 계정별 `learning_profiles` 테이블, 회원 본인만 조회·추가·수정 가능한 RLS, 가입 시 프로필 생성 트리거, 서버 시간 기록을 만든다. 로그인 권한을 클라이언트의 `role` 값으로 부여하지 않는다. 계정 삭제 시 프로필도 삭제된다.
4. Supabase Auth에서 이메일/비밀번호 가입을 활성화하고 최소 비밀번호 길이를 **12자 이상**으로 설정한다. 이 앱은 12자 미만의 새 비밀번호를 받지 않는다.
5. 이메일 확인은 활성화하는 것을 권장한다. 실제 친구들 이메일로 가입하려면 SMTP 발송 설정도 확인한다. Supabase 기본 메일 발송은 수신자·속도 제한이 있으므로 외부 가입자에게 확인 메일이 전달되는지 반드시 검증한다. 메일 미도착을 우회하려고 검증을 임의로 해제하지 않는다.

## 2. 주소와 이메일 리디렉션

Auth URL Configuration의 Site URL:

`https://jiwonchoi-dev.github.io/JKSpeak/`

Redirect URLs에 정확한 주소를 추가한다:

```
https://jiwonchoi-dev.github.io/JKSpeak/login.html
https://jiwonchoi-dev.github.io/JKSpeak/reset-password.html
```

Netlify를 같이 사용하면 해당 사이트의 `/login.html`, `/reset-password.html`도 추가한다. 로컬 수동 검증용 `http://127.0.0.1:8080/login.html`, `http://127.0.0.1:8080/reset-password.html`은 필요할 때만 등록한다. 불필요한 전체 wildcard는 사용하지 않는다. 모든 내부 정적 파일은 상대 경로라 `/JKSpeak/`와 `/`를 모두 지원한다.

## 3. 공개 클라이언트 설정

Project URL과 **publishable key**(또는 레거시 `anon` 공개 키)를 `auth-config.json`의 `url`, `publishableKey`에 입력한다. 이 파일은 웹에 공개되는 설정이다. **`service_role`, `sb_secret_...`, DB 비밀번호를 절대로 넣지 않는다.**

또는 환경 변수 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤:

```sh
python3 scripts/configure_auth.py
```

이 도구는 비밀/관리자 키를 거절하고 값은 출력하지 않는다. GitHub Pages는 실행 시 환경 변수를 주입하지 않으므로, 검증된 공개 JSON 파일을 배포 결과물에 포함해야 한다. 비밀키를 JS에 넣는 방법으로 연결하지 않는다.

## 데이터 보존·접근

인증 토큰은 탭의 sessionStorage에만 보관하고 로그아웃 시 제거한다. 토큰이 들어온 이메일 링크의 URL fragment는 즉시 지우고 Supabase에서 사용자를 검증한다. 실제 비밀번호는 인증 요청 외의 저장·프로필·로그에 넣지 않는다. 폼은 인증 초기화 전에는 비활성화하고 POST method를 명시하여 JS가 로드되기 전에 비밀번호가 URL query로 제출되지 않게 한다.

가입 프로필은 초기 계정 metadata로 전달되어 DB 트리거로 저장된다. 현재 프로필과 동의 변경은 `learning_profiles`를 기준으로 하며, 과거 가입 metadata로 동의를 추정하지 않는다. 계정 삭제 요청은 프로젝트 소유자가 처리해야 하며, 이 릴리스는 셀프서비스 계정 전체 삭제를 주장하지 않는다.

학습 텍스트는 `jkspeak-practice-v2:<verified-user-id>`, 녹음은 `jkspeak-audio-v2:<verified-user-id>`로 분리한다. Supabase에는 아직 연습/녹음을 동기화하지 않는다. 같은 브라우저 프로필에 접근할 수 있는 사람에 대한 디스크 암호화를 제공하지 않는다.

기존 `bee-independent-v1` / `bee-audio-v1`는 삭제하지 않는다. Settings에서 본인 데이터임을 명시적으로 확인한 경우에만 기존 기록과 해당 녹음을 계정에 복사한다. 현재 계정의 같은 ID 기록·녹음을 덮어쓰지 않으며 원본은 보존한다. 계정별 로컬 삭제는 다른 계정·서버 프로필·이전 미할당 데이터에 영향을 주지 않는다.

## 검증과 남은 실행 조건

```sh
node --test tests/learning-profile.test.mjs tests/oral-coach.test.mjs
python3 scripts/serve.py --port 8083
JKSPEAK_TEST_URL=http://127.0.0.1:8083 python3 tests/auth_browser.py
JKSPEAK_TEST_URL=http://127.0.0.1:8083 python3 tests/browser_smoke.py
python3 tests/deployment_smoke.py
python3 tests/profile_rls.py
```

Auth 브라우저 테스트는 가로챈 Supabase 응답으로 가입/확인/로그인/복구/메인 이동을 검증한다. 실제 이메일 발송이나 실제 Supabase 가입을 검증한 것으로 표현하지 않는다. RLS 테스트는 Docker `postgres:17-alpine`의 격리된 PostgreSQL에서 SQL을 실제 실행하여 본인 접근·타인 접근 거절·익명 접근 거절·계정 삭제 cascade를 검사한다. 이 테스트는 Supabase의 Auth 메일 파이프라인 검증을 대체하지 않는다.

실제 프로젝트/공개 키 연결과 테이블 존재·익명 접근 차단, 회귀 검증을 확인한 뒤 `main`에 반영한다. 실제 메일 수신·첫 계정 생성·복구 및 두 실제 계정의 프로필 분리는 배포 후 실사용 검증으로 남기고 완료 여부를 구분한다.

## 현재 연결 상태

프로젝트: `https://nxlrgobydfzskihjrlmw.supabase.co`. 사용자가 SQL과 Site/Redirect URL 설정 완료를 확인했다. 실제 서버에서 `/auth/v1/health`와 `/auth/v1/settings`의 HTTP 200을 확인했으며, 이메일 가입은 활성화되고 이메일 확인은 필수(`mailer_autoconfirm: false`)다.

익명 공개 키로 `learning_profiles`를 조회했을 때 HTTP 401 / PostgreSQL `42501 permission denied`를 반환한다. 이는 테이블이 존재하며 익명 접근이 차단됨을 확인한 결과다. 이를 고치기 위해 `anon`에 SELECT 권한을 추가하면 안 된다. 로그인한 본인 접근·타인 접근 거절은 격리 PostgreSQL RLS 테스트에서 통과했으며, 실제 사용자 계정으로의 클라우드 검증과는 구분한다.

계정 생성이나 실제 이메일 발송을 임의로 수행하지 않았다. 실제 확인/복구 메일 수신과 첫 계정 생성은 배포 후 사용자가 자신의 이메일로 검증한다. 모의 인증 브라우저 테스트, 실제 서버 읽기 점검, 실제 메일 검증을 서로 구분한다.

## 화면 및 확인 링크 개선 (2026-10-18)

시작 화면과 가입·로그인·프로필·확인·메인은 420px 프레임을 공유하고 휴대폰에서는 화면 폭에 맞춘다. 가입은 계정 → 이름/과목 → 시험 → 학습 초점 → 연습 주기 → 선택 목표 → 개인화 동의 → 리뷰 → 별도 이메일 확인 안내 순서다. 리뷰의 Edit는 해당 질문으로 돌아가며, 답변 변경 후 리뷰로 복귀한다.

기존 Supabase 확인 링크의 access/refresh token을 검증한 뒤 로그인된 메인으로 이동한다. 링크 오류가 있어도 로그인 폼은 작동한다. 이전 세션 복원 실패도 새 로그인을 막지 않으며 네트워크 실패 시 입력값을 유지한다. 확인 안내 화면에서 사용자가 직접 새 메일을 요청할 수 있다. 만료·이미 사용한 토큰을 앱이 재활성화할 수는 없다. 이미 확인된 계정은 비밀번호로 로그인하고, 미확인 계정은 최신 확인 메일을 사용한다.

기본 메일 템플릿과 기존 login.html redirect 등록은 그대로 지원한다. 메일 보안 프로그램이 일회용 링크를 먼저 소비하는 문제가 반복될 때만 Supabase Authentication → Email Templates → Confirm signup의 링크를 다음으로 변경할 수 있다(프로젝트 소유자 작업):

```html
<a href="https://jiwonchoi-dev.github.io/JKSpeak/confirm-email.html?token_hash={{ .TokenHash }}&amp;type=email">Confirm my email</a>
```

이 방식은 확인 페이지를 여는 것만으로 토큰을 소비하지 않고, 사용자의 Confirm my email 버튼 클릭 후 `/auth/v1/verify`를 호출한다. 실제 확인과 세션 수신이 성공한 경우에만 메인으로 이동한다. 기본 링크가 이미 만료된 경우에는 템플릿 변경 후에도 새 메일이 필요하다. 비밀키나 인증 관리자 권한을 클라이언트에 추가하지 않는다.

`tests/auth_links_browser.py`는 만료/사용된 링크, 쿼리·fragment 오류, 다른 기기에서 토큰 확인, 명시적 재발송, 로그인/세션 복원 네트워크 실패를 모의 응답으로 재현한다. 실제 메일 수신·확인은 이 테스트에 포함되지 않는다.

## 확인 메일이 오지 않을 때

Auth health/settings HTTP 200은 메일 발송/수신 성공을 증명하지 않는다. 공개 publishable key로 SMTP 구성이나 Auth 로그를 조회·변경할 수 없다.

1. Authentication → Logs에서 가입/재발송 시각의 실패를 확인한다. `email_address_not_authorized`는 기본 발송 서비스의 수신자 제한, `over_email_send_rate_limit`는 프로젝트 발송 한도를 나타낸다. 반복 재발송으로 해결되지 않는다.
2. 프로젝트 소유자가 Authentication → Email → SMTP Settings에서 Custom SMTP 활성 여부를 확인한다. 기본 Supabase 메일 서비스는 일반 사용자 대상 운영 발송용이 아니며, 팀 소속 수신자 제한과 낮은 발송 한도가 있다. 실제 사용자 가입에는 메일 제공업체와 발신 도메인을 구성한 Custom SMTP가 필요하다. SMTP 비밀번호는 Supabase 대시보드에만 입력한다.
3. Custom SMTP를 사용한다면 발신 도메인 인증(SPF/DKIM), 발신 주소, 제공업체 발송 로그/반송/수신자 제한도 확인한다. SMTP 설정을 앱의 auth-config.json에 넣지 않는다.
4. 설정을 고친 뒤 본인의 미확인 계정에 한 번 재발송하고 Auth 로그와 메일 제공업체의 전달 기록을 함께 확인한다. 이미 확인된 계정에는 확인 메일이 다시 발송되지 않을 수 있으므로 로그인으로 확인한다.

앱은 메일 관련 오류를 안전한 설명과 HTTP 상태/오류 코드로 표시한다. 원본 SMTP 오류 메시지나 개인정보를 그대로 노출하지 않는다. HTTP 성공은 요청 수락으로만 표시하며 실제 메일 도착으로 표현하지 않는다. 메일 미수신을 우회하려고 이메일 확인을 끄거나 관리자 키를 브라우저에 배포하지 않는다.
