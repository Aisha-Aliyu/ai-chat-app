import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcDNlBpbXPUONkrXtYBKW6EQTcWscxy6E",
  authDomain: "ai-chat-app-6a11e.firebaseapp.com",
  projectId: "ai-chat-app-6a11e",
  storageBucket: "ai-chat-app-6a11e.firebasestorage.app",
  messagingSenderId: "168131862121",
  appId: "1:168131862121:web:fd5156b7602b5877968cf8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth service
export const auth = getAuth(app);