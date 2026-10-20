// Firebase 연결 설정 (nyanya-board 웹 앱). 공개돼도 괜찮은 값이고, 데이터는 비밀번호로 지켜져요.
// 냐냐 보드는 nyanya/{해시} 아래에 저장 (규칙: 저장소 맨 위 database.rules.json)
export const firebaseConfig = {
  apiKey: "AIzaSyBbZIGv2sR_M8QikrACK8JgGm1RnjDRmHk",
  authDomain: "nyanya-board.firebaseapp.com",
  databaseURL: "https://nyanya-board-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nyanya-board",
  storageBucket: "nyanya-board.firebasestorage.app",
  messagingSenderId: "811017827931",
  appId: "1:811017827931:web:96d0c23852796ddca5b17e"
};
