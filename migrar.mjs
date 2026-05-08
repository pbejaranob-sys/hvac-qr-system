import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkdDUDpl-rTNLjABO_o6gLTqHa92yUbIs",
  authDomain: "hvac-qr-system.firebaseapp.com",
  projectId: "hvac-qr-system",
  storageBucket: "hvac-qr-system.firebasestorage.app",
  messagingSenderId: "206201113053",
  appId: "1:206201113053:web:5dbf6479968d5fd86f4e34"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SUPER_ADMIN_UID = "VyJ4BFJX9SNJip3wb7xjrvuVwE73";
const snap = await getDocs(collection(db, "equipos"));
let count = 0;
for (const d of snap.docs) {
  const data = d.data();
  if (!data.adminId) {
    await updateDoc(doc(db, "equipos", d.id), { adminId: SUPER_ADMIN_UID });
    count++;
    console.log("Actualizado: " + (data.codigo || d.id));
  }
}
console.log("Migracion completa: " + count + " equipos actualizados");
process.exit(0);