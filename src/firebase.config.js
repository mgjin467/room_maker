// ─────────────────────────────────────────────────────────────
// Firebase 웹 앱 설정 — 여기에 한 번만 붙여 넣으면 PC·휴대폰 어디서든
// 바로 「Google 로그인」 버튼이 보이고, 로그인하면 내 프로젝트·AI 키가 자동 적용됩니다.
//
// 어디서 복사? Firebase 콘솔 → ⚙ 프로젝트 설정 → 일반 → 내 앱(웹 </>) → SDK 설정 및 구성 → 「구성」
//   const firebaseConfig = { apiKey: "...", authDomain: "...", ... }  의 값들을 아래에 그대로.
// (앱의 저장 탭 → 「설정 파일 코드 복사」 버튼을 누르면 이 파일 내용이 통째로 복사됩니다.)
//
// ※ 이 값들은 비밀번호가 아닙니다(Firebase 웹 설정은 원래 공개용). 보안은
//   Firestore 보안 규칙 + Authentication 「승인된 도메인」이 지켜 줍니다.
//   AI API 키(Gemini/OpenAI 등)는 여기에 넣지 마세요 — 그건 로그인 후 클라우드에 저장됩니다.
// ─────────────────────────────────────────────────────────────
export default {
  apiKey: '',
  authDomain: 'gen-lang-client-0312895786.firebaseapp.com',
  projectId: 'gen-lang-client-0312895786',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  databaseId: 'room-maker',
};
