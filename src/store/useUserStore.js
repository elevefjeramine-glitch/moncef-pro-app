import { create } from 'zustand';

export const useUserStore = create((set) => ({
  user: null,
  credits: 0,
  themeColor: '#00D2B6',
  language: 'fr',
  setUser: (userData) => set({ user: userData }),
  setCredits: (amount) => set({ credits: amount }),
  setThemeColor: (color) => set({ themeColor: color }),
  setLanguage: (lang) => set({ language: lang }),
  clearUser: () => set({ user: null, credits: 0, themeColor: '#00D2B6', language: 'fr' }),
}));
