import OpenAI from 'openai';
import { MeasurementResult, MoodState } from './types';

// OpenAI API 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // 브라우저에서 사용 허용 (주의: 프로덕션에서는 서버 측 호출 권장)
});

/**
 * 측정 결과를 분석하여 건강 상태에 대한 간략한 분석 제공
 */
export async function analyzeHealthStatus(result: MeasurementResult): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return 'API 키가 설정되지 않아 분석을 제공할 수 없습니다.';
    }

    // OpenAI에게 보낼 프롬프트 작성
    const prompt = `
      다음은 비접촉식 심박수 측정 결과입니다:
      - 심박수: ${result.heartRate.toFixed(1)} BPM
      - 자신이 선택한 기분: ${getMoodText(result.mood)}
      ${result.detectedMood ? `- 카메라로 감지한 표정: ${getMoodText(result.detectedMood)}` : ''}
      ${result.moodMatchScore !== undefined ? `- 기분-표정 일치도: ${result.moodMatchScore}%` : ''}
      ${
        result.detectedMood && result.mood !== result.detectedMood
          ? `- 선택한 기분과 카메라로 감지한 표정이 다릅니다. 이는 사용자가 내적으로 느끼는 감정과 외적으로 표현하는 감정에 차이가 있을 수 있음을 나타냅니다.`
          : result.detectedMood && result.mood === result.detectedMood
            ? `- 선택한 기분과 카메라로 감지한 표정이 일치합니다. 이는 사용자의 내적 감정과 외적 표현이 조화를 이루고 있음을 나타냅니다.`
            : ''
      }
      ${
        result.hrv?.rmssd !== undefined
          ? `- RMSSD(심박변이도): ${result.hrv.rmssd.toFixed(2)} ms`
          : ''
      }
      ${
        result.hrv?.sdnn !== undefined ? `- SDNN(심박변이도): ${result.hrv.sdnn.toFixed(2)} ms` : ''
      }
      ${
        result.hrv?.lfHfRatio !== undefined && result.hrv?.lfHfRatio !== null
          ? `- LF/HF 비율: ${Number(result.hrv.lfHfRatio).toFixed(2)}`
          : ''
      }
      
      위 데이터를 기반으로 측정자의 건강 및 정신 상태에 대한 매우 간략한 분석을 2~3문장으로 제공해 주세요. 
      특히 선택한 기분과 카메라로 감지한 표정이 다를 경우, 이 불일치가 가지는 의미에 대해 언급해 주세요.
      의학적 조언이나 진단이 아닌 참고용 정보임을 언급해주세요. 한국어로 응답해 주세요.
    `;

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content:
            '당신은 건강 데이터를 분석하여 간결하고 명확한 인사이트를 제공하는 전문가입니다. 의학 용어를 일반인이 이해하기 쉽게 설명해주세요.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || '분석을 제공할 수 없습니다.';
  } catch (error) {
    return '분석 중 오류가 발생했습니다. 다시 시도해 주세요.';
  }
}

/**
 * Generates practical mood management tips based on the user's current mood and, if available, the detected facial expression and their degree of alignment.
 *
 * If the user's selected mood and detected facial expression differ, the tips include an analysis of this mismatch and advice for managing emotional incongruence. If they match, the tips are tailored to the degree of alignment. The response is provided in Korean.
 *
 * @param mood - The user's self-reported mood state.
 * @param detectedMood - The mood state detected from the user's facial expression (optional).
 * @param moodMatchScore - The percentage indicating how closely the detected mood matches the user's reported mood (optional).
 * @returns Practical mood management tips in Korean, or an error message if the API key is missing or an error occurs.
 */
