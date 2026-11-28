// ============================================================
// CONVET PULSE — Tauri 2 Auto Updater Service (Windows & Android)
// Handles update checking, signing verification, and in-app
// installation for Windows Desktop, plus official release check
// and APK download guidance for Android.
// Strictly gated: Never runs on Web browsers.
// ============================================================

import { isTauri, isDesktop, isAndroid } from './platform';

export interface AppUpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
  platform: 'windows' | 'android' | 'desktop';
  downloadUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawUpdate?: any;
}

export type UpdateCheckResult =
  | { status: 'update-available'; update: AppUpdateInfo }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

/**
 * Compares two semantic version strings (e.g., '1.0.2' vs '1.0.1').
 * Returns true if candidate is strictly newer than current.
 */
function isNewerVersion(candidate: string, current: string): boolean {
  const p1 = candidate.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = current.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const v1 = p1[i] ?? 0;
    const v2 = p2[i] ?? 0;
    if (v1 > v2) return true;
    if (v1 < v2) return false;
  }
  return false;
}

/**
 * Checks for updates using official Tauri updater plugin on Desktop (Windows),
 * or checks GitHub release metadata on Android.
 * Strictly gated: returns unsupported in standard web browsers.
 */
export async function checkForUpdate(options: { silent?: boolean } = {}): Promise<UpdateCheckResult> {
  // Web browser guard: strictly unsupported outside of installed Tauri applications
  if (!isTauri()) {
    return { status: 'unsupported' };
  }

  // ── Android Mobile App Update Check ───────────────────────
  if (isAndroid()) {
    try {
      const currentVersion = '1.0.2';
      let latestVersion = '';
      let releaseBody = '';
      const releaseUrl = 'https://github.com/sridharvpr7/convert/releases/latest';

      // 1. Check tauri updater endpoint metadata
      try {
        const res = await fetch(
          'https://github.com/sridharvpr7/convert/releases/latest/download/latest.json',
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          latestVersion = (data.version || '').replace(/^v/i, '');
          releaseBody = data.notes || '';
        }
      } catch {
        // Fallback to GitHub API if latest.json is unreachable
      }

      // 2. Fallback to GitHub Releases API
      if (!latestVersion) {
        try {
          const apiRes = await fetch(
            'https://api.github.com/repos/sridharvpr7/convert/releases/latest',
            { headers: { Accept: 'application/vnd.github.v3+json' }, cache: 'no-store' }
          );
          if (apiRes.ok) {
            const release = await apiRes.json();
            latestVersion = (release.tag_name || '').replace(/^v/i, '');
            releaseBody = release.body || '';
          }
        } catch {
          // Handled below
        }
      }

      if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
        return {
          status: 'update-available',
          update: {
            version: latestVersion,
            currentVersion,
            platform: 'android',
            downloadUrl: releaseUrl,
            body: releaseBody || 'A new signed Android APK release is available on GitHub Releases.',
          },
        };
      }

      return {
        status: 'up-to-date',
        currentVersion,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!options.silent) console.warn('[Android Updater] Check failed:', msg);
      return { status: 'error', message: readableUpdateError(msg) };
    }
  }

  // ── Windows Desktop App Update Check (Tauri v2) ───────────
  if (isDesktop()) {
    try {
      // Dynamic import ensures web/mobile bundles never require desktop updater
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update && update.available) {
        return {
          status: 'update-available',
          update: {
            version: update.version,
            currentVersion: update.currentVersion,
            date: update.date,
            body: update.body,
            platform: 'windows',
            rawUpdate: update,
          },
        };
      }

      return {
        status: 'up-to-date',
        currentVersion: update?.currentVersion || '1.0.2',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (options.silent) {
        console.info('[Tauri Updater] Silent update check completed:', errorMsg);
      } else {
        console.warn('[Tauri Updater] Update check failed:', errorMsg);
      }

      return {
        status: 'error',
        message: readableUpdateError(errorMsg),
      };
    }
  }

  return { status: 'unsupported' };
}

/**
 * Downloads and installs the given update on Desktop (Windows).
 * Reports continuous download progress.
 */
export async function downloadAndInstallUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawUpdate: any,
  onProgress?: (percent: number, message: string) => void
): Promise<{ success: boolean; error?: string }> {
  if (!isDesktop() || !rawUpdate) {
    return { success: false, error: 'In-app installation is only supported on Windows Desktop' };
  }

  try {
    let downloaded = 0;
    let contentLength: number | undefined = 0;

    onProgress?.(0, 'Preparing update download...');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rawUpdate.downloadAndInstall((event: any) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data?.contentLength;
          onProgress?.(2, 'Connecting to release server...');
          break;
        case 'Progress':
          downloaded += Number(event.data?.chunkLength || 0);
          if (contentLength && contentLength > 0) {
            const percent = Math.min(98, Math.round((downloaded / contentLength) * 100));
            onProgress?.(percent, `Downloading: ${percent}%`);
          } else {
            const mb = (downloaded / (1024 * 1024)).toFixed(1);
            onProgress?.(50, `Downloading (${mb} MB)...`);
          }
          break;
        case 'Finished':
          onProgress?.(100, 'Download complete. Installing update...');
          break;
      }
    });

    onProgress?.(100, 'Installation complete. Ready to restart.');
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Tauri Updater] Installation failed:', errorMsg);
    return { success: false, error: readableUpdateError(errorMsg) };
  }
}

/**
 * Restarts the application to apply the installed update.
 */
export async function relaunchApp(): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (err) {
    console.warn('[Tauri Updater] Relaunch triggered. Please restart the app manually if it does not restart automatically.', err);
  }
}

/**
 * Translates low-level updater / network errors into user-friendly diagnostic messages.
 */
function readableUpdateError(raw: string): string {
  if (raw.includes('pubkey') || raw.includes('YOUR_UPDATER_PUBLIC_KEY') || raw.includes('public key')) {
    return 'Updater signing key not configured yet. Configure your public key in tauri.conf.json.';
  }
  if (raw.includes('404') || raw.includes('Not Found') || raw.includes('release')) {
    return 'No published releases found on GitHub Releases yet.';
  }
  if (raw.includes('signature') || raw.includes('invalid signature') || raw.includes('verify')) {
    return 'Update verification failed: signature does not match configured public key.';
  }
  if (raw.includes('Failed to fetch') || raw.includes('network') || raw.includes('dns') || raw.includes('connection')) {
    return 'Unable to connect to GitHub Releases. Please check your internet connection.';
  }
  return raw;
}
