import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
} from 'firebase/firestore';
import {
  connectDatabaseEmulator,
  Database,
  getDatabase,
} from 'firebase/database';
import {
  connectFunctionsEmulator,
  Functions,
  getFunctions,
} from 'firebase/functions';

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY?.trim() ||
    'AIzaSyBl-SZeDdQyt2DYv5DzHZQi9z-K2jWQpoU',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ||
    'gen-lang-client-0281673852.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    'gen-lang-client-0281673852',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim() ||
    'https://gen-lang-client-0281673852-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
    'gen-lang-client-0281673852.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    '694243481103',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID?.trim() ||
    '1:694243481103:web:a4f4087c276b5d6857b57a',
};

const functionsRegion =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || 'us-central1';
const useEmulators =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS?.trim()?.toLowerCase() === 'true';

/**
 * Cloud Functions require the Firebase Blaze plan. By default on the Free (Spark) plan,
 * score validation runs via the free Vercel Serverless API (/api/puzzle/*) + Firestore Security Rules.
 */
export function isCloudFunctionsEnabled(): boolean {
  return (
    import.meta.env.VITE_USE_FIREBASE_FUNCTIONS?.trim()?.toLowerCase() === 'true' ||
    useEmulators
  );
}

/**
 * Returns true if the core Firebase configuration environment variables are present.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

/**
 * Returns true if Firebase Realtime Database is configured.
 */
export function isRealtimeDbConfigured(): boolean {
  return Boolean(
    isFirebaseConfigured() &&
      (firebaseConfig.databaseURL || firebaseConfig.projectId)
  );
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let realtimeDb: Database | null = null;
let cloudFunctions: Functions | null = null;
let emulatorsConnected = false;

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  rtdb: Database | null;
  functions: Functions;
}

export function getFirebaseServices(): FirebaseServices | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  try {
    if (!firebaseApp) {
      const resolvedDatabaseURL =
        firebaseConfig.databaseURL ||
        `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;

      firebaseApp =
        getApps().length > 0
          ? getApps()[0]
          : initializeApp({
              ...firebaseConfig,
              databaseURL: resolvedDatabaseURL,
            });

      firebaseAuth = getAuth(firebaseApp);
      firestoreDb = getFirestore(firebaseApp);
      try {
        realtimeDb = getDatabase(firebaseApp, resolvedDatabaseURL);
      } catch {
        realtimeDb = null;
      }
      cloudFunctions = getFunctions(firebaseApp, functionsRegion);

      if (useEmulators && !emulatorsConnected && typeof window !== 'undefined') {
        emulatorsConnected = true;
        const host = window.location.hostname || 'localhost';
        connectAuthEmulator(firebaseAuth, `http://${host}:9099`, {
          disableWarnings: true,
        });
        connectFirestoreEmulator(firestoreDb, host, 8080);
        if (realtimeDb) {
          connectDatabaseEmulator(realtimeDb, host, 9000);
        }
        connectFunctionsEmulator(cloudFunctions, host, 5001);
      }
    }

    if (!firebaseApp || !firebaseAuth || !firestoreDb || !cloudFunctions) {
      return null;
    }

    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firestoreDb,
      rtdb: realtimeDb,
      functions: cloudFunctions,
    };
  } catch {
    return null;
  }
}

let pendingAuthPromise: Promise<User | null> | null = null;

/**
 * Invisibly signs in the player using Firebase Anonymous Authentication.
 * Never prompts for a visible login screen.
 */
export async function ensureAnonymousAuth(): Promise<User | null> {
  const services = getFirebaseServices();
  if (!services) return null;

  const { auth } = services;
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (existingUser) => {
        unsubscribe();
        if (existingUser) {
          resolve(existingUser);
          return;
        }
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch {
          resolve(null);
        }
      },
      () => {
        unsubscribe();
        resolve(null);
      }
    );
  }).finally(() => {
    pendingAuthPromise = null;
  });

  return pendingAuthPromise;
}
