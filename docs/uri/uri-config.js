// 🤝 우리(공통) 저장소 Firebase 연결 설정 (uri-board 웹 앱). 공개돼도 괜찮은 값이고, 데이터는 공통 비밀번호로 지켜져요.
// 냐냐 보드·욱진 보드가 같이 씀: uri/{SHA-256("uri-board:"+공통 비밀번호)} 아래 (규칙: 저장소 맨 위 uri.rules.json)
// 욱진 보드는 https://nyanya-lab.github.io/nyanya-board/uri/ 에서 이 파일을 불러와 씀 → 여기만 고치면 두 보드 다 적용
export const uriConfig = {
  apiKey: "AIzaSyD6KCE8DI2fB1ahVWxhH82QNwcok84Nns8",
  authDomain: "uri-board.firebaseapp.com",
  databaseURL: "https://uri-board-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "uri-board",
  storageBucket: "uri-board.firebasestorage.app",
  messagingSenderId: "23685845491",
  appId: "1:23685845491:web:dc882ca77f95d8bf288286"
};
