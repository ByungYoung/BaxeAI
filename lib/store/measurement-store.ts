import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { MeasurementResult, MoodState } from "../types";
import { HRVMetrics } from "../api-client";

interface MeasurementState {
  // 현재 측정 결과
  currentResult: MeasurementResult | null;

  // 이전 측정 결과 목록 (로컬에 캐시)
  historyResults: MeasurementResult[];

  // 액션
  setCurrentResult: (
    resultOrHeartRate: MeasurementResult | number,
    confidence?: number,
    hrv?: HRVMetrics,
    mood?: MoodState,
    detectedMood?: MoodState,
    moodMatchScore?: number
  ) => void;
  updateCurrentMood: (mood: MoodState) => void;
  resetCurrentResult: () => void;
  addToHistory: () => void;
  clearHistory: () => void;
  updateHistoryFromServer: (results: MeasurementResult[]) => void;
}

export const useMeasurementStore = create<MeasurementState>()(
  persist(
    (set, get) => ({
      // 상태
      currentResult: null,
      historyResults: [],

      // 액션
      setCurrentResult: (
        resultOrHeartRate: MeasurementResult | number,
        confidence?: number,
        hrv?: HRVMetrics,
        mood?: MoodState,
        detectedMood?: MoodState,
        moodMatchScore?: number
      ) => {
        // 만약 객체가 들어왔다면 그대로 사용
        if (
          typeof resultOrHeartRate === "object" &&
          resultOrHeartRate !== null
        ) {
          set({ currentResult: resultOrHeartRate });
          return;
        }

        // UserInfo는 useUserStore에서 가져와야 하지만
        // circular dependency 방지를 위해 필요한 경우 별도로 처리
        const heartRate = resultOrHeartRate as number;

        set({
          currentResult: {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            heartRate,
            confidence: confidence || 0,
            hrv,
            userInfo: {
              id: 'temporary-id',
              email: '',
              company: '',
            }, // 임시 userInfo 객체 생성
            mood: mood || "unknown",
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

      addToHistory: () => {
        const current = get().currentResult;
        if (!current) return;

        set((state) => ({
          historyResults: [current, ...state.historyResults],
        }));
      },

      clearHistory: () => set({ historyResults: [] }),

      // 서버에서 가져온 데이터로 로컬 상태를 업데이트
      updateHistoryFromServer: (results: MeasurementResult[]) =>
        set({ historyResults: results }),
    }),
    {
      name: "rppg-measurement-storage",
      partialize: (state) => ({
        historyResults: state.historyResults,
      }),
    }
  )
);
