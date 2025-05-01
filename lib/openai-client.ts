import OpenAI from "openai";
import { MeasurementResult, MoodState } from "./types";

// OpenAI API 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // 브라우저에서 사용 허용 (주의: 프로덕션에서는 서버 측 호출 권장)
});

/**
 * 측정 결과를 분석하여 건강 상태에 대한 간략한 분석 제공
 */
export async function analyzeHealthStatus(
  result: MeasurementResult
): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return "API 키가 설정되지 않아 분석을 제공할 수 없습니다.";
    }

    // OpenAI에게 보낼 프롬프트 작성
    const prompt = `
      다음은 비접촉식 심박수 측정 결과입니다:
      - 심박수: ${result.heartRate.toFixed(1)} BPM
      - 자신이 선택한 기분: ${getMoodText(result.mood)}
      ${
        result.detectedMood
          ? `- 카메라로 감지한 표정: ${getMoodText(result.detectedMood)}`
          : ""
      }
      ${
        result.moodMatchScore !== undefined
          ? `- 기분-표정 일치도: ${result.moodMatchScore}%`
          : ""
      }
      ${
        result.hrv?.rmssd !== undefined
          ? `- RMSSD(심박변이도): ${result.hrv.rmssd.toFixed(2)} ms`
          : ""
      }
      ${
        result.hrv?.sdnn !== undefined
          ? `- SDNN(심박변이도): ${result.hrv.sdnn.toFixed(2)} ms`
          : ""
      }
      ${
        result.hrv?.lfHfRatio !== undefined
          ? `- LF/HF 비율: ${result.hrv.lfHfRatio.toFixed(2)}`
          : ""
      }
      
      위 데이터를 기반으로 측정자의 건강 및 정신 상태에 대한 매우 간략한 분석을 2~3문장으로 제공해 주세요. 
      의학적 조언이나 진단이 아닌 참고용 정보임을 언급해주세요. 한국어로 응답해 주세요.
    `;

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content:
            "당신은 건강 데이터를 분석하여 간결하고 명확한 인사이트를 제공하는 전문가입니다. 의학 용어를 일반인이 이해하기 쉽게 설명해주세요.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || "분석을 제공할 수 없습니다.";
  } catch (error) {
    console.error("OpenAI API 오류:", error);
    return "분석 중 오류가 발생했습니다. 다시 시도해 주세요.";
  }
}

/**
 * 선택한 기분 상태에 맞는 간략한 관리 팁 제공
 */
export async function getMoodManagementTips(mood: MoodState): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return "API 키가 설정되지 않아 팁을 제공할 수 없습니다.";
    }

    // OpenAI에게 보낼 프롬프트 작성
    const prompt = `
      사용자의 현재 기분은 '${getMoodText(mood)}'입니다.
      
      이 기분 상태를 관리하거나 개선하기 위한 실용적인 팁 2~3가지를 간략하게 알려주세요.
      한국어로 응답해 주세요.
    `;

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "당신은 정신 건강 관리 전문가입니다. 사용자의 기분에 따라 실용적이고 즉시 실행 가능한 조언을 제공해 주세요.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || "팁을 제공할 수 없습니다.";
  } catch (error) {
    console.error("OpenAI API 오류:", error);
    return "팁을 가져오는 중 오류가 발생했습니다.";
  }
}

// 도우미 함수: 기분 상태 텍스트 반환
function getMoodText(mood?: MoodState): string {
  switch (mood) {
    case "happy":
      return "행복함";
    case "sad":
      return "우울함";
    case "stressed":
      return "스트레스";
    case "relaxed":
      return "편안함";
    case "neutral":
      return "보통";
    default:
      return "알 수 없음";
  }
}
