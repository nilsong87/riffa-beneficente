const firebaseConfig = {
  apiKey: "AIzaSyDiVvb3fHhTWiTEHiVCOxlHc3RgSln2vZo",
  authDomain: "sorteio-beneficente.firebaseapp.com",
  projectId: "sorteio-beneficente",
  storageBucket: "sorteio-beneficente.appspot.com",
  messagingSenderId: "1029960425177",
  appId: "1:1029960425177:web:dfcd3d8ca65accb77a68c8",
  measurementId: "G-G0VKX33WGD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();