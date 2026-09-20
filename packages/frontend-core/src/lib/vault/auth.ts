/**
 * Vault Firebase Auth
 *
 * Thin wrapper around Firebase Google Sign-In.
 * Lazy-initializes the Firebase app on first call so it doesn't
 * affect pages that don't use the Vault.
 *
 * After sign-in the Google UID is used to derive a deterministic
 * master key via HKDF — meaning any device signed into the same
 * Google account derives the same encryption key and the same
 * yjs room ID, enabling zero-code auto-pair.
 */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCkq2q4kxUyY-Cj2YTNXweI7ckzIx7eots',
  authDomain: 'clex-in.firebaseapp.com',
  projectId: 'clex-in',
  storageBucket: 'clex-in.firebasestorage.app',
  messagingSenderId: '1050016400675',
  appId: '1:1050016400675:web:32eaedd53bc82d2663f896',
  measurementId: 'G-P5RC17ZCY2',
}

export interface VaultUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

// ── Singleton ───────────────────────────────────────────────────────────────

type FirebaseApp = import('firebase/app').FirebaseApp
type FirebaseAuth = import('firebase/auth').Auth
let _auth: FirebaseAuth | null = null
async function getFirebaseApp(): Promise<FirebaseApp> {
  const { initializeApp, getApps, getApp } = await import('firebase/app')
  return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG)
}

// NOTE: Google Analytics for Firebase used to be initialised here, on every
// call to getFirebaseApp() — so merely resolving the auth state started it.
// It sets _ga / _ga_* cookies and reports usage telemetry, which is neither
// strictly necessary nor consented to, and under GDPR/ePrivacy that needs an
// opt-in before a single byte is written. Nothing in Clex read the data, and
// the product is positioned as privacy-first with a storage disclosure that
// states there is no analytics and no cookie.
//
// If analytics is wanted later it has to be: (1) off by default, (2) started
// only after an explicit opt-in recorded by the storage notice, and (3)
// listed on /cookies before it ships.

async function getFirebaseAuth(): Promise<FirebaseAuth> {
  if (_auth) return _auth
  const [{ getAuth }, app] = await Promise.all([
    import('firebase/auth'),
    getFirebaseApp(),
  ])
  _auth = getAuth(app)
  return _auth
}

function toVaultUser(u: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): VaultUser {
  return { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sign in with Google (popup).
 * Returns the signed-in user, or null if the popup was cancelled.
 */
export async function signInWithGoogle(): Promise<VaultUser | null> {
  try {
    const auth = await getFirebaseAuth()
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    const result = await signInWithPopup(auth, provider)
    return toVaultUser(result.user)
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null  // user dismissed — not an error
    }
    throw e
  }
}

/** Sign out the current user. */
export async function signOutGoogle(): Promise<void> {
  const auth = await getFirebaseAuth()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
}

/**
 * Return the Firebase Google ID token for authenticated API calls.
 * The API can accept this as `Authorization: Bearer <token>`.
 */
export async function getGoogleIdToken(forceRefresh = false): Promise<string | null> {
  const auth = await getFirebaseAuth()
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null
}

/**
 * Subscribe to auth state.
 * Fires immediately with current user (or null).
 * Returns an unsubscribe function — call it in onDestroy.
 */
export async function onVaultAuthChanged(
  callback: (user: VaultUser | null) => void,
): Promise<() => void> {
  const auth = await getFirebaseAuth()
  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(auth, (user) => {
    callback(user ? toVaultUser(user) : null)
  })
}
