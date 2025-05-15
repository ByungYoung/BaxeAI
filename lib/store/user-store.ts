import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserInfo } from '../types';

interface UserState {
  // 사용자 정보
  userInfo: UserInfo | null;
  isAuthenticated: boolean;

  // 액션
  setUserInfo: (info: UserInfo) => void;
  clearUserInfo: () => void;
  setAuthenticated: (status: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    set => ({
      // 상태
      userInfo: null,
      isAuthenticated: false,

      // 액션
      setUserInfo: (info: UserInfo) => set({ userInfo: info, isAuthenticated: true }),
      clearUserInfo: () => set({ userInfo: null, isAuthenticated: false }),
      setAuthenticated: (status: boolean) => set({ isAuthenticated: status }),
    }),
    {
      name: 'rppg-user-storage',
      partialize: state => ({
        userInfo: state.userInfo,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
