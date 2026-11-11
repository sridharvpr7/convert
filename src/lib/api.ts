// ============================================================
// CONVETER — Client API Service
// Connects UI with backend endpoints: jobs, telegram, admin, telemetry.
// Resilient: gracefully handles offline / static-only environments.
// ============================================================

export interface ApiJob {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  toolSlug: string;
  toolName: string;
  inputFileName: string;
  inputFileSize: number;
  inputFormat?: string;
  outputFileName?: string;
  outputFileSize?: number;
  outputFormat?: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  durationMs?: number;
  errorSummary?: string;
  errorCategory?: string;
  downloadToken?: string;
  downloadCount?: number;
  createdAt: string;
  completedAt?: string;
}

export interface ApiAdminComment {
  id: string;
  job_id: string;
  author: string;
  comment: string;
  telegram_message_id?: number;
  created_at: string;
}

export interface ApiAuditLog {
  id: string;
  event_type: string;
  actor: string;
  details: string;
  created_at: string;
}

export interface ApiStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  totalUsers: number;
  totalBytesSaved: number;
  successRate: number;
  toolUsage: { tool_slug: string; tool_name: string; count: number }[];
}

export interface NotificationSettings {
  notify_new_user: boolean;
  notify_conversion_started: boolean;
  notify_conversion_completed: boolean;
  notify_conversion_failed: boolean;
  notify_daily_summary: boolean;
}

const API_BASE = '';

async function safeFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Backend offline / network failed
    return null;
  }
}

export const apiClient = {
  /**
   * Healthcheck
   */
  async getHealth() {
    return safeFetch<{
      status: string;
      version: string;
      uptime: number;
      database: string;
      telegram: { configured: boolean; hasToken: boolean; hasChatId: boolean };
    }>('/api/health');
  },

  /**
   * Notify conversion started & record job
   */
  async startJob(params: {
    id?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    toolSlug: string;
    toolName: string;
    inputFileName: string;
    inputFileSize: number;
    inputFormat?: string;
  }): Promise<ApiJob | null> {
    const res = await safeFetch<{ job: ApiJob }>('/api/jobs/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res ? res.job : null;
  },

  /**
   * Notify conversion completed & update job
   */
  async completeJob(params: {
    id: string;
    outputFileName: string;
    outputFileSize: number;
    outputFormat: string;
    durationMs: number;
  }): Promise<ApiJob | null> {
    const res = await safeFetch<{ job: ApiJob }>('/api/jobs/complete', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res ? res.job : null;
  },

  /**
   * Notify conversion failed & update job
   */
  async failJob(params: {
    id: string;
    durationMs: number;
    errorSummary: string;
    errorCategory?: string;
  }): Promise<ApiJob | null> {
    const res = await safeFetch<{ job: ApiJob }>('/api/jobs/fail', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res ? res.job : null;
  },

  /**
   * Fetch single job with comments
   */
  async getJob(id: string): Promise<{ job: ApiJob; comments: ApiAdminComment[] } | null> {
    return safeFetch<{ job: ApiJob; comments: ApiAdminComment[] }>(`/api/jobs/${id}`);
  },

  /**
   * Add comment to job
   */
  async addComment(jobId: string, comment: string, author?: string): Promise<ApiAdminComment | null> {
    const res = await safeFetch<{ comment: ApiAdminComment }>(`/api/jobs/${jobId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment, author }),
    });
    return res ? res.comment : null;
  },

  /**
   * Track download of converted output
   */
  async trackDownload(jobId: string): Promise<{ ok: boolean; downloadToken: string } | null> {
    return safeFetch<{ ok: boolean; downloadToken: string }>(`/api/jobs/${jobId}/download`);
  },

  /**
   * Register user / record activity
   */
  async registerUser(user: { id?: string; name?: string; email?: string; deviceInfo?: string }) {
    return safeFetch<{ user: { id: string; name: string }; isNew: boolean }>('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  /**
   * Admin analytics & KPIs
   */
  async getAdminStats(): Promise<ApiStats | null> {
    const res = await safeFetch<{ stats: ApiStats }>('/api/admin/stats');
    return res ? res.stats : null;
  },

  /**
   * Admin jobs table query
   */
  async getAdminJobs(params: { status?: string; tool?: string; search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.tool) query.set('tool', params.tool);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const res = await safeFetch<{ jobs: ApiJob[]; count: number }>(`/api/jobs?${query.toString()}`);
    return res ? res.jobs : [];
  },

  /**
   * Admin audit logs
   */
  async getAdminAuditLogs(): Promise<ApiAuditLog[]> {
    const res = await safeFetch<{ logs: ApiAuditLog[] }>('/api/admin/audit');
    return res ? res.logs : [];
  },

  /**
   * Notification settings
   */
  async getTelegramSettings(): Promise<NotificationSettings | null> {
    const res = await safeFetch<{ settings: NotificationSettings }>('/api/admin/telegram-settings');
    return res ? res.settings : null;
  },

  async updateTelegramSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings | null> {
    const res = await safeFetch<{ settings: NotificationSettings }>('/api/admin/telegram-settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    return res ? res.settings : null;
  },

  /**
   * Send test Telegram alert
   */
  async testTelegramAlert(): Promise<{ ok: boolean } | null> {
    const res = await safeFetch<{ result: { ok: boolean } }>('/api/admin/telegram-test', {
      method: 'POST',
    });
    return res ? res.result : null;
  },
};

