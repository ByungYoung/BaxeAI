"use client";

import { useState, useEffect, createContext, useContext } from "react";
// 서버 API를 사용하도록 직접적인 Google Translate 임포트 제거

type LanguageContextType = {
  locale: string;
  setLocale: (locale: string) => void;
  translate: (text: string) => Promise<string>;
  t: (key: string) => string;
};

// 번역 캐시 - 이미 번역한 텍스트를 저장
const translationCache: Record<string, Record<string, string>> = {};

// 번역 키에 대한 기본 텍스트 (한국어)
const translations: Record<string, string> = {
  home: "홈",
  start_measurement: "측정 시작",
  history: "측정 기록",
  hrv_measurement: "Baxe AI 측정",
  start_now: "지금 시작하기",
  learn_more: "자세히 알아보기",
  features: "서비스 특징",
  contactless_measurement: "비접촉식 측정",
  hrv_analysis: "Baxe AI 분석",
  health_index: "건강 지표",
  quick_measurement: "빠른 측정",
  start_right_now: "지금 바로 시작하세요",
  terms_of_service: "이용약관",
  privacy_policy: "개인정보처리방침",
  // 더 많은 번역 키를 추가할 수 있습니다
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// API 라우트를 통해 번역하는 새로운 함수
const translateViaAPI = async (
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> => {
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        targetLanguage,
        sourceLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translatedText as string;
  } catch (error) {
    console.error("Translation API error:", error);
    return text; // 오류 발생 시 원본 텍스트 반환
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState("ko");

  // 컴포넌트 마운트 시 로컬스토리지에서 언어 설정 불러오기
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== "undefined") {
      const savedLocale = localStorage.getItem("language");
      if (savedLocale) {
        setLocale(savedLocale);
      }
    }
  }, []);

  // 언어 변경 시 로컬스토리지에 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("language", locale);
    }
  }, [locale]);

  // 텍스트 번역 함수 - API 라우트 사용
  const translate = async (text: string): Promise<string> => {
    // 한국어인 경우 번역하지 않음
    if (locale === "ko") {
      return text;
    }

    // 캐시에 번역이 있는지 확인
    if (translationCache[locale]?.[text]) {
      return translationCache[locale][text];
    }

    try {
      // API 라우트를 통해 번역
      const translated = await translateViaAPI(text, locale);

      // 캐시에 번역 저장
      if (!translationCache[locale]) {
        translationCache[locale] = {};
      }
      translationCache[locale][text] = translated;

      return translated;
    } catch (error) {
      console.error("번역 오류:", error);
      return text; // 오류 시 원본 텍스트 반환
    }
  };

  // 간단한 번역 함수 - 미리 정의된 키 사용
  const t = (key: string): string => {
    // 키에 해당하는 한국어 텍스트 가져오기
    const originalText = translations[key] || key;

    // 한국어인 경우 바로 반환
    if (locale === "ko") {
      return originalText;
    }

    // 캐시에 번역이 있는지 확인
    if (translationCache[locale]?.[originalText]) {
      return translationCache[locale][originalText];
    }

    // 캐시에 없으면 키 반환 (비동기 번역은 별도 호출 필요)
    return originalText;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, translate, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