export async function getMoodManagementTips(
  mood: MoodState,
  detectedMood?: MoodState,
  moodMatchScore?: number
): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return 'API 키가 설정되지 않아 팁을 제공할 수 없습니다.';
    }

    // OpenAI에게 보낼 프롬프트 작성
    let prompt = `
      사용자의 현재 기분은 '${getMoodText(mood)}'입니다.
    `;

    // 카메라로 감지한 표정 정보가 있으면 추가
    if (detectedMood) {
      prompt += `
      카메라로 감지한 표정은 '${getMoodText(detectedMood)}'입니다.
      기분-표정 일치도: ${moodMatchScore !== undefined ? moodMatchScore + '%' : '정보 없음'}
      `;

      // 기분과 표정의 불일치가 있는 경우 더 자세한 분석을 요청
      if (mood !== detectedMood) {
        prompt += `
        사용자의 선택한 기분과 표정에 차이가 있습니다. 
        이런 불일치는 사용자가 내적으로 느끼는 감정(${getMoodText(
          mood
        )})과 외적으로 표현하는 감정(${getMoodText(
          detectedMood
        )})이 다르다는 것을 의미할 수 있습니다.
        
        이런 감정 불일치에 대해 분석하고, 이를 고려한 감정 관리 방법을 제안해주세요. 
        예를 들어:
        - 감정과 표현의 불일치가 발생하는 이유
        - 이러한 불일치가 장기적으로 정신 건강에 미칠 수 있는 영향
        - 내적 감정과 외적 표현을 조화롭게 맞추는 방법
        `;
      } else {
        prompt += `
        사용자의 선택한 기분과 표정이 일치합니다. 
        일치도는 ${moodMatchScore}%로, ${
          moodMatchScore && moodMatchScore > 70
            ? '매우 높은 일치도'
            : moodMatchScore && moodMatchScore > 40
              ? '보통 일치도'
              : '다소 낮은 일치도'
        }를 보입니다.
        이는 사용자의 내적 감정과 외적 표현이 ${
          moodMatchScore && moodMatchScore > 70
            ? '매우 조화롭게'
            : moodMatchScore && moodMatchScore > 40
              ? '어느 정도'
              : '그다지 조화롭지 않게'
        } 이루어지고 있음을 나타냅니다.
        `;
      }
    }

    prompt += `
      이 기분 상태와 ${
        detectedMood && mood !== detectedMood ? '표정과의 불일치를' : '감정 상태를'
      } 고려하여 감정 관리를 위한 실용적인 팁 2~3가지를 제공해주세요.
      한국어로 응답해 주세요.
    `;

    // OpenAI API 호출 (더 상세한 분석을 위해 GPT-4 사용)
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo', // 더 정교한 분석을 위해 GPT-4 모델 사용
      messages: [
        {
          role: 'system',
          content:
            '당신은 정신 건강 및 감정 분석 전문가입니다. 사용자의 기분과 표정 사이의 관계를 분석하고 실용적이고 즉시 실행 가능한 조언을 제공해 주세요. 감정 불일치의 심리적 의미를 설명하고 이에 대처하는 방법도 함께 안내해 주세요.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300, // 더 긴 응답 허용
    });

    return response.choices[0].message.content || '팁을 제공할 수 없습니다.';
  } catch (error) {
    return '팁을 가져오는 중 오류가 발생했습니다.';
  }
}

/**
 * Generates a digital caricature image of the user using DALL·E 3, styled according to the specified mood.
 *
 * The function takes a base64-encoded user image, applies a mood-based stylistic prompt, and requests DALL·E 3 to create an upper-body caricature with exaggerated but recognizable features. Returns the URL of the generated image or null if unsuccessful.
 *
 * @param imageBase64 - The user's image encoded in base64 format.
 * @param mood - The mood state to influence the caricature's style. Defaults to 'neutral'.
 * @param userName - The user's name for personalized prompt context. Defaults to '사용자'.
 * @returns The URL of the generated caricature image, or null if generation fails.
 *
 * @remark Returns null if the OpenAI API key is missing or if the image URL cannot be retrieved from the response.
 */
export async function generateCaricatureWithDALLE(
  imageBase64: string,
  mood: MoodState = 'neutral',
  userName: string = '사용자'
): Promise<string | null> {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error('OpenAI API 키가 설정되지 않았습니다.');
      return null;
    }

    // 기분에 따른 스타일 설명 추가
    let moodDescription = '';
    switch (mood) {
      case 'happy':
        moodDescription = '행복하고 긍정적인 분위기의 밝은 색조와 활기찬';
        break;
      case 'sad':
        moodDescription = '감성적이고 조금 쓸쓸한 느낌의 차분한';
        break;
      case 'stressed':
        moodDescription = '긴장감이 느껴지는 역동적인';
        break;
      case 'relaxed':
        moodDescription = '편안하고 여유로운 파스텔 톤의';
        break;
      default:
        moodDescription = '균형잡힌 자연스러운';
    }

    // 캐리커처 생성 요청
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `다음 사진에 기반하여 ${moodDescription} 디지털 캐리커처 스타일로 재해석해주세요. 
              인물의 특징적인 얼굴 생김새는 유지하되 약간 과장되고 캐릭터화된 귀여운 스타일로 그려주세요. 
              밝고 깨끗한 배경에 머리부터 어깨까지 보이는 상반신 캐리커처로 만들어주세요. 
              ${userName}님의 특징을 살린 매력적인 캐리커처를 만들어주세요.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      user: `user_${Date.now()}`,
    });

    if (response && response.data && response.data.length > 0) {
      const imageUrl = response.data[0].url;
      if (imageUrl) {
        return imageUrl;
      }
    }

    console.error('DALL-E 응답에서 이미지 URL을 찾을 수 없습니다.');
    return null;
  } catch (error) {
    console.error('캐리커처 생성 중 오류:', error);
    return null;
  }
}

/**
 * Returns the Korean descriptive text for a given mood state.
 *
 * @param mood - The mood state to convert.
 * @returns The corresponding Korean description for the mood, or '알 수 없음' if the mood is undefined or unrecognized.
 */
function getMoodText(mood?: MoodState): string {
  switch (mood) {
    case 'happy':
      return '행복함';
    case 'sad':
      return '우울함';
    case 'stressed':
      return '스트레스';
    case 'relaxed':
      return '편안함';
    case 'neutral':
      return '보통';
    default:
      return '알 수 없음';
  }
}
