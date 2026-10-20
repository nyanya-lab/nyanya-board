// Firebase 연결 설정 — 욱진 보드와 같은 프로젝트(ukjin-207a3). 공개돼도 괜찮은 값이고, 데이터는 비밀번호로 지켜져요.
// 냐냐 보드는 nyanya/{해시} 아래에 저장 (규칙은 ../ukjin-board/database.rules.json 한 곳에서 관리)
export const firebaseConfig = {
  apiKey: "AIzaSyB0aGdOx_rFUpGCxDdT1fxe0FR8A5Oq5ow",
  authDomain: "ukjin-207a3.firebaseapp.com",
  projectId: "ukjin-207a3",
  storageBucket: "ukjin-207a3.firebasestorage.app",
  messagingSenderId: "318941907079",
  appId: "1:318941907079:web:bd3a15eb3dcedaf5c81022",
  // Realtime Database → 데이터 탭 맨 위에 보이는 주소 (https://ukjin-207a3-default-rtdb....)
  databaseURL: "https://ukjin-207a3-default-rtdb.firebaseio.com"
};
