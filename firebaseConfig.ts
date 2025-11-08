// FIX: The original named imports from 'firebase/app' were causing module resolution errors.
// Switched to a namespace import (`import * as firebaseApp`) and updated the initialization
// logic to use `firebaseApp.` prefixes. This is a robust way to handle Firebase v9
// imports and can resolve issues in certain build environments.
import * as firebaseApp from 'firebase/app';
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
const app = !firebaseApp.getApps().length ? firebaseApp.initializeApp(firebaseConfig) : firebaseApp.getApp();

// Obtém os serviços do Firebase
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };