import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase with the static config
const app = initializeApp(firebaseConfig);

// Initialize Firestore with database id
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export { doc, getDoc, setDoc, onSnapshot };
