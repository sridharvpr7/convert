import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================
// CONVETER — Global App Store (Zustand)
// ============================================================

export type Theme = 'light' | 'dark' | 'system';

interface AppState {
  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;

  // Search
  searchOpen: boolean;
  searchQuery: string;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;

  // Navigation
  megaMenuOpen: boolean;
  megaMenuCategory: string | null;
  setMegaMenuOpen: (open: boolean, category?: string | null) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Notifications
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => void;
  markNotificationsAsRead: () => void;
  clearNotifications: () => void;

  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // Favorites
  favoriteTools: string[]; // tool slugs
  toggleFavoriteTool: (slug: string) => void;
  isFavoriteTool: (slug: string) => boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  type: 'success' | 'info' | 'error' | 'promo';
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'free' | 'premium';
}

// Resolve theme based on system preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: Theme): 'light' | 'dark' => {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  return resolved;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: (theme) => {
        const resolved = applyTheme(theme);
        set({ theme, resolvedTheme: resolved });
      },

      // Search
      searchOpen: false,
      searchQuery: '',
      setSearchOpen: (open) => set({ searchOpen: open, searchQuery: open ? get().searchQuery : '' }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Navigation
      megaMenuOpen: false,
      megaMenuCategory: null,
      setMegaMenuOpen: (open, category = null) =>
        set({ megaMenuOpen: open, megaMenuCategory: open ? category : null }),

      // Sidebar
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Notifications
      notificationsOpen: false,
      setNotificationsOpen: (open) => set({ notificationsOpen: open }),
      notifications: [],
      addNotification: (n) => {
        const entry: AppNotification = {
          id: Math.random().toString(36).slice(2),
          time: 'Just now',
          read: false,
          ...n,
        };
        set((state) => ({ notifications: [entry, ...state.notifications].slice(0, 50) }));
      },
      markNotificationsAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      clearNotifications: () => set({ notifications: [] }),

      // User
      user: null,
      setUser: (user) => set({ user }),

      // Favorites
      favoriteTools: [],
      toggleFavoriteTool: (slug) => {
        const { favoriteTools } = get();
        const exists = favoriteTools.includes(slug);
        set({
          favoriteTools: exists
            ? favoriteTools.filter((s) => s !== slug)
            : [...favoriteTools, slug],
        });
      },
      isFavoriteTool: (slug) => get().favoriteTools.includes(slug),
    }),
    {
      name: 'conveter-app',
      partialize: (state) => ({
        theme: state.theme,
        favoriteTools: state.favoriteTools,
        user: state.user,
        notifications: state.notifications,
      }),
    }
  )
);

// Initialize theme on load
if (typeof window !== 'undefined') {
  const stored = useAppStore.getState();
  applyTheme(stored.theme);

  // Watch system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme, setTheme } = useAppStore.getState();
    if (theme === 'system') {
      setTheme('system');
    }
  });
}
