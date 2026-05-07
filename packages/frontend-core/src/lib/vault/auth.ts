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
}

export interface VaultUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

// ── Singleton ─────────────────────────────────────────────────────────────────

type FirebaseAuth = import('firebase/auth').Auth
let _auth: FirebaseAuth | null = null

async function getFirebaseAuth(): Promise<FirebaseAuth> {
  if (_auth) return _auth
  const [{ initializeApp, getApps, getApp }, { getAuth }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ])
  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG)
  _auth = getAuth(app)
  return _auth
}

function toVaultUser(u: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): VaultUser {
  return { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL }
}

// ── Public API ────────────────────────────────────────────────────────────────

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
