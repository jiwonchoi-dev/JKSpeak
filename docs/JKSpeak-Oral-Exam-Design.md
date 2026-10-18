# JKSpeak Oral Exam — 적용 설계와 구현 범위

첨부한 Bee 설계를 현재 정적 JKSpeak 앱의 실제 구조에 맞게 재설계했다. 새 프로토타입으로 교체하지 않고 기존 세션, 자료 처리, 녹음, 시험관 채점 및 로컬 데이터 구조를 확장했다. 제품 UI는 기존 기여 지침대로 영어를 유지한다. 첨부 문서의 연구·서비스 비교는 설계 참고이며, 이번 작업에서 원문 연구를 독립 검증하거나 그 효과를 제품의 검증 결과로 사용하지 않았다.

## 사용자와 시험 범위

주 사용자는 대학 구술시험, Viva/Oral Defence, Presentation Q&A 준비자다. 세 유형은 별도의 시작 질문과 준비 설명을 가진다. IELTS·TOEFL·PTE 점수나 공식 시험 구조를 동일한 엔진으로 흉내 내지 않는다.

## 실제 구현한 학습 순환

1. **Prepare:** 시험 유형, Guided/Mock, 한 가지 연습 목표, 선택적 자신감 체크인. 기존 4단계 준비 과정과 사용자 작성 문항·루브릭을 유지한다.
2. **Practise:** Guided에서는 목표별 구조 힌트와 학습 자료를 펼쳐 볼 수 있다. Mock에서는 힌트·자료·source passage를 숨긴다. 기존 타이머·일시 정지·직접 입력·브라우저 받아쓰기·녹음을 사용한다. 페이지를 떠날 때 답변과 일시 정지 상태를 저장한다.
3. **Observe:** 답변 원문에서 정확한 인용을 붙이고 Structure, Evidence, Reasoning, Relevance 중 하나를 자기점검한다. ‘연습 필요’, ‘강점’, ‘근거 부족/전사 불확실’을 구분한다. 인용이 실제 답변과 일치하지 않으면 저장하지 않는다. 이는 의미 판단이나 자동 채점이 아니다.
4. **Improve:** 한 문항을 다시 답하고 원본과 비교한다. `parentId`와 문항별 `previousIndex`를 사용하므로 약한 문항만 재도전해도 정확한 원본이 연결된다. 원본 세션은 그대로 남는다. 원본 삭제 시 비교는 표시하지 않는다.
5. **Transfer:** 동일 목표를 다른 저작 질문에 적용한다. AI의 답변 기반 후속 질문으로 표현하지 않는다. 다른 질문에서 능력이 향상됐다는 자동 판정도 하지 않는다.
6. **Progress:** 최근 10개 세션에서 실제 인용이 붙은 사용자의 연습 필요 표시를 집계해 다음 목표를 제안한다. 표본이 부족한 경우 이를 명시한다. 전체 자기점검 기록, 자신감 전후, 시험관 입력 점수는 서로 분리한다. 여러 과목·루브릭을 종합한 임의 점수는 없다.

## UI와 접근성

홈의 주요 동작은 새 연습 또는 저장된 연습 재개다. Ink/Teal/Canvas와 Honey CTA를 사용하고 노란 버튼에는 어두운 글씨를 쓴다. 상단 탐색은 Overview, Sessions, Progress, Settings다. 44px 조작 영역, 키보드 포커스, 현재 탐색 표시, skip link, 상태 live region, 반응형 단일 열 및 다크 모드를 제공한다. 사용자 입력은 HTML 삽입 전 escape한다.

## 데이터와 음성

기존 `bee-independent-v1` localStorage 키와 `bee-audio-v1` IndexedDB를 유지한다. 새 필드는 추가 방식이다.

- Draft: `format`, `practice`, `focus`, `confidence`
- Session: `format`, `practice`, `focus`, `confidenceBefore/After`, 재도전의 `parentId`, 전이 연습의 `transferFrom`
- Question: 재도전의 `previousIndex`
- Answer: `coach { skill, quote, verdict, reason, saved }`, 기존 text/reflection/needsWork 유지
- Settings: theme

받아쓰기는 브라우저 공급자에게 음성을 보낼 수 있음을 실행 전에 확인한다. 녹음은 별도로 로컬 보관 동의를 받는다. 마이크 실패 시 타이핑을 유지하고, 기록별 다운로드·삭제를 제공한다. Settings에서 진행 중 세션까지 포함한 전체 텍스트 내보내기와 전체 텍스트·IndexedDB 녹음 삭제를 제공한다. 텍스트 내보내기는 음성을 포함하지 않으며 자동 클라우드 복구나 계정 동기화는 없다.

PDF 경로는 실제 평탄화된 저장소의 모듈과 worker를 상대 경로로 참조하도록 수정했다. `scripts/serve.py`는 공개 앱 자산만 제공하며 `.git`나 개발 문서를 노출하지 않는다.

## 후속 서버 구현 범위

실시간 AI Examiner, 자료 근거 기반 질문 생성·후속 질문, 평가자 분리, 전사 신뢰도, WebRTC, 계정·동기화 및 서버 보관 정책은 이번 정적 구현에 포함하지 않았다. 이를 추가하려면 별도 서버와 제공자, 인증·비밀키, 음성 전송 동의와 삭제 정책이 필요하다. API 키를 프런트엔드에 넣거나 텍스트 길이로 점수를 만드는 방식은 사용하지 않는다. GitHub 반영과 실제 GitHub Pages 배포 완료는 구분한다. 라이브 응답은 실행 환경의 네트워크 정책 때문에 직접 확인하지 못할 수 있으며, 이를 테스트 통과로 표현하지 않는다.

## 검증

`node --test tests/oral-coach.test.mjs`와 `python3 tests/browser_smoke.py`를 실행한다. 브라우저 테스트는 `scripts/serve.py --port 8081`과 Python Playwright/Chromium이 필요하다. 기존 데이터 보존, 근거 불일치 거부, 정확한 재도전 연결, Guided/Mock, 저장된 세션 재개, 시험관 채점, 목표 제안, 자신감 분리, 다크 모드, 내보내기, 마이크 거절 시 입력 보존, 390px 화면, 전체 데이터·녹음 삭제를 검사한다. 실제 하드웨어 음질·실제 받아쓰기 정확도·Safari/Firefox·공개 호스팅 영속성은 이 자동화 검증 범위에 없다.
