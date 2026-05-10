import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { createInterface } from "readline";

const firebaseConfig = {
  apiKey: "AIzaSyCkdDUDpl-rTNLjABO_o6gLTqHa92yUbIs",
  authDomain: "hvac-qr-system.firebaseapp.com",
  projectId: "hvac-qr-system",
  storageBucket: "hvac-qr-system.firebasestorage.app",
  messagingSenderId: "206201113053",
  appId: "1:206201113053:web:5dbf6479968d5fd86f4e34"
};

const MASTER_EMAIL = "p.bejarano.b@outlook.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function pedirPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question("Contraseña del usuario maestro: ", answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function eliminarColeccion(nombreCol) {
  const snap = await getDocs(collection(db, nombreCol));
  if (snap.empty) {
    console.log(`  [${nombreCol}] Sin documentos.`);
    return 0;
  }
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, nombreCol, d.id));
    count++;
  }
  console.log(`  [${nombreCol}] ${count} documento(s) eliminado(s).`);
  return count;
}

async function main() {
  const password = process.argv[2] || await pedirPassword();

  console.log("\nIniciando sesión como usuario maestro...");
  let userCred;
  try {
    userCred = await signInWithEmailAndPassword(auth, MASTER_EMAIL, password);
  } catch (err) {
    console.error("Error de autenticación:", err.message);
    process.exit(1);
  }

  const masterUid = userCred.user.uid;
  console.log("Sesión iniciada. UID maestro:", masterUid);
  console.log("\nEliminando datos de prueba...\n");

  await eliminarColeccion("clientes");
  await eliminarColeccion("equipos");
  await eliminarColeccion("sedes");

  // Eliminar usuarios excepto el maestro
  const snap = await getDocs(collection(db, "usuarios"));
  let eliminados = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const esmaestro = data.uid === masterUid || data.email === MASTER_EMAIL;
    if (!esmaestro) {
      await deleteDoc(doc(db, "usuarios", d.id));
      console.log(`  [usuarios] Eliminado: ${data.email || data.nombre || d.id}`);
      eliminados++;
    } else {
      console.log(`  [usuarios] Conservado (maestro): ${data.email}`);
    }
  }
  if (eliminados === 0 && snap.empty) console.log("  [usuarios] Sin documentos.");

  console.log("\n✅ Limpieza completada. Solo queda el usuario maestro.\n");
  process.exit(0);
}

main().catch(err => {
  console.error("Error inesperado:", err.message);
  process.exit(1);
});
