import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyArHb-auRXi2CYbhiti6hqrRWYZzu6oJNA",
  authDomain: "lumen-pop.firebaseapp.com",
  databaseURL: "https://lumen-pop-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lumen-pop",
  storageBucket: "lumen-pop.firebasestorage.app",
  messagingSenderId: "516148988894",
  appId: "1:516148988894:web:6dcc995e309ed580d7eb4f",
  measurementId: "G-C58YK1LJ6X"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let rtdbInstance: ReturnType<typeof getDatabase> | null = null;
try {
  rtdbInstance = getDatabase(app);
} catch (e) {
  console.warn('Realtime database init note:', e);
}
export const rtdb = rtdbInstance;

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
