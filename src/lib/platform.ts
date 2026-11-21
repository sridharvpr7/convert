// ============================================================
// CONVET PULSE — Cross-Platform Bridge & Platform Detection
// Provides safe, zero-crash runtime detection and platform-specific
// utilities across Web, Windows Desktop (Tauri 2), and Android (Tauri 2).
// ============================================================

/**
 * Returns true if the application is running inside a Tauri runtime.
 * Failsafe: never throws in standard web browsers or during SSR/static builds.
 */
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/**
 * Detects if running on Android (via Tauri or mobile browser).
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detects if running on Windows desktop.
 */
export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Detects if running on Desktop (Windows / macOS / Linux via Tauri).
 * Excludes Android and Web browser environments.
 */
export function isDesktop(): boolean {
  return isTauri() && !isAndroid();
}

/**
 * Detects if running in a standard web browser (not packaged as Tauri app).
 */
export function isWeb(): boolean {
  return !isTauri();
}

/**
 * Centralized API Base URL resolver:
 * - On Web: returns '' (relative to current origin, preserving existing Render web deployment)
 * - In Tauri (Windows / Android): returns the production backend URL (https://convetpulse.onrender.com)
 *   or an environment override if configured.
 */
export function getApiBaseUrl(): string {
  // If an explicit override is provided in environment, respect it
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // If running inside Tauri (Windows .exe or Android .apk), route to production backend
  if (isTauri()) {
    const prodUrl =
      (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PRODUCTION_API_URL ||
      'https://convetpulse.onrender.com';
    return prodUrl.replace(/\/$/, '');
  }

  // Standard web browser deployment: relative paths work with same-origin
  return '';
}

/**
 * Cross-platform File Download / Save:
 * - In Tauri Desktop/Mobile: Uses native save dialog and filesystem plugin to write bytes directly.
 * - In Standard Web Browser: Uses standard HTML5 blob download anchor (URL.createObjectURL).
 */
export async function nativeSaveFile(
  blob: Blob,
  defaultFilename: string,
  _mimeType?: string
): Promise<{ success: boolean; path?: string }> {
  if (isTauri()) {
    try {
      // Dynamic imports ensure web bundle never requires Tauri plugins to be present
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const selectedPath = await save({
        defaultPath: defaultFilename,
        filters: [
          {
            name: 'Files',
            extensions: defaultFilename.includes('.')
              ? [defaultFilename.split('.').pop() || '*']
              : ['*'],
          },
        ],
      });

      if (!selectedPath) {
        // User cancelled native dialog
        return { success: false };
      }

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      await writeFile(selectedPath, bytes);

      // Trigger native notification if available
      sendNativeNotification('Download Complete', `Saved to ${selectedPath}`).catch(() => {});

      return { success: true, path: selectedPath };
    } catch (err) {
      console.warn('[Platform] Native save failed, falling back to browser download:', err);
    }
  }

  // Browser Fallback (Standard Web)
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return { success: true };
  } catch (err) {
    console.error('[Platform] Browser download failed:', err);
    return { success: false };
  }
}

/**
 * Opens an external URL in the system's default browser rather than inside the application webview.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch {
      // Fall through to window.open
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Sends a native system notification where supported.
 */
export async function sendNativeNotification(title: string, body?: string): Promise<void> {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import(
        '@tauri-apps/plugin-notification'
      );
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      if (permissionGranted) {
        sendNotification({ title, body: body || '' });
      }
    } catch {
      // safe ignore in environments where notification plugin is unavailable
    }
  }
}
