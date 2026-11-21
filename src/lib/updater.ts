// ============================================================
// CONVET PULSE — Tauri 2 Desktop Auto Updater Service
// Handles update checking, signing verification, and in-app
// installation for Windows Desktop.
// Guarded: Never runs on Web or Android.
// ============================================================

import { isDesktop } from './platform';

export interface AppUpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawUpdate: any;
}

export type UpdateCheckResult =
  | { status: 'update-available'; update: AppUpdateInfo }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

/**
 * Checks for updates using Tauri 2 official updater plugin.
 * Strictly gated to Desktop (Windows / macOS / Linux).
 * Never runs on Web or Android.
 */
export async function checkForUpdate(options: { silent?: boolean } = {}): Promise<UpdateCheckResult> {
  if (!isDesktop()) {
    return { status: 'unsupported' };
  }

  try {
    // Dynamic import ensures web and Android bundles never execute or require desktop updater
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
          rawUpdate: update,
        },
      };
    }

    return {
      status: 'up-to-date',
      currentVersion: update?.currentVersion || '1.0.0',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // If public key is not yet configured or updater endpoint is offline,
    // handle gracefully without breaking or crashing the application
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

/**
 * Downloads and installs the given update.
 * Reports continuous download progress and automatically relaunches the app upon completion.
 */
export async function downloadAndInstallUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawUpdate: any,
  onProgress?: (percent: number, message: string) => void
): Promise<{ success: boolean; error?: string }> {
  if (!isDesktop() || !rawUpdate) {
    return { success: false, error: 'Updater is only supported on Desktop' };
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
          onProgress?.(2, 'Starting download...');
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

    onProgress?.(100, 'Installation complete. Restarting application...');

    // Automatically relaunch application using the process plugin
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      // If automatic relaunch is prevented, ask the user to restart
      console.info('[Tauri Updater] Relaunch triggered. Please restart the app if it does not restart automatically.');
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Tauri Updater] Installation failed:', errorMsg);
    return { success: false, error: readableUpdateError(errorMsg) };
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
