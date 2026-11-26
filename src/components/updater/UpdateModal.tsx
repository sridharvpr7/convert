// ============================================================
// CONVET PULSE — Desktop & Android Update Notification & Installation Modal
// Displays available updates with release notes, progress tracking,
// safe restart for Windows, and official signed APK guidance for Android.
// ============================================================

import React, { useState } from 'react';
import {
  DownloadCloud,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  X,
  ExternalLink,
  CheckCircle2,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import { type AppUpdateInfo, downloadAndInstallUpdate, relaunchApp } from '@/lib/updater';

interface UpdateModalProps {
  updateInfo: AppUpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatusChange?: (status: 'idle' | 'downloading' | 'restart-required') => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
  onUpdateStatusChange,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRestartRequired, setIsRestartRequired] = useState(false);

  if (!isOpen || !updateInfo) return null;

  const isAndroid = updateInfo.platform === 'android';

  const handleOpenAndroidRelease = async () => {
    const url = updateInfo.downloadUrl || 'https://github.com/sridharvpr7/convert/releases/latest';
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleInstallWindows = async () => {
    setDownloading(true);
    setErrorMessage('');
    setProgressPercent(0);
    setStatusMessage('Connecting to GitHub Releases...');
    onUpdateStatusChange?.('downloading');

    const result = await downloadAndInstallUpdate(
      updateInfo.rawUpdate,
      (percent, message) => {
        setProgressPercent(percent);
        setStatusMessage(message);
      }
    );

    setDownloading(false);

    if (result.success) {
      setIsRestartRequired(true);
      setStatusMessage('Update successfully installed.');
      onUpdateStatusChange?.('restart-required');
    } else {
      setErrorMessage(result.error || 'Failed to install update.');
      onUpdateStatusChange?.('idle');
    }
  };

  const handleRestartNow = async () => {
    await relaunchApp();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(24, 27, 36, 0.98), rgba(15, 17, 23, 0.99))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
        }}
      >
        {/* Subtle accent glow header */}
        <div
          className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-40"
          style={{ background: isRestartRequired ? '#10b981' : 'var(--accent, #6366f1)' }}
        />

        {/* Close Button (disabled while downloading) */}
        {!downloading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{
              background: isRestartRequired
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : isAndroid
                ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                : 'linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6)',
              boxShadow: isRestartRequired
                ? '0 8px 16px -4px rgba(16, 185, 129, 0.4)'
                : '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
            }}
          >
            {isRestartRequired ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isAndroid ? (
              <Smartphone className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {isRestartRequired
                ? 'Restart Required'
                : isAndroid
                ? 'Android Update Available'
                : 'Update Available'}
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                v{updateInfo.version}
              </span>
            </h3>
            <p className="text-xs text-white/60">
              Current version: <span className="font-mono text-white/80">v{updateInfo.currentVersion}</span>
            </p>
          </div>
        </div>

        {/* Android Guidance or Release Notes */}
        {isAndroid ? (
          <div className="mb-5 space-y-3">
            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200/90 leading-relaxed">
              <p className="font-semibold text-cyan-300 mb-1">Official Android Release</p>
              Signed Android APK updates are distributed directly via our official GitHub Releases repository. Automatic in-app package replacement is disabled on Android to preserve device security.
            </div>
            {updateInfo.body && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70 max-h-28 overflow-y-auto whitespace-pre-wrap">
                {updateInfo.body}
              </div>
            )}
          </div>
        ) : isRestartRequired ? (
          <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
            <p className="font-semibold text-emerald-200">Update Installed Successfully!</p>
            <p className="text-emerald-400/90">
              Restart CONVET PULSE now to run version <span className="font-mono font-semibold">v{updateInfo.version}</span>. Your open work and workspace settings will be preserved.
            </p>
          </div>
        ) : (
          <div className="mb-5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/75 max-h-36 overflow-y-auto">
            {updateInfo.body ? (
              <div className="whitespace-pre-wrap leading-relaxed">{updateInfo.body}</div>
            ) : (
              <p className="text-white/60">
                A new signed release of CONVET PULSE is available. This release contains new features, stability enhancements, and performance optimizations.
              </p>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Download & Install Progress Bar (Windows Desktop) */}
        {downloading && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between text-xs text-white/70">
              <span className="flex items-center gap-1.5 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                {statusMessage}
              </span>
              <span className="font-mono font-semibold text-accent">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, var(--accent, #6366f1), #a855f7)',
                }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
          {isAndroid ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleOpenAndroidRelease}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  boxShadow: '0 8px 20px -4px rgba(2, 132, 199, 0.4)',
                }}
              >
                <DownloadCloud className="w-4 h-4" />
                Download Signed APK
                <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </>
          ) : isRestartRequired ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Restart Later
              </button>
              <button
                type="button"
                onClick={handleRestartNow}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.4)',
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Restart Now
              </button>
            </>
          ) : !downloading ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleInstallWindows}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6)',
                  boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)',
                }}
              >
                <DownloadCloud className="w-4 h-4" />
                Install Update
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="text-xs text-white/40 italic py-1">
              Please wait while the update downloads and installs...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
