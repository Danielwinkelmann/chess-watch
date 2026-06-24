// Firebase-Anbindung für das Sammeln von Trainingsdaten (eigenes Brett).
// Hinweis: Der Web-Config inkl. apiKey ist öffentlich-by-design – Schutz läuft
// über die Storage/Firestore-Rules in der Firebase-Console, nicht über den Key.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDFNy-2T6wSvuFLDFUbNLwPSfGpU5aAQbI',
  authDomain: 'chesswatch-7720e.firebaseapp.com',
  projectId: 'chesswatch-7720e',
  storageBucket: 'chesswatch-7720e.firebasestorage.app',
  messagingSenderId: '723175582315',
  appId: '1:723175582315:web:4f159c52a8e401259a1f2e',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
const auth = getAuth(app)

// Anonyme Anmeldung (einmalig, gecacht) – damit die Rules authentifizierte
// Schreibzugriffe erlauben können, ohne dass der Nutzer ein Konto braucht.
let authPromise: Promise<string> | null = null
export function ensureAuth(): Promise<string> {
  if (!authPromise) {
    authPromise = signInAnonymously(auth).then((cred) => cred.user.uid)
  }
  return authPromise
}
