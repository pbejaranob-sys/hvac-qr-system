import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCkdDUDpl-rTNLjABO_o6gLTqHa92yUbIs",
  authDomain: "hvac-qr-system.firebaseapp.com",
  projectId: "hvac-qr-system",
  storageBucket: "hvac-qr-system.firebasestorage.app",
  messagingSenderId: "206201113053",
  appId: "1:206201113053:web:5dbf6479968d5fd86f4e34"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);