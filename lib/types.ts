import { HRVMetrics } from "./api-client";

export interface UserInfo {
  company: string;
  email: string;
  name?: string;
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
  mood?: MoodState; // 기분 상태 필드 추가
}

export type StressLevel = "low" | "moderate" | "high" | "unknown";
