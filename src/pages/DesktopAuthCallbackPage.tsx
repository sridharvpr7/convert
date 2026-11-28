// ============================================================
// CONVET PULSE — Desktop Auth Callback Bridge Page
// Renders in the user's default system browser when desktop Google
// OAuth is initiated. Performs standard web-based Google OAuth
// and cryptographically transmits authorization back to Desktop.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ConveterLogo } from '@/components/ui/Logo';
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { googleProvider, requireFirebaseAuth } from '@/lib/firebase';
import { apiClient } from '@/lib/api';
import { CheckCircle2, AlertCircle, RefreshCw, Monitor, ArrowRight, ShieldCheck } from 'lucide-react';

export const DesktopAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [status, setStatus] = useState<'idle' | 'signing-in' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // If no sessionId is in the URL, flag immediately
    if (!sessionId) {
      setStatus('error');
      setErrorMessage('Missing session identifier. Please initiate Google Sign-In from the CONVET PULSE Desktop app.');
    }
  }, [sessionId]);

  const handleGoogleSignIn = async () => {
    if (!sessionId) return;
    setStatus('signing-in');
    setErrorMessage('');

    try {
      const auth = requireFirebaseAuth();
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken;
      const accessToken = credential?.accessToken;

      if (!idToken) {
        throw new Error('Google did not return a valid authentication token. Please try again.');
      }

      setUserEmail(result.user.email || '');

      const completion = await apiClient.completeDesktopAuthSession(
        sessionId,
        idToken,
        accessToken || undefined
      );

      if (!completion.success) {
        throw new Error(completion.error || 'Failed to authorize desktop application.');
      }

      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setErrorMessage('Sign-in popup was closed before completion. Please try again.');
      } else {
        setErrorMessage(msg || 'Google Sign-In failed.');
      }
    }
  };

  const handleCloseTab = () => {
    window.close();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 pt-16 sm:pt-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-2xl relative overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 30px rgba(99, 102, 241, 0.1)',
        }}
      >
        {/* Subtle accent glow */}
        <div
          className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-30"
          style={{ background: status === 'success' ? '#10b981' : 'var(--accent, #6366f1)' }}
        />

        {/* Brand header */}
        <div className="flex items-center justify-center mb-6">
          <ConveterLogo size={36} />
        </div>

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Sign-In Successful!</h2>
              <p className="text-xs text-muted-cv mt-1.5 leading-relaxed">
                {userEmail ? (
                  <>
                    Signed in as <span className="font-semibold text-white/90">{userEmail}</span>.
                  </>
                ) : null}
                <br />
                Your desktop application has been authorized.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 text-left flex items-start gap-2.5">
              <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div className="leading-relaxed">
                You can now close this browser tab and return to <strong>CONVET PULSE Desktop</strong>. Your session is active.
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCloseTab}
                className="btn-primary w-full justify-center"
              >
                Close Tab
              </button>
              <Link to="/dashboard" className="text-xs text-muted-cv hover:text-white transition-colors">
                Or continue in web browser →
              </Link>
            </div>
          </div>
        )}

        {/* Signing In State */}
        {status === 'signing-in' && (
          <div className="text-center space-y-4 py-4 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Connecting with Google...</h2>
              <p className="text-xs text-muted-cv mt-1">
                Please complete the Google authentication prompt in the popup window.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-2xs text-muted-cv">
              Security note: Your tokens are cryptographically verified and transferred securely to your local desktop installation.
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Sign-In Required Attention</h2>
              <p className="text-xs text-red-400/90 mt-1.5 leading-relaxed">
                {errorMessage || 'Failed to complete Google Sign-In for desktop.'}
              </p>
            </div>

            {sessionId ? (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="btn-primary w-full justify-center"
              >
                Try Again
              </button>
            ) : (
              <p className="text-2xs text-muted-cv">
                Please return to CONVET PULSE Desktop and click &ldquo;Continue with Google&rdquo; to start a new session.
              </p>
            )}
          </div>
        )}

        {/* Idle State */}
        {status === 'idle' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3 border border-accent/20">
                <Monitor className="w-3.5 h-3.5" />
                Desktop Authorization
              </div>
              <h2 className="text-xl font-bold text-white">Sign In to CONVET PULSE</h2>
              <p className="text-xs text-muted-cv mt-1.5 leading-relaxed">
                Authenticate with Google in this browser to securely connect your Windows Desktop application.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs text-muted-cv">
              <div className="flex items-center gap-2 text-white/80 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Verified &amp; Secure Desktop Bridge
              </div>
              <p className="text-2xs text-white/60 leading-relaxed">
                Google requires desktop apps to authenticate in your default system browser for phishing protection. Once authenticated, your session will automatically sync to desktop.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full h-11 px-4 rounded-xl border font-medium text-sm transition-all duration-150 flex items-center justify-center gap-3 shadow-lg hover:bg-hover-cv"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4 ml-auto text-muted-cv" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopAuthCallbackPage;
