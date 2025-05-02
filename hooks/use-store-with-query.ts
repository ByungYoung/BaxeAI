"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useMeasurementHistory,
  useSaveMeasurement,
  QUERY_KEYS,
  useUser,
} from "@/hooks/use-queries";
import { useMeasurementStore, useUserStore } from "@/lib/store/index";
import { MeasurementResult } from "@/lib/types";

/**
 * 서버 상태(TanStack Query)와 클라이언트 상태(Zustand)를 연결하는 훅입니다.
 * 서버에서 가져온 측정 기록을 Zustand 스토어에 동기화합니다.
 */
export function useServerStateSync() {
  const queryClient = useQueryClient();
  const userInfo = useUserStore((state) => state.userInfo);
  const updateHistoryFromServer = useMeasurementStore(
    (state) => state.updateHistoryFromServer
  );
  const { mutateAsync: saveMeasurementAsync } = useSaveMeasurement();

  // 사용자 ID로 측정 기록을 가져옵니다
  const { data: measurementHistory, isSuccess } = useMeasurementHistory(
    userInfo?.id,
    {
      queryKey: [QUERY_KEYS.MEASUREMENT_HISTORY, userInfo?.id],
      // 로그인한 사용자가 있을 때만 쿼리 활성화
      enabled: !!userInfo?.id,
      // 30초마다 자동으로 새로고침
      refetchInterval: 30000,
    }
  );

  // 사용자 정보 연동
  const { data: userData } = useUser(userInfo?.id, {
    queryKey: [QUERY_KEYS.USER, userInfo?.id],
    // 로그인한 사용자가 있을 때만 쿼리 활성화
    enabled: !!userInfo?.id,
    // 사용자 정보는 자주 변경되지 않으므로 캐시 시간을 길게 설정
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 서버에서 가져온 사용자 정보로 Zustand 스토어 업데이트
  useEffect(() => {
    if (userData && userInfo) {
      useUserStore.getState().setUserInfo({
        ...userInfo,
        name: userData.name || userInfo.name,
        company: userData.company || userInfo.company,
      });
    }
  }, [userData, userInfo]);

  // 서버 데이터가 성공적으로 로드되면 Zustand 스토어를 업데이트합니다
  useEffect(() => {
    if (isSuccess && measurementHistory) {
      updateHistoryFromServer(measurementHistory);
    }
  }, [isSuccess, measurementHistory, updateHistoryFromServer]);

  // 클라이언트 측 측정 결과를 서버에 저장하는 함수
  const syncMeasurementToServer = async (
    measurementResult: MeasurementResult
  ) => {
    try {
      // 사용자 정보 추가
      const dataToSave = {
        ...measurementResult,
        userId: userInfo?.id,
        userEmail: userInfo?.email,
        userName: userInfo?.name,
        userCompany: userInfo?.company,
      };

      // API 호출하여 서버에 저장
      const savedResult = await saveMeasurementAsync(dataToSave);

      // 저장 후 쿼리 캐시 무효화
      await queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MEASUREMENT_HISTORY, userInfo?.id],
      });

      return { success: true, data: savedResult };
    } catch (error) {
      console.error("Failed to sync measurement to server:", error);
      return { success: false, error };
    }
  };

  // 캐시된 서버 데이터 강제 새로고침
  const refreshServerData = async () => {
    if (userInfo?.id) {
      await queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MEASUREMENT_HISTORY, userInfo.id],
      });
      await queryClient.refetchQueries({
        queryKey: [QUERY_KEYS.MEASUREMENT_HISTORY, userInfo.id],
      });
    }
  };

  return {
    syncMeasurementToServer,
    refreshServerData,
    queryClient,
  };
}

/**
 * 서버 쿼리와 클라이언트 상태를 함께 사용하는 측정 기록 훅
 */
export function useCombinedMeasurementHistory() {
  // 서버 상태
  const userInfo = useUserStore((state) => state.userInfo);
  const {
    data: serverHistory,
    isLoading,
    isError,
    error,
  } = useMeasurementHistory(userInfo?.id, {
    queryKey: [QUERY_KEYS.MEASUREMENT_HISTORY, userInfo?.id],
  });

  // 클라이언트 상태
  const localHistory = useMeasurementStore((state) => state.historyResults);

  // 서버 상태가 로드되었으면 서버 데이터 사용, 아니면 로컬 캐시 사용
  const combinedHistory =
    isLoading || isError ? localHistory : serverHistory || localHistory;

  return {
    history: combinedHistory,
    isLoading,
    isError,
    error,
  };
}
