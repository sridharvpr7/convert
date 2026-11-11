export interface HistoryItem {
  id: string;
  fileName: string;
  toolName: string;
  toolSlug: string;
  category: string;
  date: string;
  size: string;
  resultSize?: string;
  status: 'completed' | 'failed' | 'processing';
  processingType: 'local' | 'cloud';
}

export const HISTORY_KEY = 'conveter_history';
export const MAX_HISTORY = 200;

/** Append a completed job to localStorage history */
export function recordHistory(item: Omit<HistoryItem, 'id' | 'date'>): void {
  try {
    const existing: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    const entry: HistoryItem = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleString(),
      ...item,
    };
    existing.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage may be unavailable in private mode
  }
}

export function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

