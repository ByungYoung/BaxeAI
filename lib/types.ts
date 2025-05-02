import { HRVMetrics } from "./api-client";

export interface UserInfo {
  id: string;
  company: string;
  email: string;
  name?: string;
  isAdmin?: boolean;
  isGuest?: boolean;
}

// 기분 상태 타입 추가
export type MoodState =
  | "happy"
  | "neutral"
  | "sad"
  | "stressed"
  | "relaxed"
  | "unknown";

export interface MeasurementResult {
  id: string;
  timestamp: string;
  heartRate: number;
  confidence: number;
  hrv?: HRVMetrics;
  userInfo: UserInfo;
  mood?: MoodState; // 사용자가 선택한 기분 상태
  detectedMood?: MoodState; // 카메라로 감지한 기분 상태
  moodMatchScore?: number; // 선택한 기분과 감지된 기분의 일치도 (0-100%)
  caricatureUrl?: string; // 캐리커처 이미지 URL
}

export type StressLevel = "low" | "moderate" | "high" | "unknown";
