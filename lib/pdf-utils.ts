'use client';

import { jsPDF } from 'jspdf';

/**
 * jsPDF 설정 초기화 및 폰트 로딩 관련 유틸리티 함수들
 *
 * 이 모듈은 jsPDF를 사용하여 PDF를 생성할 때 한글 또는 일본어 폰트를 사용할 수 있도록 합니다.
 * Vercel 환경이나 다양한 환경에서 폰트 로드 문제를 해결하기 위한 유틸리티 함수들을 제공합니다.
 */

declare global {
  interface Window {
    jspdf?: {
      addFont?: (fontBase64: string, fontName: string, fontStyle: string) => void;
    };
  }
}

/**
 * ArrayBuffer를 Base64 문자열로 변환
 */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

/**
 * PDF 인스턴스를 생성하고 사용 가능한 폰트를 설정
 */
export const createPdf = ({
  orientation = 'portrait',
  unit = 'mm',
  format = 'a4',
}: {
  orientation?: 'portrait' | 'landscape';
  unit?: string;
  format?: string;
} = {}): jsPDF => {
  const pdf = new jsPDF(orientation, unit as any, format);

  // 기본 설정
  pdf.setFont('helvetica');

  return pdf;
};

/**
 * 여러 위치에서 폰트 파일 로드 시도
 */
export const loadFontFromMultiplePaths = async (
  fontPaths: string[]
): Promise<ArrayBuffer | null> => {
  for (const fontPath of fontPaths) {
    try {
      console.log(`폰트 로드 시도: ${fontPath}`);
      const response = await fetch(fontPath);

      if (response.ok) {
        console.log(`폰트 로드 성공: ${fontPath}`);
        return await response.arrayBuffer();
      }
      console.warn(`폰트 로드 실패 (${fontPath}): ${response.statusText}`);
    } catch (error) {
      console.warn(`폰트 로드 오류 (${fontPath}): ${(error as Error).message}`);
    }
  }

  return null;
};

/**
 * PDF에 한국어 또는 일본어 폰트 추가 시도
 */
export const addCjkFontToPdf = async (
  pdf: jsPDF,
  language: 'ko' | 'ja' | 'en' = 'ko'
): Promise<boolean> => {
  if (language === 'en' || typeof window === 'undefined') {
    return false;
  }

  const fontName = language === 'ko' ? 'NotoSansKR' : 'NotoSansJP';

  try {
    // 여러 가능한 경로에서 폰트 로드 시도
    const fontPaths = [
      `/fonts/NotoSansCJKkr-Regular.ttf`,
      `/NotoSansCJKkr-Regular.ttf`,
      `fonts/NotoSansCJKkr-Regular.ttf`,
      `./fonts/NotoSansCJKkr-Regular.ttf`,
      `/public/fonts/NotoSansCJKkr-Regular.ttf`,
      `/fonts/NanumGothic-Regular.ttf`,
    ];

    const fontData = await loadFontFromMultiplePaths(fontPaths);

    if (!fontData) {
      console.warn('폰트를 로드할 수 없습니다. 기본 폰트를 사용합니다.');
      return false;
    }

    const fontBase64 = arrayBufferToBase64(fontData);

    // jsPDF에 폰트 추가
    if (window.jspdf?.addFont) {
      window.jspdf.addFont(fontBase64, fontName, 'normal');
      pdf.setFont(fontName);
      console.log(`폰트 추가 성공: ${fontName}`);
      return true;
    } else {
      console.warn('jsPDF addFont 메서드를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('폰트 추가 중 오류:', error);
  }

  return false;
};
