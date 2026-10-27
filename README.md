# 방 가구 배치 3D 시뮬레이터 (v3 · 클라우드 + AI)

Vite + three.js(0.128) + Firebase. 이전 버전에서 브라우저에 저장된 배치는 자동으로 새 형식으로 옮겨집니다.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/
vercel --prod
```

## 1. 클라우드 저장 설정 (Firebase · Firestore `room-maker`)
1. **웹 앱 설정 받기** — Firebase 콘솔 → ⚙ 프로젝트 설정 → 일반 → 내 앱 → `</>`(웹 앱 추가) → 표시되는 `firebaseConfig` 코드를 복사
2. **앱에 넣기** — 둘 중 하나
   - 앱의 **저장(☁) 탭**에 코드를 그대로 붙여 넣고 ‘설정 저장 후 연결’
   - 또는 `.env.example`을 참고해 Vercel 환경 변수(`VITE_FIREBASE_*`)로 등록 후 재배포
3. **로그인 방법 켜기** — Authentication → 로그인 방법 → **Google**, **이메일/비밀번호** 사용 설정
4. **도메인 허용** — Authentication → 설정 → 승인된 도메인 → Vercel 주소(예: `xxx.vercel.app`) 추가
5. **보안 규칙 게시** — Firestore → `room-maker` → 규칙 탭에 아래를 붙여 넣고 ‘게시’

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

저장 구조: `users/{uid}/projects/*` (프로젝트), `users/{uid}/meta/settings` (내 크기·내 가구), `users/{uid}/meta/aikeys` (AI 키), `users/{uid}/meta/aimodels` (모델 선택), `users/{uid}/gallery/*` (AI 렌더 이미지). 로그인하지 않으면 브라우저에만 저장됩니다.

## 2. AI 설정
AI 탭 → ⚙ AI 설정 → 키 입력(또는 `geminiApiKey, AIza…` 형식 그대로 한 번에 붙여넣기) → 저장. 로그인 상태면 클라우드에 저장·삭제·업데이트됩니다. API 키는 코드에 넣지 않습니다(공개 사이트 번들에 넣으면 누구나 볼 수 있음).

| 작업 | 지원 모델 |
|---|---|
| 대화·명령 / 사진 인식 | Gemini 3.8 Flash · 4 Argon · 3.1 Pro …, GPT-5.6 / 5.5 / 5.4 …, Claude Opus·Sonnet·Haiku 5.5 …, Groq Llama 4 Maverick·Scout, GPT-OSS 120B … |
| 실사 이미지 | Nano Banana Pro(gemini-3-pro-image), Nano Banana 2 / 2.1 / Lite, GPT Image 2.5 Sunburst·Flare, GPT Image 2 / 1.5 / 1 / mini |

‘연결 테스트 · 모델 목록 불러오기’로 각 회사 API의 최신 모델을 가져올 수 있고, 모델 ID를 직접 입력할 수도 있습니다.

## 3. AI 기능
- **대화 명령** (음성 입력·사진 첨부 가능): “창가에 몬스테라 추가”, “책장1을 120×30×180 월넛 3열 서랍형으로”, “조명1, 2, 5, 7 완전 어둡게”, “전체 조명 어둡게”, “북유럽 스타일로”, “동선 분석해줘”, “예상 가격 채워줘” … 실행 결과는 한 번에 되돌릴 수 있음
- **사진 → 가구**: 상세페이지·치수표 사진에서 품목·사이즈(mm→cm)·형태(서랍형/도어형, 열 구성)를 인식, 여러 사이즈는 선택
- **사진 → 사람**: 사진 속 사람을 한 명씩 3D 사람으로 (기본 남 180 / 여 165cm, 사진 키 비율 반영 옵션)
- **방·도면 사진 → 방 크기·창호·가구**
- **실사 렌더**: 유튜브·쇼츠·모바일 세로/가로·PC·울트라와이드·인스타·A4 등 크기 × 여러 각도(눈높이 모서리 시점 포함) × 스타일, 배치·크기·재질·조명 밝기 설정을 그대로 반영. AI 없이 고화질 캡처도 가능

## 4. 편집 기능 요약
- 가구·소품·사람 170여 종, 재질 18종, 열 수·열별 모양(N열 책장), 크기 %·비율 유지·사용자 크기 기억
- 방 모양: 프리셋(L·T·ㄷ·모서리 깎기/둥글게·한쪽 곡선·육각·팔각·베이창), 꼭짓점 드래그·추가·삭제, 벽별 곡선·색
- 창문 7종 / 문 9종, 열림 상태(3연동 중문 1짝·2짝 겹침, 창 열림, 문 각도), 커튼, 창밖 풍경(도시·아파트·자연·공원·바다·설경 × 낮·노을·밤)
- 조명 12종 + 스탠드, 밝기 0~250%, 야간 모드, 바닥재 결 방향(가로·세로·대각선)
- 모바일: 아래 시트 패널(끌어서 크기 조절), 떠 있는 버튼, 터치 실수 방지(선택 후 이동), 길게 눌러 편집, 이미지 저장은 공유 시트/길게 눌러 저장

## 구조
`src/main.js` 핵심 · `src/aiui.js` AI 화면 · `src/ai.js` AI 호출 · `src/cloud.js` Firebase · `src/geom.js` 방 도형 · `src/builders.js` 가구 모델 · `src/fixtures.js` 창호·조명 · `src/materials.js` 재질·풍경 · `src/plan.js` 평면도 · `src/save.js` 파일 저장 · `src/catalog.js` 카탈로그

## 모든 기기에서 바로 로그인 (Firebase 설정 내장)

Firebase 웹 설정(apiKey, appId 등)은 **공개용 값**이라 앱에 넣어도 됩니다. (보안은 Firestore 규칙 + Authentication 「승인된 도메인」이 담당)
한 번 넣어 두면 PC·휴대폰 어디서든 처음부터 「Google 로그인」 버튼이 보이고, 로그인하면 그 계정의 프로젝트·내 가구·AI 키가 자동으로 적용됩니다.

방법 (셋 중 하나):
1. **src/firebase.config.js** 에 값 붙여 넣고 재배포 — 설정된 PC에서 저장 탭 → 「Firebase 설정 변경 · 설정 파일 코드」 → 「설정 파일 코드 복사」로 파일 내용을 그대로 복사할 수 있음
2. **Vercel 환경변수** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID` … (.env.example 참고) 후 재배포
3. 재배포 없이 바로: 설정된 PC 저장 탭 → **「📱 다른 기기 연결 (QR)」** → 휴대폰 카메라로 QR 찍기

※ AI API 키는 절대 firebase.config.js 에 넣지 마세요. 로그인 후 ⚙ AI 설정에서 저장하면 클라우드(users/{uid}/meta/aikeys)에 저장되어 다른 기기에서 로그인 시 자동으로 불러옵니다.

## 여러 개 선택 · 그룹 · 일괄 편집
- 선택: Shift(또는 Ctrl)+클릭 · Shift+빈 곳 드래그(영역) · Ctrl+A 전체 · 목록 탭 체크박스 · 가구 패널 「같은 종류 모두 선택」 · 모바일은 빠른 막대 「☑ 다중」/「▭ 영역」 또는 ☰ 메뉴
- 이동: 선택된 가구 하나를 끌면 모두 평행 이동 · 방향키 · 화살표 패드 · 수치 이동 · 방 가운데로
- 회전: 묶음 가운데 기준 또는 각자 제자리 (15/45/90/180°, 직접 입력)
- 크기: % 일괄(간격도 비율대로 옵션) · 가로/세로/높이 일괄 지정 · 기준 가구 크기로 맞추기
- 정렬·분배: 왼쪽/가운데/오른쪽/뒤/앞, 바닥으로, 균등 분배, N cm 간격 나란히 · 좌우/앞뒤 반전
- 그룹: Ctrl+G 묶기 / Ctrl+Shift+G 풀기 — 하나를 누르면 그룹 전체 선택, 한 번 더 누르면 개별 선택 (Alt+클릭: 바로 개별)
- 복제·배열 복제(N세트, 가로/세로, 간격), 색·재질 일괄, 모두 잠금, 모두 삭제, Ctrl+C/V

## 내 가구 · 카테고리
- 사진 인식(가구/사람) 결과, 선택한 가구, 여러 개 선택한 묶음을 「💾 내 가구로 저장…」 → 카테고리 선택(내 가구 · 내가 만든 카테고리 · 기본 카테고리) 또는 「＋ 새 카테고리 만들기」
- 카탈로그의 ★ 항목 ✎: 이름·카테고리 변경, 삭제 · 카테고리 제목 ✎: 이름 변경 · 「📁 카테고리 관리」: 추가·이름 변경·순서·삭제(항목 옮기기/함께 삭제), 기본 카테고리 표시 이름 변경
- 클라우드: users/{uid}/meta/library 에 저장 (custom, cats, ren, libT). 더 최근에 바꾼 기기 기준으로 맞춰져서 삭제·이름 변경도 다른 기기에 그대로 반영되고, 열려 있는 다른 기기에는 실시간 반영
