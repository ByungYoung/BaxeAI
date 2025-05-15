import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // UI 관련 상태
  isMobileMenuOpen: boolean;
  isLoading: boolean;

  // 액션
  setMobileMenuOpen: (isOpen: boolean) => void;
  toggleMobileMenu: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // 상태
      isMobileMenuOpen: false,
      isLoading: false,

      // 액션
      setMobileMenuOpen: (isOpen: boolean) => set({ isMobileMenuOpen: isOpen }),
      toggleMobileMenu: () => set(state => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
      setLoading: (isLoading: boolean) => set({ isLoading }),
    }),
    {
      name: 'rppg-ui-storage',
      partialize: state => ({}), // UI 상태는 영구 저장하지 않음
    }
  )
);
