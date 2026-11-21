// ============================================================
// CONVET PULSE — Desktop Update Notification & Installation Modal
// Displays available updates with release notes, progress tracking,
// and safe relaunch.
// ============================================================

import React, { useState } from 'react';
import { DownloadCloud, Sparkles, RefreshCw, AlertCircle, ArrowRight, X } from 'lucide-react';
import { type AppUpdateInfo, downloadAndInstallUpdate } from '@/lib/updater';

interface UpdateModalProps {
  updateInfo: AppUpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ updateInfo, isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !updateInfo) return null;

  const handleInstall = async () => {
    setDownloading(true);
    setErrorMessage('');
    setProgressPercent(0);
    setStatusMessage('Connecting to GitHub Releases...');

    const result = await downloadAndInstallUpdate(
      updateInfo.rawUpdate,
      (percent, message) => {
        setProgressPercent(percent);
        setStatusMessage(message);
      }
    );

    if (!result.success) {
      setDownloading(false);
      setErrorMessage(result.error || 'Failed to install update.');
    }
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
          style={{ background: 'var(--accent, #6366f1)' }}
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
              background: 'linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6)',
              boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Update Available
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                v{updateInfo.version}
              </span>
            </h3>
            <p className="text-xs text-white/60">
              Current version: <span className="font-mono text-white/80">v{updateInfo.currentVersion}</span>
            </p>
          </div>
        </div>

        {/* Release Notes / Details */}
        <div className="mb-5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/75 max-h-36 overflow-y-auto">
          {updateInfo.body ? (
            <div className="whitespace-pre-wrap leading-relaxed">{updateInfo.body}</div>
          ) : (
            <p className="text-white/60">
              A new update for CONVET PULSE is ready to install. This release includes enhancements, security updates, and performance improvements.
            </p>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Download Progress Bar */}
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
          {!downloading ? (
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
                onClick={handleInstall}
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
              Please wait while the update installs...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
