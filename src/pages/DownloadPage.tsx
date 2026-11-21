// ============================================================
// CONVET PULSE — Cross-Platform Download Center
// Official download hub for Windows Desktop, Android, and Web.
// Integrates with authentic GitHub Releases data.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Smartphone,
  Globe,
  Download,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Cpu,
  HardDrive,
  Calendar,
  Sparkles,
  Info,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import {
  fetchLatestRelease,
  type AppRelease,
  type ReleaseFetchResult,
} from '@/lib/releases';

export const DownloadPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [releaseResult, setReleaseResult] = useState<ReleaseFetchResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<'windows' | 'android' | 'web' | null>('windows');

  const loadReleaseData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const result = await fetchLatestRelease(forceRefresh);
      setReleaseResult(result);
    } catch (err) {
      setReleaseResult({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to fetch release data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReleaseData();
  }, []);

  const release: AppRelease | undefined =
    releaseResult?.status === 'success' ? releaseResult.release : undefined;

  const toggleSection = (section: 'windows' | 'android' | 'web') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 animate-fade-in">
      {/* ── Hero / Header ────────────────────────────────────────── */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-accent-subtle text-accent border border-accent/20">
          <Sparkles size={14} />
          <span>Official Cross-Platform Suite</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary">
          Download <span className="text-accent">CONVET PULSE</span>
        </h1>
        <p className="text-base sm:text-lg text-secondary leading-relaxed">
          High-performance, privacy-first local file conversion and processing.
          Run natively on Windows, on your Android smartphone, or instantly in your browser.
        </p>

        {/* Dynamic Status / Version Pill */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-cv">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface border" style={{ borderColor: 'var(--border)' }}>
              <RefreshCw size={12} className="animate-spin text-accent" />
              <span>Fetching latest release metadata...</span>
            </div>
          ) : release ? (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border" style={{ borderColor: 'var(--border)' }}>
                <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                <span className="font-semibold text-primary">Latest Version: {release.version}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border" style={{ borderColor: 'var(--border)' }}>
                <Calendar size={12} className="text-secondary" />
                <span>Released: {release.publishedDateFormatted}</span>
              </div>
              <a
                href={release.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-accent hover:underline font-medium"
              >
                <span>GitHub Release Notes</span>
                <ExternalLink size={11} />
              </a>
            </>
          ) : releaseResult?.status === 'no-releases' ? (
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Info size={13} />
              <span>Release builds pending publication on GitHub</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle size={13} />
              <span>Unable to connect to GitHub Releases API</span>
              <button
                onClick={() => loadReleaseData(true)}
                className="ml-2 underline font-medium hover:text-white"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Error Banner (if API failed) ────────────────────────── */}
      {releaseResult?.status === 'error' && !loading && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-rose-400 shrink-0" size={20} />
            <div className="text-sm">
              <p className="font-semibold text-rose-300">Could not retrieve live release data</p>
              <p className="text-rose-200/80 text-xs">{releaseResult.message}</p>
            </div>
          </div>
          <button
            onClick={() => loadReleaseData(true)}
            className="btn-secondary btn-sm shrink-0 flex items-center gap-2"
          >
            <RefreshCw size={13} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* ── 3-Platform Download Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        {/* 1. WINDOWS DESKTOP CARD */}
        <div className="glass-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between border transition-all duration-300 hover:shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                <Monitor size={26} />
              </div>
              <span className="text-2xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Desktop
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                Windows Desktop
              </h2>
              <p className="text-xs text-secondary mt-1">
                Native x64 desktop app powered by Tauri v2 with automatic background updates.
              </p>
            </div>

            {/* Spec metadata */}
            <div className="p-3.5 rounded-xl bg-surface/70 border space-y-2 text-xs" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><Cpu size={13} className="text-muted-cv" /> Architecture:</span>
                <span className="font-mono font-medium text-primary">x64 (NSIS Installer)</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><HardDrive size={13} className="text-muted-cv" /> File Size:</span>
                <span className="font-mono font-medium text-primary">
                  {loading
                    ? '...'
                    : release?.downloads.windows?.sizeFormatted || 'Build pending (~8-15 MB)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-muted-cv" /> Version:</span>
                <span className="font-mono font-medium text-primary">
                  {loading ? '...' : release?.version || '1.0.0'}
                </span>
              </div>
            </div>

            {/* Highlights */}
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Zero cloud upload — 100% private local conversions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Built-in Tauri auto-updater with signature verification</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Lightweight native Rust &amp; WebView2 engine</span>
              </li>
            </ul>
          </div>

          {/* Download CTA */}
          <div className="pt-6 mt-6 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            {release?.downloads.windows ? (
              <a
                href={release.downloads.windows.downloadUrl}
                download
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Download size={16} />
                <span>Download for Windows (.exe)</span>
              </a>
            ) : (
              <a
                href="https://github.com/sridharvpr7/convert/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
              >
                <ExternalLink size={15} />
                <span>View Releases on GitHub</span>
              </a>
            )}
            <p className="text-3xs text-center text-muted-cv">
              Compatible with Windows 10 &amp; 11 (64-bit)
            </p>
          </div>
        </div>

        {/* 2. ANDROID CARD */}
        <div className="glass-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between border transition-all duration-300 hover:shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <Smartphone size={26} />
              </div>
              <span className="text-2xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Mobile
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                Android App
              </h2>
              <p className="text-xs text-secondary mt-1">
                Installable standalone APK with edge-to-edge safe area display and touch optimizations.
              </p>
            </div>

            {/* Spec metadata */}
            <div className="p-3.5 rounded-xl bg-surface/70 border space-y-2 text-xs" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><Cpu size={13} className="text-muted-cv" /> Architecture:</span>
                <span className="font-mono font-medium text-primary">ARM64 &amp; x86_64 (Universal)</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><HardDrive size={13} className="text-muted-cv" /> File Size:</span>
                <span className="font-mono font-medium text-primary">
                  {loading
                    ? '...'
                    : release?.downloads.android?.sizeFormatted || 'Build pending (~12-25 MB)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-muted-cv" /> Version:</span>
                <span className="font-mono font-medium text-primary">
                  {loading ? '...' : release?.version || '1.0.0'}
                </span>
              </div>
            </div>

            {/* Unknown Sources Notice Box */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-amber-300">
              <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                <AlertTriangle size={13} className="shrink-0" />
                <span>Installation Note</span>
              </div>
              <p className="text-2xs leading-relaxed text-amber-200/90">
                Android may prompt: <em>&ldquo;File might be harmful&rdquo;</em> or ask to allow installs from
                unknown sources. This is standard for direct APK downloads outside Google Play.
              </p>
            </div>

            {/* Highlights */}
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Edge-to-edge safe area navigation layout</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Offline converter tools ready on your phone</span>
              </li>
            </ul>
          </div>

          {/* Download CTA */}
          <div className="pt-6 mt-6 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            {release?.downloads.android ? (
              <a
                href={release.downloads.android.downloadUrl}
                download
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30"
              >
                <Download size={16} />
                <span>Download APK</span>
              </a>
            ) : (
              <a
                href="https://github.com/sridharvpr7/convert/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
              >
                <ExternalLink size={15} />
                <span>View Releases on GitHub</span>
              </a>
            )}
            <p className="text-3xs text-center text-muted-cv">
              Requires Android 7.0 (Nougat) or higher
            </p>
          </div>
        </div>

        {/* 3. WEB APPLICATION CARD */}
        <div className="glass-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between border transition-all duration-300 hover:shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                <Globe size={26} />
              </div>
              <span className="text-2xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30">
                Cloud Web
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                Web Application
              </h2>
              <p className="text-xs text-secondary mt-1">
                Zero installation needed. Runs instantly inside any modern web browser on all operating systems.
              </p>
            </div>

            {/* Spec metadata */}
            <div className="p-3.5 rounded-xl bg-surface/70 border space-y-2 text-xs" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><Globe size={13} className="text-muted-cv" /> Platform:</span>
                <span className="font-mono font-medium text-primary">Web Standards (Wasm / JS)</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><HardDrive size={13} className="text-muted-cv" /> Disk Space:</span>
                <span className="font-mono font-medium text-primary">0 MB (Cloud-Hosted)</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-muted-cv" /> Updates:</span>
                <span className="font-mono font-medium text-primary">Continuous Deployment</span>
              </div>
            </div>

            {/* Highlights */}
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Works on macOS, Linux, Windows, ChromeOS &amp; iOS</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>No admin permissions or local installation required</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                <span>Full access to 42 client-side conversion utilities</span>
              </li>
            </ul>
          </div>

          {/* Web CTA */}
          <div className="pt-6 mt-6 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <a
              href="https://convetpulse.onrender.com"
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all bg-purple-600 hover:bg-purple-500 border-purple-500/30"
            >
              <Globe size={16} />
              <span>Open Web App</span>
              <ArrowRight size={14} />
            </a>
            <p className="text-3xs text-center text-muted-cv">
              Production host: convetpulse.onrender.com
            </p>
          </div>
        </div>
      </div>

      {/* ── Expandable Installation Guides ────────────────────────── */}
      <div className="space-y-4 max-w-4xl mx-auto pt-6">
        <div className="text-center space-y-1 mb-6">
          <h2 className="text-2xl font-bold text-primary">Installation &amp; Setup Instructions</h2>
          <p className="text-xs text-muted-cv">Step-by-step guides for installing CONVET PULSE on your devices</p>
        </div>

        {/* Windows Accordion */}
        <div className="border rounded-xl bg-surface/50 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => toggleSection('windows')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-hover-cv transition-colors"
          >
            <div className="flex items-center gap-3">
              <Monitor size={18} className="text-blue-400" />
              <span className="font-semibold text-sm text-primary">Windows Desktop Installation Guide</span>
            </div>
            {expandedSection === 'windows' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSection === 'windows' && (
            <div className="px-5 pb-5 pt-2 text-xs text-secondary space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
                <li>
                  <strong>Download the Installer:</strong> Click the &ldquo;Download for Windows&rdquo; button above to get the latest <code>.exe</code> installer.
                </li>
                <li>
                  <strong>Run Setup:</strong> Double-click the downloaded setup file (e.g., <code>CONVET PULSE_1.0.0_x64-setup.exe</code>).
                </li>
                <li>
                  <strong>Windows SmartScreen:</strong> If Windows Defender SmartScreen shows <em>&ldquo;Windows protected your PC&rdquo;</em>, click <strong>More info</strong> and then click <strong>Run anyway</strong>. (This occurs on software without an expensive commercial EV certificate).
                </li>
                <li>
                  <strong>Follow Prompts:</strong> Follow the on-screen installer to choose an install directory and desktop shortcut.
                </li>
                <li>
                  <strong>Automatic Updates:</strong> When installed, CONVET PULSE will automatically check for cryptographically signed updates on launch.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Android Accordion */}
        <div className="border rounded-xl bg-surface/50 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => toggleSection('android')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-hover-cv transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone size={18} className="text-emerald-400" />
              <span className="font-semibold text-sm text-primary">Android APK Sideloading Guide</span>
            </div>
            {expandedSection === 'android' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSection === 'android' && (
            <div className="px-5 pb-5 pt-2 text-xs text-secondary space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
                <li>
                  <strong>Download the APK:</strong> Tap the &ldquo;Download APK&rdquo; button on your Android device.
                </li>
                <li>
                  <strong>Browser Download Warning:</strong> Chrome or your browser may say <em>&ldquo;File might be harmful. Do you want to download CONVET PULSE.apk anyway?&rdquo;</em> Tap <strong>Download anyway</strong>.
                </li>
                <li>
                  <strong>Enable Unknown Sources:</strong> When opening the file, if prompted:
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-cv">
                    <li>Tap <strong>Settings</strong> on the prompt</li>
                    <li>Toggle <strong>Allow from this source</strong> (or &ldquo;Install unknown apps&rdquo;)</li>
                    <li>Return to the installer</li>
                  </ul>
                </li>
                <li>
                  <strong>Tap Install:</strong> Confirm the installation. Once complete, tap <strong>Open</strong> to launch CONVET PULSE.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Web App Accordion */}
        <div className="border rounded-xl bg-surface/50 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => toggleSection('web')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-hover-cv transition-colors"
          >
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-purple-400" />
              <span className="font-semibold text-sm text-primary">Web App &amp; PWA Usage Guide</span>
            </div>
            {expandedSection === 'web' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSection === 'web' && (
            <div className="px-5 pb-5 pt-2 text-xs text-secondary space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="leading-relaxed">
                The web application is hosted at <a href="https://convetpulse.onrender.com" className="text-accent underline">convetpulse.onrender.com</a>.
                All 42 client-side tools run in the browser using WebAssembly and Web Workers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-surface border" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-semibold text-primary block text-2xs uppercase">Install as PWA (Chrome / Edge)</span>
                  <p className="text-muted-cv text-2xs mt-1">
                    Click the install icon in your browser address bar or menu (&ldquo;Install CONVET PULSE&rdquo;) for an app-like standalone window.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-surface border" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-semibold text-primary block text-2xs uppercase">Add to Home Screen (iOS Safari)</span>
                  <p className="text-muted-cv text-2xs mt-1">
                    Tap the Share button in Safari, scroll down, and tap &ldquo;Add to Home Screen&rdquo;.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Release Notes Section (if available) ────────────────── */}
      {release && release.releaseNotes && (
        <div className="max-w-4xl mx-auto p-6 rounded-2xl glass-card border space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <FileCode size={16} className="text-accent" />
              <span>Release Notes — {release.tag}</span>
            </h3>
            <span className="text-xs text-muted-cv">{release.publishedDateFormatted}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface/70 border text-xs text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
            {release.releaseNotes}
          </div>
        </div>
      )}

      {/* ── Security & Integrity Disclosure ─────────────────────── */}
      <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-surface/30 border text-xs text-muted-cv space-y-2 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-center gap-2 text-primary font-semibold">
          <ShieldCheck size={16} className="text-success-500" />
          <span>Security &amp; Integrity Guarantee</span>
        </div>
        <p className="max-w-2xl mx-auto">
          Official CONVET PULSE installers are distributed exclusively through our official GitHub repository
          (<code>github.com/sridharvpr7/convert</code>) and official web platform. We never bundle third-party adware,
          toolbars, or background telemetry.
        </p>
      </div>
    </div>
  );
};
