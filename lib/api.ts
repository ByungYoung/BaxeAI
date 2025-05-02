// 자주 사용하는 API 엔드포인트에 대한 타입 안전한 클라이언트 함수

import { MeasurementResult, UserData } from "./types";

/**
 * 측정 이력 조회 API
 */
export async function fetchMeasurementHistory(
  userId?: string
): Promise<MeasurementResult[]> {
  if (!userId) {
    // 사용자 ID가 없으면 빈 배열 반환 (에러 대신)
    return [];
  }

  const response = await fetch(`/api/measurements?userId=${userId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "측정 이력 조회 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 사용자 목록 조회 API
 */
export async function fetchUsers(email?: string): Promise<UserData[]> {
  const url = new URL("/api/users", window.location.origin);
  if (email) {
    url.searchParams.append("email", email);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "사용자 목록 조회 중 오류가 발생했습니다"
    );
  }

  return response.json();
}

/**
 * 특정 사용자 정보 조회 API
 */
export async function fetchUser(id: string): Promise<UserData> {
  const response = await fetch(`/api/users/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "사용자 정보 조회 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 사용자 등록 API
 */
export async function registerUser(userData: {
  email: string;
  password: string;
  name?: string;
  company?: string;
}): Promise<UserData> {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "사용자 등록 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 사용자 정보 업데이트 API
 */
export async function updateUser(userData: {
  id: string;
  name?: string;
  company?: string;
  password?: string;
  isAdmin?: boolean;
}): Promise<UserData> {
  const response = await fetch("/api/users", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "사용자 정보 업데이트 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 사용자 삭제 API
 */
export async function deleteUser(id: string): Promise<{ deletedId: string }> {
  const response = await fetch(`/api/users?id=${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "사용자 삭제 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 측정 결과 저장 API
 */
export async function saveMeasurementResult(data: any): Promise<any> {
  const response = await fetch("/api/measurements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "측정 결과 저장 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 측정 결과 상세 조회 API
 */
export async function fetchMeasurementDetail(id: string): Promise<MeasurementResult> {
  const response = await fetch(`/api/measurements/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "측정 결과 상세 조회 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * rPPG 프레임 처리 API
 */
export async function processRPPGFrames(frames: string[]): Promise<any> {
  const response = await fetch("/api/process-rppg", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ frames }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "rPPG 처리 중 오류가 발생했습니다");
  }

  return response.json();
}

/**
 * 캐리커처 생성 API
 */
export async function generateCaricature(
  base64Data: string
): Promise<{ success: boolean; caricatureUrl?: string; error?: string }> {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "image/jpeg" });

  const formData = new FormData();
  formData.append("image", blob, "captured-image.jpg");

  const response = await fetch("/api/caricature", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "캐리커처 생성 중 오류가 발생했습니다");
  }

  return response.json();
}
