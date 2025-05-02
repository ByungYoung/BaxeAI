import { TranslationServiceClient } from "@google-cloud/translate";

// 구글 클라우드 인증 정보
// 주의: 실제 프로덕션에서는 환경 변수나 보안 저장소에서 관리해야 합니다
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || "your-project-id";
const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

// 구글 번역 클라이언트 초기화
let translationClient: TranslationServiceClient | null = null;

export const getTranslationClient = (): TranslationServiceClient => {
  if (!translationClient) {
    translationClient = new TranslationServiceClient({
      projectId: PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      // API 키가 있을 경우 사용
      ...(API_KEY ? { key: API_KEY } : {}),
    });
  }
  return translationClient;
};

// 대체 번역 함수 - fetch API를 사용해 Google Translate API 직접 호출
export async function translateText(
  text: string | string[],
  targetLanguage: string = "ko",
  sourceLanguage?: string
): Promise<string | string[]> {
  try {
    // 서버 환경에서 TranslationServiceClient 사용
    if (typeof window === "undefined" && process.env.GOOGLE_PRIVATE_KEY) {
      const client = getTranslationClient();

      const request = {
        parent: `projects/${PROJECT_ID}/locations/global`,
        contents: Array.isArray(text) ? text : [text],
        mimeType: "text/plain",
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      };

      const [response] = await client.translateText(request);

      if (!response.translations || response.translations.length === 0) {
        throw new Error("No translation returned");
      }

      const translatedTexts = response.translations.map(
        (t) => t.translatedText || ""
      );

      return Array.isArray(text) ? translatedTexts : translatedTexts[0];
    }
    // API 키를 사용한 REST API 호출 (클라이언트 또는 API 키만 있는 서버 환경)
    else if (API_KEY) {
      const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`;
      const textToTranslate = Array.isArray(text) ? text : [text];

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: textToTranslate,
          target: targetLanguage,
          ...(sourceLanguage ? { source: sourceLanguage } : {}),
          format: "text",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (
        !data.data ||
        !data.data.translations ||
        data.data.translations.length === 0
      ) {
        throw new Error("No translation returned from API");
      }

      const translatedTexts = data.data.translations.map(
        (t: any) => t.translatedText
      );
      return Array.isArray(text) ? translatedTexts : translatedTexts[0];
    } else {
      return Array.isArray(text) ? text : text;
    }
  } catch (error) {
    return Array.isArray(text) ? text : text;
  }
}
