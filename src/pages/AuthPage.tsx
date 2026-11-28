import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, RefreshCw, Monitor, X } from 'lucide-react';
import { ConveterLogo } from '@/components/ui/Logo';
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { googleProvider, requireFirebaseAuth, toAppUser } from '@/lib/firebase';
import { apiClient } from '@/lib/api';
import { isDesktop } from '@/lib/platform';
import {
  loginWithGoogleDesktopPKCE,
  getGoogleDesktopClientId,
  cancelDesktopOAuth,
} from '@/lib/desktopOAuth';
import { useAppStore } from '@/store/app.store';

interface AuthPageProps {
  mode: 'login' | 'register' | 'forgot' | 'reset';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [desktopAuthInProgress, setDesktopAuthInProgress] = useState(false);
  const [desktopAuthStatus, setDesktopAuthStatus] = useState('');
  const [desktopAuthAbort, setDesktopAuthAbort] = useState<AbortController | null>(null);
  const [desktopSessionInfo, setDesktopSessionInfo] = useState<{ sessionId: string; pollToken: string } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAppStore((state) => state.setUser);

  const readableAuthError = (value: unknown) => {
    const code = (value as { code?: string })?.code;
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/email-already-in-use': 'An account already exists for this email.',
      'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
      'auth/unauthorized-domain': 'Add this Render domain to Firebase Authentication → Settings → Authorized domains.',
      'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication → Sign-in method.',
      'auth/expired-action-code': 'This password reset link has expired. Request a new one.',
      'auth/invalid-action-code': 'This password reset link is invalid or has already been used.',
    };
    return messages[code || ''] || (value instanceof Error ? value.message : 'Sign-in failed. Please try again.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const redirectTarget = searchParams.get('redirect') || (searchParams.get('plan') ? `/pricing?plan=${encodeURIComponent(searchParams.get('plan') || '')}` : '/dashboard');
    try {
      const auth = requireFirebaseAuth();
      if (mode === 'reset' && password !== confirmPassword) {
        throw new Error('The passwords do not match.');
      }
      if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const appUser = {
          id: credential.user.uid,
          name: credential.user.displayName || credential.user.email?.split('@')[0] || 'User',
          email: credential.user.email || '',
          avatar: credential.user.photoURL || undefined,
          plan: 'free' as const,
        };
        setUser(appUser);
        apiClient.notifyLogin({
          userId: appUser.id,
          name: appUser.name,
          email: appUser.email,
          provider: 'Email & Password',
        }).then(() => {
          // Suppress the redundant app-open notification from onAuthStateChanged
          sessionStorage.setItem('conveter_login_notified', String(Date.now()));
        }).catch(() => {});
        navigate(redirectTarget);
      } else if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name.trim() });
        const appUser = {
          id: credential.user.uid,
          name: name.trim(),
          email: credential.user.email || email,
          avatar: credential.user.photoURL || undefined,
          plan: 'free' as const,
        };
        setUser(appUser);
        apiClient.notifyLogin({
          userId: appUser.id,
          name: appUser.name,
          email: appUser.email,
          provider: 'Registration',
          isNewRegistration: true,
        }).then(() => {
          // Suppress the redundant app-open notification from onAuthStateChanged
          sessionStorage.setItem('conveter_login_notified', String(Date.now()));
        }).catch(() => {});
        navigate(redirectTarget);
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSubmitted(true);
      } else {
        const actionCode = searchParams.get('oobCode');
        if (!actionCode) throw new Error('Open the password reset link from your email to choose a new password.');
        await confirmPasswordReset(auth, actionCode, password);
        setSubmitted(true);
      }
    } catch (authError) {
      setError(readableAuthError(authError));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDesktopAuth = () => {
    if (desktopAuthAbort) {
      desktopAuthAbort.abort();
    }
    cancelDesktopOAuth().catch(() => {});
    if (desktopSessionInfo) {
      apiClient.cancelDesktopAuth(desktopSessionInfo.sessionId, desktopSessionInfo.pollToken);
    }
    setDesktopAuthInProgress(false);
    setLoading(false);
    setDesktopAuthAbort(null);
    setDesktopSessionInfo(null);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const redirectTarget = searchParams.get('redirect') || (searchParams.get('plan') ? `/pricing?plan=${encodeURIComponent(searchParams.get('plan') || '')}` : '/dashboard');

    // ─────────────────────────────────────────────────────────
    // Windows Desktop Tauri Authentication Flow
    // In Tauri Windows (Edge WebView2), embedded OAuth popups fail with
    // "Failed to fetch" due to WebView2 origin CORS restrictions.
    // We authenticate via external browser using OAuth 2.0 PKCE with
    // localhost loopback callback (or secure server-assisted bridge).
    // ─────────────────────────────────────────────────────────
    if (isDesktop()) {
      setDesktopAuthInProgress(true);
      setDesktopAuthStatus('Opening default browser for Google Sign-In...');

      const abort = new AbortController();
      setDesktopAuthAbort(abort);

      try {
        const desktopClientId = getGoogleDesktopClientId();
        let appUser;

        if (desktopClientId) {
          // Direct Authorization Code Flow with PKCE S256 & Localhost Loopback Listener (RFC 8252)
          const firebaseUser = await loginWithGoogleDesktopPKCE(
            (statusText) => setDesktopAuthStatus(statusText),
            abort.signal
          );
          appUser = toAppUser(firebaseUser);
        } else {
          // Server-assisted bridge session fallback
          const session = await apiClient.initDesktopAuthSession();
          if (!session.success || !session.sessionId || !session.pollToken || !session.authUrl) {
            throw new Error(
              session.error ||
              'Desktop Google Sign-In requires configuring a Google Desktop Client ID (VITE_GOOGLE_DESKTOP_CLIENT_ID).'
            );
          }

          setDesktopSessionInfo({ sessionId: session.sessionId, pollToken: session.pollToken });

          const { openUrl } = await import('@tauri-apps/plugin-opener');
          await openUrl(session.authUrl);

          setDesktopAuthStatus('Waiting for Google Sign-In in your browser...');

          const result = await apiClient.pollDesktopAuthSession(
            session.sessionId,
            session.pollToken,
            (statusText) => setDesktopAuthStatus(statusText),
            abort.signal
          );

          if (!result.success || !result.idToken) {
            throw new Error(result.error || 'Google Sign-In was cancelled or timed out.');
          }

          setDesktopAuthStatus('Connecting desktop session...');

          const auth = requireFirebaseAuth();
          const credential = GoogleAuthProvider.credential(
            result.idToken,
            result.accessToken || undefined
          );
          const userCredential = await signInWithCredential(auth, credential);
          appUser = toAppUser(userCredential.user);
        }

        setUser(appUser);

        apiClient.notifyLogin({
          userId: appUser.id,
          name: appUser.name,
          email: appUser.email,
          provider: 'Google (Desktop)',
        }).then(() => {
          sessionStorage.setItem('conveter_login_notified', String(Date.now()));
        }).catch(() => {});

        setDesktopAuthInProgress(false);
        navigate(redirectTarget);
      } catch (authError) {
        setDesktopAuthInProgress(false);
        setError(readableAuthError(authError));
      } finally {
        setLoading(false);
        setDesktopAuthAbort(null);
        setDesktopSessionInfo(null);
        cancelDesktopOAuth().catch(() => {});
      }
      return;
    }

    // ─────────────────────────────────────────────────────────
    // Web, Android & Localhost: Standard Firebase Popup Flow
    // ─────────────────────────────────────────────────────────
    try {
      const credential = await signInWithPopup(requireFirebaseAuth(), googleProvider);
      const appUser = {
        id: credential.user.uid,
        name: credential.user.displayName || 'User',
        email: credential.user.email || '',
        avatar: credential.user.photoURL || undefined,
        plan: 'free' as const,
      };
      setUser(appUser);
      apiClient.notifyLogin({
        userId: appUser.id,
        name: appUser.name,
        email: appUser.email,
        provider: 'Google',
      }).then(() => {
        // Suppress the redundant app-open notification from onAuthStateChanged
        sessionStorage.setItem('conveter_login_notified', String(Date.now()));
      }).catch(() => {});
      navigate(redirectTarget);
    } catch (authError) {
      setError(readableAuthError(authError));
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: 'Welcome back',
    register: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Set new password',
  };

  const subtitles = {
    login: 'Sign in to your CONVETER account',
    register: 'Start converting files for free — no credit card',
    forgot: "Enter your email and we'll send a reset link",
    reset: 'Choose a new secure password',
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Left: branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 pt-20 w-[420px] flex-shrink-0"
        style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <Link to="/">
          <ConveterLogo size={32} />
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-3">
              Everything you need to work with files
            </h2>
            <p className="text-secondary">
              17 essential tools. Fast local processing. Developed and maintained by the CONVET PULSE project developer.
            </p>
          </div>

          <div className="space-y-3">
            {[
              '17 high-performance conversion tools',
              'Process files locally in your browser — privacy first',
              'Batch processing and reproducible workflow pipelines',
              'High-speed client-side document processing',
              'Free community access with generous limits',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span className="text-sm text-secondary">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-cv">
          © {new Date().getFullYear()} CONVETER. All rights reserved.
        </p>
      </div>

      {/* Right: form panel */}
      <div className="flex-1 flex items-center justify-center p-6 pt-16 sm:p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Link to="/">
              <ConveterLogo size={28} />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary mb-1">
              {titles[mode]}
            </h1>
            <p className="text-secondary text-sm">{subtitles[mode]}</p>
          </div>

          {/* Forgot password success state */}
          {mode === 'forgot' && submitted ? (
            <div
              className="p-6 rounded-xl border flex flex-col items-center gap-3 text-center"
              style={{ backgroundColor: '#22c55e08', borderColor: '#22c55e30' }}
            >
              <CheckCircle2 size={32} style={{ color: '#22c55e' }} />
              <div>
                <p className="font-semibold text-primary">Check your email</p>
                <p className="text-sm text-secondary mt-1">
                  We sent a password reset link to <strong>{email}</strong>
                </p>
              </div>
              <Link to="/login" className="btn-primary btn-md w-full justify-center mt-2">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {/* OAuth button */}
              {(mode === 'login' || mode === 'register') && (
                <>
                  <button
                    type="button"
                    className="btn-secondary btn-lg w-full gap-3 mb-4"
                    disabled={loading}
                    onClick={handleGoogleSignIn}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="relative flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                    <span className="text-xs text-muted-cv">or</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                  </div>
                </>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="name" className="label">Full Name</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-lg"
                      placeholder="John Doe"
                      required
                      autoComplete="name"
                    />
                  </div>
                )}

                {mode !== 'reset' && (
                  <div>
                    <label htmlFor="email" className="label">Email address</label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-lg pl-10"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                )}

                {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="password" className="label mb-0">Password</label>
                      {mode === 'login' && (
                        <Link to="/forgot-password" className="text-xs hover:text-accent transition-colors" style={{ color: 'var(--accent)' }}>
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-lg pl-10 pr-10"
                        placeholder={mode === 'reset' ? 'New password' : '••••••••'}
                        required
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mode === 'register' && (
                      <p className="text-xs text-muted-cv mt-1.5">
                        Minimum 8 characters
                      </p>
                    )}
                  </div>
                )}

                {mode === 'reset' && (
                  <div>
                    <label htmlFor="confirm-password" className="label">Confirm Password</label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-lg pl-10"
                        placeholder="Confirm new password"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary btn-lg w-full justify-center"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {mode === 'login' ? 'Signing in...' : mode === 'register' ? 'Creating account...' : 'Sending...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Set Password'}
                      <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>

              {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600">{error}</p>}
              {mode === 'reset' && submitted && <p role="status" className="mt-4 text-sm text-green-600">Password updated. <Link to="/login" className="underline">Sign in</Link></p>}

              {/* Switch mode */}
              <p className="text-sm text-secondary text-center mt-6">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <Link to="/register" className="font-medium hover:text-accent transition-colors" style={{ color: 'var(--accent)' }}>
                      Create one free
                    </Link>
                  </>
                ) : mode === 'register' ? (
                  <>
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium hover:text-accent transition-colors" style={{ color: 'var(--accent)' }}>
                      Sign in
                    </Link>
                  </>
                ) : (
                  <>
                    Remember your password?{' '}
                    <Link to="/login" className="font-medium hover:text-accent transition-colors" style={{ color: 'var(--accent)' }}>
                      Sign in
                    </Link>
                  </>
                )}
              </p>

              {mode === 'register' && (
                <p className="text-xs text-muted-cv text-center mt-4">
                  By creating an account, you agree to our{' '}
                  <a href="#" style={{ color: 'var(--accent)' }}>Terms</a>{' '}
                  and{' '}
                  <a href="#" style={{ color: 'var(--accent)' }}>Privacy Policy</a>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Windows Desktop Google Auth Progress Modal */}
      {desktopAuthInProgress && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 text-center space-y-4 shadow-2xl relative overflow-hidden"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.2)',
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                <Monitor className="w-4 h-4 text-accent" />
                Browser Sign-In Active
              </h3>
              <p className="text-xs text-muted-cv mt-1.5 leading-relaxed">
                {desktopAuthStatus || 'Opening default browser for Google Sign-In...'}
              </p>
            </div>

            <p className="text-2xs text-white/50 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
              Please complete Google Sign-In in your browser. This desktop window will automatically detect your login and connect.
            </p>

            <button
              type="button"
              onClick={handleCancelDesktopAuth}
              className="btn-secondary btn-sm w-full justify-center text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
