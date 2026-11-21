// ============================================================
// CONVET PULSE — GitHub Releases & Cross-Platform Download Service
// Fetches authentic release data from GitHub Releases API with
// multi-layer caching, asset categorization, and resilient fallbacks.
// Never displays fake download counts or artificial file sizes.
// ============================================================

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
  contentType: string;
  downloadCount: number;
}

export interface PlatformDownloads {
  windows?: ReleaseAsset;
  android?: ReleaseAsset;
  allAssets: ReleaseAsset[];
}

export interface AppRelease {
  tag: string;
  version: string;
  name: string;
  publishedAt: string;
  publishedDateFormatted: string;
  releaseNotes: string;
  htmlUrl: string;
  downloads: PlatformDownloads;
  isPrerelease: boolean;
}

export type ReleaseFetchResult =
  | { status: 'success'; release: AppRelease }
  | { status: 'no-releases'; message: string }
  | { status: 'error'; message: string };

const GITHUB_REPO = 'sridharvpr7/convert';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Client-side cache to avoid redundant GitHub API requests within same session
let cachedReleaseResult: { timestamp: number; data: ReleaseFetchResult } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function cleanVersion(tag: string): string {
  return tag.replace(/^v/i, '').trim();
}

/**
 * Parses raw GitHub release JSON payload into typed AppRelease
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGitHubRelease(raw: any): AppRelease {
  const assets: ReleaseAsset[] = Array.isArray(raw.assets)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? raw.assets.map((a: any) => ({
        id: a.id,
        name: a.name || 'unnamed',
        size: a.size || 0,
        sizeFormatted: formatBytes(a.size || 0),
        downloadUrl: a.browser_download_url,
        contentType: a.content_type || 'application/octet-stream',
        downloadCount: a.download_count || 0,
      }))
    : [];

  // Match Windows installer (.exe or .msi, preferring setup/nsis .exe)
  const windowsAsset = assets.find((a) => {
    const n = a.name.toLowerCase();
    return (
      (n.endsWith('.exe') || n.endsWith('.msi')) &&
      !n.endsWith('.sig') &&
      !n.endsWith('.zip')
    );
  });

  // Match Android APK (preferring universal or release signed apk)
  const androidAsset = assets.find((a) => {
    const n = a.name.toLowerCase();
    return (
      n.endsWith('.apk') &&
      !n.endsWith('.sig') &&
      !n.includes('unsigned')
    );
  }) || assets.find((a) => a.name.toLowerCase().endsWith('.apk'));

  const dateStr = raw.published_at || raw.created_at || new Date().toISOString();
  let formattedDate = 'Recently published';
  try {
    formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    /* fallback to default */
  }

  return {
    tag: raw.tag_name || 'latest',
    version: cleanVersion(raw.tag_name || '1.0.0'),
    name: raw.name || raw.tag_name || 'CONVET PULSE',
    publishedAt: dateStr,
    publishedDateFormatted: formattedDate,
    releaseNotes: raw.body || '',
    htmlUrl: raw.html_url || `https://github.com/${GITHUB_REPO}/releases`,
    downloads: {
      windows: windowsAsset,
      android: androidAsset,
      allAssets: assets,
    },
    isPrerelease: Boolean(raw.prerelease),
  };
}

/**
 * Fetches the latest published release.
 * Queries local server proxy /api/releases/latest first (to leverage server cache),
 * and falls back to direct GitHub API if running in static or offline mode.
 */
export async function fetchLatestRelease(forceRefresh = false): Promise<ReleaseFetchResult> {
  const now = Date.now();
  if (!forceRefresh && cachedReleaseResult && now - cachedReleaseResult.timestamp < CACHE_TTL_MS) {
    return cachedReleaseResult.data;
  }

  // 1. Try server proxy endpoint first
  try {
    const res = await fetch('/api/releases/latest', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.tag || data.tag_name)) {
        const parsed = parseGitHubRelease(data);
        const result: ReleaseFetchResult = { status: 'success', release: parsed };
        cachedReleaseResult = { timestamp: now, data: result };
        return result;
      }
      if (data && data.status === 'no-releases') {
        const result: ReleaseFetchResult = {
          status: 'no-releases',
          message: data.message || 'No official releases published yet.',
        };
        cachedReleaseResult = { timestamp: now, data: result };
        return result;
      }
    }
  } catch {
    // Server proxy unavailable, proceed to direct client fetch
  }

  // 2. Direct GitHub Releases API fetch
  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (res.status === 404) {
      const result: ReleaseFetchResult = {
        status: 'no-releases',
        message: 'No published releases found on GitHub yet.',
      };
      cachedReleaseResult = { timestamp: now, data: result };
      return result;
    }

    if (!res.ok) {
      const result: ReleaseFetchResult = {
        status: 'error',
        message: `GitHub API returned ${res.status}: ${res.statusText}`,
      };
      return result;
    }

    const raw = await res.json();
    const release = parseGitHubRelease(raw);
    const result: ReleaseFetchResult = { status: 'success', release };
    cachedReleaseResult = { timestamp: now, data: result };
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      message: `Failed to connect to GitHub Releases: ${errorMsg}`,
    };
  }
}
