
// FIX: The namespace import for 'firebase/app' was incorrect. Switched to named imports
// for `initializeApp`, `getApps`, and `getApp` to follow the Firebase v9 modular SDK pattern
// and resolve "Property does not exist" errors.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Configuração do seu aplicativo da web do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDgbUoe6zQkOpJ125jvkqBY4SctHbO03zo",
  authDomain: "lpdatabase-4249e.firebaseapp.com",
  projectId: "lpdatabase-4249e",
  storageBucket: "lpdatabase-4249e.firebasestorage.app",
  messagingSenderId: "312546445708",
  appId: "1:312546445708:web:38f0d49c4fbfc149dd6ea9",
  measurementId: "G-SM72NHLYR2"
};

// Previne que o Firebase seja inicializado múltiplas vezes
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Obtém os serviços do Firebase
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };