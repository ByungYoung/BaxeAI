import { translateText } from '@/lib/google-translate';
import { NextResponse } from 'next/server';

// Next.js 15 App Router API Route
export const dynamic = 'force-dynamic'; // 라우팅 처리 명시적 선언

export async function POST(request: Request) {
  try {
    const { text, targetLanguage, sourceLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: 'Text and target language are required' }, { status: 400 });
    }

    const translatedText = await translateText(text, targetLanguage, sourceLanguage);

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to translate text' },
      { status: 500 }
    );
  }
}
