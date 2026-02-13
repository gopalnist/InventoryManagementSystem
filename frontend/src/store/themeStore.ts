import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Theme {
  id: string;
  name: string;
  sidebar: {
    bg: string;
    bgGradient: string;
    text: string;
    textMuted: string;
    activeItem: string;
    hoverBg: string;
    border: string;
    logoAccent: string;
  };
  accent: string;
  accentHover: string;
  accentLight: string;
}

export const themes: Theme[] = [
  {
    id: 'ocean',
    name: '🌊 Ocean Blue',
    sidebar: {
      bg: 'from-blue-900 via-blue-900 to-blue-800',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-blue-300',
      activeItem: 'bg-blue-600 shadow-lg shadow-blue-600/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-cyan-400 to-blue-500',
    },
    accent: 'bg-blue-600',
    accentHover: 'hover:bg-blue-700',
    accentLight: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'midnight',
    name: '🌙 Midnight',
    sidebar: {
      bg: 'from-slate-900 via-slate-900 to-slate-800',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-slate-400',
      activeItem: 'bg-indigo-600 shadow-lg shadow-indigo-600/30',
      hoverBg: 'hover:bg-white/5',
      border: 'border-white/10',
      logoAccent: 'from-indigo-400 to-purple-500',
    },
    accent: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-700',
    accentLight: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'forest',
    name: '🌲 Forest',
    sidebar: {
      bg: 'from-emerald-900 via-emerald-900 to-emerald-800',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-emerald-300',
      activeItem: 'bg-emerald-600 shadow-lg shadow-emerald-600/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-lime-400 to-emerald-500',
    },
    accent: 'bg-emerald-600',
    accentHover: 'hover:bg-emerald-700',
    accentLight: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'sunset',
    name: '🌅 Sunset',
    sidebar: {
      bg: 'from-orange-900 via-rose-900 to-purple-900',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-orange-200',
      activeItem: 'bg-orange-500 shadow-lg shadow-orange-500/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-yellow-400 to-orange-500',
    },
    accent: 'bg-orange-500',
    accentHover: 'hover:bg-orange-600',
    accentLight: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'lavender',
    name: '💜 Lavender',
    sidebar: {
      bg: 'from-purple-900 via-violet-900 to-purple-800',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-purple-300',
      activeItem: 'bg-violet-500 shadow-lg shadow-violet-500/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-pink-400 to-violet-500',
    },
    accent: 'bg-violet-600',
    accentHover: 'hover:bg-violet-700',
    accentLight: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'rose',
    name: '🌸 Rose',
    sidebar: {
      bg: 'from-rose-900 via-pink-900 to-rose-800',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-rose-300',
      activeItem: 'bg-rose-500 shadow-lg shadow-rose-500/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-rose-400 to-pink-500',
    },
    accent: 'bg-rose-600',
    accentHover: 'hover:bg-rose-700',
    accentLight: 'bg-rose-100 text-rose-700',
  },
  {
    id: 'teal',
    name: '🐬 Teal',
    sidebar: {
      bg: 'from-teal-900 via-teal-900 to-cyan-900',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-teal-300',
      activeItem: 'bg-teal-500 shadow-lg shadow-teal-500/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-cyan-400 to-teal-500',
    },
    accent: 'bg-teal-600',
    accentHover: 'hover:bg-teal-700',
    accentLight: 'bg-teal-100 text-teal-700',
  },
  {
    id: 'minimal',
    name: '⚪ Minimal Light',
    sidebar: {
      bg: 'from-slate-100 via-slate-50 to-white',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-slate-800',
      textMuted: 'text-slate-500',
      activeItem: 'bg-blue-600 text-white shadow-lg shadow-blue-600/30',
      hoverBg: 'hover:bg-slate-200',
      border: 'border-slate-200',
      logoAccent: 'from-blue-500 to-indigo-500',
    },
    accent: 'bg-blue-600',
    accentHover: 'hover:bg-blue-700',
    accentLight: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'coffee',
    name: '☕ Coffee',
    sidebar: {
      bg: 'from-amber-950 via-amber-900 to-yellow-900',
      bgGradient: 'bg-gradient-to-b',
      text: 'text-white',
      textMuted: 'text-amber-300',
      activeItem: 'bg-amber-600 shadow-lg shadow-amber-600/30',
      hoverBg: 'hover:bg-white/10',
      border: 'border-white/10',
      logoAccent: 'from-yellow-400 to-amber-500',
    },
    accent: 'bg-amber-600',
    accentHover: 'hover:bg-amber-700',
    accentLight: 'bg-amber-100 text-amber-700',
  },
];

interface ThemeState {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      currentTheme: themes[0], // Default to Ocean Blue
      setTheme: (themeId: string) => {
        const theme = themes.find((t) => t.id === themeId);
        if (theme) {
          set({ currentTheme: theme });
        }
      },
    }),
    {
      name: 'ims-theme',
    }
  )
);

