import { NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Returns a JSON response with a randomly selected fallback caricature image URL based on the specified mood.
 *
 * If the provided mood is not recognized, a neutral caricature image is used.
 *
 * @param mood - The mood category for selecting a caricature image. Defaults to 'neutral'.
 * @returns A JSON response containing the caricature image URL and flags indicating it is a fallback and not AI-generated.
 */
function useFallbackCaricature(mood: string = 'neutral') {
  // 기분에 따른 다양한 미리 준비된 캐리커처 이미지
  const caricatureStyles: Record<string, string[]> = {
    happy: [
      'https://img.freepik.com/premium-vector/business-man-cartoon-character-happy-businessman-avatar_29190-5408.jpg',
      'https://img.freepik.com/premium-vector/cartoon-happy-businessman-showing-thumbs-up_29190-4954.jpg',
    ],
    sad: [
      'https://img.freepik.com/premium-vector/business-man-cartoon-character-sad-businessman-avatar_29190-5413.jpg',
      'https://img.freepik.com/premium-vector/business-man-cartoon-character-sad-depressed-employee-office-worker-vector-illustration_53562-15111.jpg',
    ],
    stressed: [
      'https://img.freepik.com/premium-vector/stressed-businessman-working-office-employee-with-nervous-face-busy-person-cartoon-character-vector-illustration_53562-15772.jpg',
      'https://img.freepik.com/premium-vector/stressed-business-man-cartoon-character_24908-61564.jpg',
    ],
    relaxed: [
      'https://img.freepik.com/premium-vector/business-man-cartoon-character-relaxed-businessman-avatar_29190-5410.jpg',
      'https://img.freepik.com/premium-vector/business-man-cartoon-character_24908-58909.jpg',
    ],
    neutral: [
      'https://img.freepik.com/premium-vector/business-man-cartoon-character_24908-61578.jpg',
      'https://cdn1.vectorstock.com/i/1000x1000/72/15/cartoon-character-young-happy-businessman-vector-9377215.jpg',
    ],
  };

  // 기분에 맞는 이미지 배열 가져오기 (해당 기분이 없으면 neutral 사용)
  const images = caricatureStyles[mood] || caricatureStyles.neutral;

  // 랜덤하게 이미지 선택
  const randomIndex = Math.floor(Math.random() * images.length);
  const caricatureUrl = images[randomIndex];

  // 폴백 이미지 URL 반환
  return NextResponse.json({
    caricatureUrl,
    success: true,
    isAiGenerated: false,
    isFallback: true,
  });
}

/**
 * Handles POST requests to generate a mood-based caricature image from an uploaded photo.
 *
 * Extracts the image file, mood, and user name from the form data. If the OpenAI API key is available, generates a caricature using DALL-E 3 with a prompt tailored to the specified mood and user name. If the API key is missing, the image generation fails, or the response is invalid, returns a fallback caricature image matching the mood.
 *
 * The response JSON includes the caricature image URL, a success flag, and an indicator of whether the image was AI-generated.
 *
 * @returns A JSON response containing the caricature image URL and status flags.
 */
export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const image = data.get('image') as File;
    const mood = (data.get('mood') as string) || 'neutral';
    const userName = (data.get('userName') as string) || '사용자';

    if (!image) {
      console.error('이미지 파일이 없음');
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.', success: false },
        { status: 400 }
      );
    }

    // API 키 확인
    const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않음');
      console.warn('폴백 캐리커처 사용');
      return useFallbackCaricature(mood);
    }

    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({ apiKey });

    // 기분에 따른 스타일과 색상 설명 추가
    let moodStyle = {
      description: '균형 잡힌',
      colors: '자연스러운 색상',
      expression: '자연스러운 표정',
      background: '깨끗한 중성 색상',
    };

    switch (mood) {
      case 'happy':
        moodStyle = {
          description: '행복하고 긍정적인',
          colors: '밝은 색조와 따뜻한 톤',
          expression: '미소를 짓고 활기찬 표정',
          background: '밝고 활기찬 색상',
        };
        break;
      case 'sad':
        moodStyle = {
          description: '감성적이고 조금 쓸쓸한',
          colors: '부드러운 블루톤과 차분한 색상',
          expression: '약간 쓸쓸하면서도 감성적인 표정',
          background: '차분한 블루 또는 회색 톤',
        };
        break;
      case 'stressed':
        moodStyle = {
          description: '긴장감이 느껴지는',
          colors: '강한 대비와 선명한 색상',
          expression: '약간 긴장된 표정이지만 유머러스한 방식으로',
          background: '활기차고 에너지 있는 배경',
        };
        break;
      case 'relaxed':
        moodStyle = {
          description: '편안하고 여유로운',
          colors: '부드러운 파스텔 톤',
          expression: '편안하고 여유로운 미소',
          background: '차분하고 편안한 색상',
        };
        break;
    }

    try {
      // DALL-E를 사용하여 캐리커처 생성 (개선된 프롬프트)
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: `다음 사진을 기반으로 ${moodStyle.description} 디지털 캐리커처 일러스트를 만들어주세요.
                캐릭터의 특징:
                - 인물의 특징적인 얼굴 생김새를 유지하되 약간 과장되고 캐릭터화
                - ${moodStyle.colors}를 사용하여 생동감 있게 표현
                - ${moodStyle.expression}을 가진 귀여운 캐릭터 스타일
                - 머리부터 어깨까지 보이는 상반신 구도
                - ${moodStyle.background} 위에 캐릭터가 돋보이게 배치
                - ${userName}님의 특징을 살린 매력적이고 친근한 일러스트 스타일
                - 밝고 선명하며 고품질의 디지털 아트 느낌으로 완성해주세요.`,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        user: `user_${Date.now()}`,
      });

      if (!response.data || response.data.length === 0) {
        console.warn('DALL-E로 이미지 생성 실패, 폴백 이미지 사용');
        return useFallbackCaricature(mood);
      }

      const caricatureUrl = response.data[0].url;
      if (!caricatureUrl) {
        console.warn('DALL-E 응답에서 이미지 URL을 찾을 수 없음, 폴백 이미지 사용');
        return useFallbackCaricature(mood);
      }

      // 생성된 이미지 URL을 반환
      return NextResponse.json({
        caricatureUrl,
        success: true,
        isAiGenerated: true,
      });
    } catch (error: any) {
      console.error('캐리커처 생성 오류:', error);
      // 어떤 오류가 발생해도 최종적으로 폴백 이미지를 제공
      try {
        console.warn('오류로 인한 폴백 캐리커처 사용');
        return useFallbackCaricature(mood || 'neutral');
      } catch (fallbackError) {
        // 폴백마저 실패하면 에러 응답
        console.error('폴백 캐리커처도 실패:', fallbackError);
        return NextResponse.json(
          {
            error: error.message || '캐리커처 생성 중 오류가 발생했습니다.',
            success: false,
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('캐리커처 생성 중 오류 발생:', error);
    return NextResponse.json(
      { error: '캐리커처 생성 중 오류가 발생했습니다.', success: false },
      { status: 500 }
    );
  }
}
