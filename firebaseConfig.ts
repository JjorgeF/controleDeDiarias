import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Configuração do Firebase obtida do console.
const firebaseConfig = {
  apiKey: "AIzaSyAcm8t8cszi93SAUqZxzHjnwxuXvj4Hf1M",
  authDomain: "valid-scene-477520-u5.firebaseapp.com",
  projectId: "valid-scene-477520-u5",
  storageBucket: "valid-scene-477520-u5.firebasestorage.app",
  messagingSenderId: "565909158783",
  appId: "1:565909158783:web:917bfada8aee0e8154384a",
  measurementId: "G-EPHBBKV32T"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Obtém os serviços do Firebase
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
