"use client";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MeasurementResult } from "./types";
import { use, useEffect, useLayoutEffect } from "react";

// 서버 사이드 렌더링에서 useLayoutEffect 경고를 방지하기 위한 유틸리티 함수
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 측정 결과를 DB에 저장하는 함수
export async function saveMeasurementToDB(result: MeasurementResult) {
  if (!result || !result.userInfo.id) {
    throw new Error("사용자 정보 없이 결과를 저장할 수 없습니다");
  }

  try {
    const response = await fetch("/api/measurements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: result.userInfo.id,
        heartRate: result.heartRate,
        confidence: result.confidence,
        rmssd: result.hrv?.rmssd,
        sdnn: result.hrv?.sdnn,
        lf: result.hrv?.lf,
        hf: result.hrv?.hf,
        lfHfRatio: result.hrv?.lfHfRatio,
        pnn50: result.hrv?.pnn50,
      }),
    });

    if (!response.ok) {
      throw new Error("측정 결과 저장 실패");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// 사용자 정보를 DB에 저장하는 함수
export async function saveUserToDB(
  email: string,
  name: string | undefined,
  company: string
) {
  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        name,
        company,
      }),
    });

    if (!response.ok) {
      throw new Error("사용자 정보 저장 실패");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * 심박수와 HRV 데이터를 기반으로 스트레스 레벨을 계산합니다.
 * 0-100 범위의 스트레스 점수를 반환합니다.
 */
export function calculateStressLevel(heartRate: number, hrv: number): number {
  // 정상 범위 정의 (일반적인 성인 기준)
  const MIN_NORMAL_HR = 60;
  const MAX_NORMAL_HR = 100;
  const MIN_NORMAL_HRV = 20;
  const MAX_NORMAL_HRV = 70;

  // 심박수 스트레스 점수 (정상 범위에서 벗어날수록 높은 점수)
  let hrStress = 0;
  if (heartRate < MIN_NORMAL_HR) {
    hrStress = 50 * (1 - heartRate / MIN_NORMAL_HR);
  } else if (heartRate > MAX_NORMAL_HR) {
    hrStress = 50 * (heartRate / MAX_NORMAL_HR - 1);
  }

  // HRV 스트레스 점수 (낮을수록 스트레스가 높음)
  let hrvStress = 0;
  if (hrv < MIN_NORMAL_HRV) {
    hrvStress = 50 * (1 - hrv / MIN_NORMAL_HRV);
  } else if (hrv > MAX_NORMAL_HRV) {
    // 너무 높은 HRV도 비정상일 수 있음
    hrvStress = 25 * (hrv / MAX_NORMAL_HRV - 1);
  }

  // 최종 스트레스 점수 계산 (0-100)
  const stressScore = Math.min(100, Math.max(0, hrStress + hrvStress));
  return Math.round(stressScore);
}

/**
 * 스트레스 레벨 점수(0-100)에 따른 텍스트 설명을 반환합니다.
 */
export function getStressLevelText(stressLevel: number): string {
  if (stressLevel < 20) {
    return "매우 낮음";
  } else if (stressLevel < 40) {
    return "낮음";
  } else if (stressLevel < 60) {
    return "보통";
  } else if (stressLevel < 80) {
    return "높음";
  } else {
    return "매우 높음";
  }
}
