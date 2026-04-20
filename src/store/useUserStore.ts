import { create } from 'zustand';

interface UserStore {
  user: any;
  credits: number;
  themeColor: string;
  language: string;
  setUser: (userData: any) => void;
  setCredits: (amount: number) => void;
  setThemeColor: (color: string) => void;
  setLanguage: (lang: string) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  credits: 0,
  themeColor: '#00D2B6',
  language: 'fr',
  setUser: (userData: any) => set({ user: userData }),
  setCredits: (amount: number) => set({ credits: amount }),
  setThemeColor: (color: string) => set({ themeColor: color }),
  setLanguage: (lang: string) => set({ language: lang }),
  clearUser: () => set({ user: null, credits: 0, themeColor: '#00D2B6', language: 'fr' }),
}));
