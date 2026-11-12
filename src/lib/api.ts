// ============================================================
// CONVETER — Client API Service
// Connects UI with backend endpoints: jobs, telegram, admin, telemetry, premium.
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

export interface ApiNotificationLog {
  id: string;
  event_type: string;
  status: 'sent' | 'failed' | 'mocked' | 'retried';
  chat_id?: string;
  message_id?: number;
  error_message?: string;
  retry_count: number;
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
  totalProcessingDurationMs: number;
  avgProcessingTimeMs: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
  toolUsage: { tool_slug: string; tool_name: string; count: number; completed?: number; failed?: number }[];
  fileTypeDistribution: { format: string; count: number; percentage: number }[];
  recentActivity: Array<{
    id: string;
    toolName: string;
    toolSlug: string;
    inputFileName: string;
    outputFileName?: string;
    inputFormat?: string;
    outputFormat?: string;
    status: string;
    durationMs: number;
    inputFileSize: number;
    outputFileSize: number;
    createdAt: string;
    completedAt?: string;
  }>;
  timeRange?: string;
}

export interface NotificationSettings {
  notify_new_user: boolean;
  notify_conversion_started: boolean;
  notify_conversion_completed: boolean;
  notify_conversion_failed: boolean;
  notify_daily_summary: boolean;
  notify_system_errors: boolean;
  notify_premium_access: boolean;
  notify_admin_changes: boolean;
}

export interface PublicPremiumConfig {
  enabled: boolean;
  showPremiumButton: boolean;
  price: {
    amount: number;
    currency: string;
    billingPeriod: string;
    label: string;
  };
  features: Record<string, boolean>;
  allowedTools: string[];
  maintenanceMode: boolean;
}

export interface FullPremiumConfig {
  premium: {
    enabled: boolean;
    showPremiumButton: boolean;
    price: {
      amount: number;
      currency: string;
      billingPeriod: string;
      label: string;
    };
    features: Record<string, boolean>;
    allowedTools: string[];
    maintenanceMode: boolean;
  };
}

export interface TelegramDiagnostics {
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  hasSecret: boolean;
  apiReachable: boolean;
  botInfo?: {
    id: number;
    name: string;
    username: string;
  } | null;
  lastError?: string | null;
}

const API_BASE = '';

async function safeFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include', // Pass cookies for session authentication
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      if (errBody && errBody.error) {
        throw new Error(errBody.error);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.message !== 'Failed to fetch') {
      throw err;
    }
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
      premium?: { enabled: boolean; maintenanceMode: boolean };
    }>('/api/health');
  },

  /**
   * Public Premium Config
   */
  async getPublicPremiumConfig(): Promise<PublicPremiumConfig | null> {
    const res = await safeFetch<{ config: PublicPremiumConfig }>('/api/premium/config');
    return res ? res.config : null;
  },

  /**
   * Check access authorization for a tool
   */
  async verifyToolAccess(params: {
    toolSlug: string;
    isPremiumUser?: boolean;
    userId?: string;
    userName?: string;
  }): Promise<{ authorized: boolean; restricted?: boolean; error?: string; maintenance?: boolean }> {
    const res = await safeFetch<{ authorized: boolean; restricted?: boolean; error?: string; maintenance?: boolean }>(
      '/api/premium/verify-access',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return res || { authorized: true };
  },

  /**
   * Admin Authentication
   */
  async adminLogin(username: string, password: string): Promise<{ ok: boolean; mustChangePassword?: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Authentication failed' };
      }
      return { ok: true, mustChangePassword: data.mustChangePassword };
    } catch {
      return { ok: false, error: 'Could not connect to authentication server' };
    }
  },

  async adminLogout(): Promise<boolean> {
    try {
      const res = await safeFetch<{ ok: boolean }>('/api/admin/logout', { method: 'POST' });
      return Boolean(res?.ok);
    } catch {
      return false;
    }
  },

  async adminCheckSession(): Promise<{ authenticated: boolean; mustChangePassword?: boolean }> {
    const res = await safeFetch<{ authenticated: boolean; mustChangePassword?: boolean }>('/api/admin/session');
    return res || { authenticated: false };
  },

  async adminChangePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/admin/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to change password' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while changing password' };
    }
  },

  /**
   * Admin Premium Configuration
   */
  async getAdminPremiumConfig(): Promise<FullPremiumConfig | null> {
    const res = await safeFetch<{ config: FullPremiumConfig }>('/api/admin/premium-config');
    return res ? res.config : null;
  },

  async updateAdminPremiumConfig(config: Partial<FullPremiumConfig>): Promise<{ ok: boolean; config?: FullPremiumConfig; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/admin/premium-config`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to save configuration' };
      }
      return { ok: true, config: data.config };
    } catch {
      return { ok: false, error: 'Network error saving configuration' };
    }
  },

  async updatePremiumTools(allowedTools: string[]): Promise<{ ok: boolean; allowedTools?: string[]; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/admin/premium-tools`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedTools }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to update premium tools' };
      }
      return { ok: true, allowedTools: data.allowedTools };
    } catch {
      return { ok: false, error: 'Network error updating tools' };
    }
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
    isPremiumUser?: boolean;
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
  async getAdminStats(range: string = 'all'): Promise<ApiStats | null> {
    const res = await safeFetch<{ stats: ApiStats }>(`/api/admin/detailed-stats?range=${encodeURIComponent(range)}`);
    return res ? res.stats : null;
  },

  /**
   * Admin jobs table query
   */
  async getAdminJobs(params: { status?: string; tool?: string; search?: string; limit?: number; offset?: number; range?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.tool) query.set('tool', params.tool);
    if (params.search) query.set('search', params.search);
    if (params.range) query.set('range', params.range);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const res = await safeFetch<{ jobs: ApiJob[]; count: number }>(`/api/jobs?${query.toString()}`);
    return res ? res.jobs : [];
  },

  /**
   * Admin audit logs
   */
  async getAdminAuditLogs(limit: number = 50): Promise<ApiAuditLog[]> {
    const res = await safeFetch<{ logs: ApiAuditLog[] }>(`/api/admin/audit?limit=${limit}`);
    return res ? res.logs : [];
  },

  /**
   * Notification logs
   */
  async getNotificationLogs(limit: number = 50): Promise<ApiNotificationLog[]> {
    const res = await safeFetch<{ logs: ApiNotificationLog[] }>(`/api/admin/notification-log?limit=${limit}`);
    return res ? res.logs : [];
  },

  /**
   * Telegram Diagnostics
   */
  async getTelegramDiagnostics(): Promise<TelegramDiagnostics | null> {
    const res = await safeFetch<{ diagnostics: TelegramDiagnostics }>('/api/admin/telegram-diagnostics');
    return res ? res.diagnostics : null;
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
