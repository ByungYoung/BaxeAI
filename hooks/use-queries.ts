"use client";

import {
  useMutation,
  useQuery,
  UseMutationOptions,
  UseQueryOptions,
  QueryClient,
} from "@tanstack/react-query";
import {
  fetchMeasurementHistory,
  fetchUsers,
  fetchUser,
  registerUser,
  updateUser,
  deleteUser,
  saveMeasurementResult,
  fetchMeasurementDetail,
  processRPPGFrames,
  generateCaricature,
} from "@/lib/api";
import { MeasurementResult, UserData } from "@/lib/types";

// 쿼리 키 상수
export const QUERY_KEYS = {
  MEASUREMENT_HISTORY: "measurementHistory",
  MEASUREMENT_DETAIL: "measurementDetail",
  USERS: "users",
  USER: "user",
};

/**
 * 측정 이력 조회 훅
 */
export function useMeasurementHistory(
  userId?: string,
  options?: UseQueryOptions<MeasurementResult[]>
) {
  return useQuery({
    queryKey: [QUERY_KEYS.MEASUREMENT_HISTORY, userId],
    queryFn: () => fetchMeasurementHistory(userId),
    enabled: !!userId,
    ...options,
  });
}

/**
 * 측정 결과 상세 조회 훅
 */
export function useMeasurementDetail(
  id?: string,
  options?: UseQueryOptions<MeasurementResult>
) {
  return useQuery({
    queryKey: [QUERY_KEYS.MEASUREMENT_DETAIL, id],
    queryFn: () => fetchMeasurementDetail(id!),
    enabled: !!id,
    ...options,
  });
}

/**
 * 사용자 목록 조회 훅
 */
export function useUsers(
  email?: string,
  options?: UseQueryOptions<UserData[]>
) {
  return useQuery({
    queryKey: [QUERY_KEYS.USERS, email],
    queryFn: () => fetchUsers(email),
    ...options,
  });
}

/**
 * 특정 사용자 정보 조회 훅
 */
export function useUser(id?: string, options?: UseQueryOptions<UserData>) {
  return useQuery({
    queryKey: [QUERY_KEYS.USER, id],
    queryFn: () => fetchUser(id!),
    enabled: !!id,
    ...options,
  });
}

/**
 * 사용자 등록 훅 (mutation)
 */
export function useRegisterUser(
  options?: UseMutationOptions<
    UserData,
    Error,
    { email: string; password: string; name?: string; company?: string }
  >
) {
  return useMutation({
    mutationFn: (data) => registerUser(data),
    ...options,
  });
}

/**
 * 사용자 정보 업데이트 훅 (mutation)
 */
export function useUpdateUser(
  options?: UseMutationOptions<
    UserData,
    Error,
    {
      id: string;
      name?: string;
      company?: string;
      password?: string;
      isAdmin?: boolean;
    }
  >
) {
  return useMutation({
    mutationFn: (data) => updateUser(data),
    ...options,
  });
}

/**
 * 사용자 삭제 훅 (mutation)
 */
export function useDeleteUser(
  options?: UseMutationOptions<{ deletedId: string }, Error, string>
) {
  return useMutation({
    mutationFn: (id) => deleteUser(id),
    ...options,
  });
}

/**
 * 측정 결과 저장 훅 (mutation)
 */
export function useSaveMeasurement(
  options?: UseMutationOptions<MeasurementResult, Error, any>
) {
  return useMutation({
    mutationFn: (data: any) => saveMeasurementResult(data),
    ...options,
  });
}

/**
 * rPPG 프레임 처리 훅 (mutation)
 */
export function useProcessRPPG(
  options?: UseMutationOptions<any, Error, string[]>
) {
  return useMutation({
    mutationFn: (frames: string[]) => processRPPGFrames(frames),
    ...options,
  });
}

/**
 * 캐리커처 생성 훅 (mutation)
 */
export function useGenerateCaricature(
  options?: UseMutationOptions<
    { success: boolean; caricatureUrl?: string; error?: string },
    Error,
    string
  >
) {
  return useMutation({
    mutationFn: (base64Data: string) => generateCaricature(base64Data),
    ...options,
  });
}

/**
 * 쿼리 무효화 유틸리티 함수
 */
export const invalidateQueries = async (
  queryClient: QueryClient,
  queryKey: string | string[]
) => {
  const key = Array.isArray(queryKey) ? queryKey : [queryKey];
  await queryClient.invalidateQueries({ queryKey: key });
};
