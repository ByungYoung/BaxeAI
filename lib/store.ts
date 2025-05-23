import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HRVMetrics } from './api-client';
import { MeasurementResult, MoodState, UserInfo } from './types';

interface AppState {
  // 사용자 정보
  userInfo: UserInfo | null;
  setUserInfo: (info: UserInfo) => void;
  clearUserInfo: () => void; // 로그아웃 시 사용자 정보 초기화

  // 로그인 상태
  isAuthenticated: boolean;
  setAuthenticated: (status: boolean) => void;

  // 현재 측정 결과
  currentResult: MeasurementResult | null;
  setCurrentResult: (
    resultOrHeartRate: MeasurementResult | number,
    confidence?: number,
    hrv?: HRVMetrics,
    mood?: MoodState,
    detectedMood?: MoodState,
    moodMatchScore?: number,
    temperature?: number
  ) => void;
  updateCurrentMood: (mood: MoodState) => void;
  resetCurrentResult: () => void;

  // 이전 측정 결과 목록
  historyResults: MeasurementResult[];
  addToHistory: () => void;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 사용자 정보
      userInfo: null,
      setUserInfo: (info: UserInfo) => set({ userInfo: info, isAuthenticated: true }),
      clearUserInfo: () => set({ userInfo: null, isAuthenticated: false }),

      // 로그인 상태
      isAuthenticated: false,
      setAuthenticated: (status: boolean) => set({ isAuthenticated: status }),

      // 현재 측정 결과
      currentResult: null,
      setCurrentResult: (
        resultOrHeartRate: MeasurementResult | number,
        confidence?: number,
        hrv?: HRVMetrics,
        mood?: MoodState,
        detectedMood?: MoodState,
        moodMatchScore?: number,
        temperature?: number
      ) => {
        // 만약 객체가 들어왔다면 그대로 사용
        if (typeof resultOrHeartRate === 'object' && resultOrHeartRate !== null) {
          set({ currentResult: resultOrHeartRate });
          return;
        }

        const heartRate = resultOrHeartRate as number;
        const userInfo = get().userInfo;
        if (!userInfo) return;

        // 기본값으로 "unknown" 사용
        const actualMood = mood || 'unknown';

        set({
          currentResult: {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            heartRate,
            confidence: confidence || 0,
            temperature,
            hrv,
            userInfo,
            mood: actualMood,
            detectedMood,
            moodMatchScore,
          },
        });
      },
      updateCurrentMood: (mood: MoodState) => {
        const current = get().currentResult;
        if (!current) return;

        set({
          currentResult: {
            ...current,
            mood,
          },
        });
      },
      resetCurrentResult: () => set({ currentResult: null }),

      // 이전 측정 결과 목록
      historyResults: [],
      addToHistory: () => {
        const current = get().currentResult;
        if (!current) return;

        set(state => ({
          historyResults: [current, ...state.historyResults],
        }));
      },
      clearHistory: () => set({ historyResults: [] }),
    }),
    {
      name: 'rppg-app-storage', // 로컬 스토리지 키 이름
      partialize: state => ({
        userInfo: state.userInfo,
        isAuthenticated: state.isAuthenticated,
        historyResults: state.historyResults,
      }),
    }
  )
);
