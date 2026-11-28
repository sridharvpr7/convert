// ============================================================
// CONVET PULSE — Windows Desktop Google OAuth PKCE Flow (RFC 8252)
// Direct Authorization Code Flow with PKCE S256 and Localhost Loopback.
// Authenticates into Firebase Auth using signInWithCredential().
// ============================================================

import { GoogleAuthProvider, signInWithCredential, type User as FirebaseUser } from 'firebase/auth';
import { requireFirebaseAuth } from './firebase';

export interface OAuthTokens {
  id_token: string;
  access_token: string;
}

/**
 * Returns the configured Google Desktop Client ID from environment variables.
 */
export function getGoogleDesktopClientId(): string {
  const env = import.meta.env;
  return (
    env.VITE_GOOGLE_DESKTOP_CLIENT_ID ||
    env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
}

/**
 * Encodes a buffer or array of bytes into a URL-safe Base64 string (no padding).
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a cryptographically random, URL-safe string.
 */
function generateRandomString(length = 64): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

/**
 * Computes PKCE code_challenge from code_verifier using SHA-256.
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Executes direct desktop Google OAuth with PKCE S256 and localhost loopback.
 */
export async function loginWithGoogleDesktopPKCE(
  onStatus?: (status: string) => void,
  signal?: AbortSignal
): Promise<FirebaseUser> {
  const clientId = getGoogleDesktopClientId();

  if (!clientId) {
    throw new Error(
      'Google Desktop OAuth Client ID is not configured.\n' +
      'Please create a "Desktop app" OAuth Client ID in Google Cloud Console ' +
      'and add VITE_GOOGLE_DESKTOP_CLIENT_ID to your .env.local file.'
    );
  }

  onStatus?.('Preparing secure loopback listener...');

  // 1. Generate PKCE code_verifier and code_challenge
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  // 2. Start native Rust localhost loopback listener on ephemeral port
  const { invoke } = await import('@tauri-apps/api/core');
  
  const prepared = await invoke<{ port: number }>('start_oauth_listener');
  const port = prepared.port;
  const redirectUri = `http://127.0.0.1:${port}`;

  if (signal?.aborted) {
    await invoke('cancel_oauth_listener').catch(() => {});
    throw new Error('Sign-in was cancelled.');
  }

  // 3. Construct Google OAuth 2.0 Authorization URL
  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

  onStatus?.('Opening default browser for Google Sign-In...');

  // 4. Open authorization URL in user's default system browser (Chrome/Edge/Firefox)
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(authUrl);

  onStatus?.('Waiting for Google Sign-In completion in your browser...');

  // Listen for abort signal while waiting
  const abortHandler = () => {
    invoke('cancel_oauth_listener').catch(() => {});
  };
  signal?.addEventListener('abort', abortHandler, { once: true });

  let callbackResult: { code: string; state: string };
  try {
    // 5. Await the loopback callback with timeout
    callbackResult = await invoke<{ code: string; state: string }>('wait_for_oauth_callback', {
      expectedState: state,
      timeoutSeconds: 120,
    });
  } catch (err) {
    await invoke('cancel_oauth_listener').catch(() => {});
    if (signal?.aborted) {
      throw new Error('Sign-in was cancelled.');
    }
    throw err;
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }

  // 6. Double-check CSRF state
  if (callbackResult.state !== state) {
    throw new Error('OAuth state mismatch: Possible cross-site request forgery attempt.');
  }

  onStatus?.('Exchanging authorization code...');

  // 7. Exchange authorization code for Google ID token and Access token
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code: callbackResult.code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errorData = await tokenRes.json().catch(() => ({}));
    const desc = errorData.error_description || errorData.error || 'Token exchange failed';
    throw new Error(`Google token exchange error: ${desc}`);
  }

  const tokens = (await tokenRes.json()) as OAuthTokens;
  if (!tokens.id_token) {
    throw new Error('Google did not return an ID token in response.');
  }

  onStatus?.('Finalizing Firebase desktop session...');

  // 8. Authenticate into Firebase with GoogleAuthProvider.credential
  const auth = requireFirebaseAuth();
  const credential = GoogleAuthProvider.credential(tokens.id_token, tokens.access_token);
  const userCredential = await signInWithCredential(auth, credential);

  return userCredential.user;
}

/**
 * Cancels any active desktop OAuth loopback listener.
 */
export async function cancelDesktopOAuth(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('cancel_oauth_listener');
  } catch {
    // safe ignore
  }
}
