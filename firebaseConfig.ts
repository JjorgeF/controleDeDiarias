// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDgbUoe6zQkOpJ125jvkqBY4SctHbO03zo",
  authDomain: "lpdatabase-4249e.firebaseapp.com",
  projectId: "lpdatabase-4249e",
  storageBucket: "lpdatabase-4249e.firebasestorage.app",
  messagingSenderId: "312546445708",
  appId: "1:312546445708:web:38f0d49c4fbfc149dd6ea9",
  measurementId: "G-SM72NHLYR2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);