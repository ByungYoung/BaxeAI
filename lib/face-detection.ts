// Face-API.js를 사용한 표정 인식 유틸리티
import * as faceapi from 'face-api.js';
import { MoodState } from './types';

// 모델 로드 상태
let modelsLoaded = false;

// 모델 로드 함수
export const loadFaceDetectionModels = async () => {
  if (modelsLoaded) return;

  try {
    // CDN에서 모델 로드
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

    // Promise.all을 사용하여 필요한 모든 모델을 한 번에 로드
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    return true;
  } catch (error) {
    return false;
  }
};

// 이미지에서 표정 감지
export const detectExpression = async (
  imageElement: HTMLImageElement | HTMLVideoElement
): Promise<faceapi.WithFaceExpressions<
  faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>
> | null> => {
  if (!modelsLoaded) {
    const loaded = await loadFaceDetectionModels();
    if (!loaded) return null;
  }

  try {
    // 얼굴 감지 및 표정 인식 실행
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    return detection || null;
  } catch (error) {
    return null;
  }
};

// 표정과 사용자 선택 기분 간의 일치도 계산
export const calculateMoodMatchScore = (
  expressions: faceapi.FaceExpressions | undefined,
  selectedMood: MoodState
): number => {
  if (!expressions) return 0;

  // 각 표정 데이터와 기분 상태 매핑
  const moodExpressionMap: Record<MoodState, string[]> = {
    happy: ['happy'],
    sad: ['sad'],
    stressed: ['angry', 'fearful', 'disgusted'],
    relaxed: ['neutral'],
    neutral: ['neutral'],
    unknown: ['neutral'],
  };

  // 선택한 기분에 해당하는 표정들
  const matchingExpressions = moodExpressionMap[selectedMood] || [];

  // 일치하는 표정들의 확률값 합
  let matchScore = 0;

  for (const expr of matchingExpressions) {
    const key = expr as keyof faceapi.FaceExpressions;
    const value = expressions[key];
    if (value !== undefined && typeof value === 'number') {
      matchScore += value;
    }
  }

  // 0~100% 스케일로 변환
  return Math.round(matchScore * 100);
};

// 감지된 표정의 최상위 감정 유추
export const inferMoodFromExpression = (
  expressions: faceapi.FaceExpressions | undefined
): MoodState => {
  if (!expressions) return 'unknown';

  // 가장 높은 확률의 표정 찾기
  let topExpression = '';
  let topScore = 0;

  for (const [expression, score] of Object.entries(expressions)) {
    if (score > topScore) {
      topScore = score;
      topExpression = expression;
    }
  }

  // face-api 표정을 MoodState로 매핑
  switch (topExpression) {
    case 'happy':
      return 'happy';
    case 'sad':
      return 'sad';
    case 'angry':
    case 'fearful':
    case 'disgusted':
      return 'stressed';
    case 'surprised':
      return 'neutral'; // 놀람은 중립에 가깝게 처리
    case 'neutral':
    default:
      return 'neutral';
  }
};

// 얼굴 마스킹 함수 추가: 감지된 얼굴에 감정에 따른 마스크 오버레이
export const drawMoodMask = (
  canvas: HTMLCanvasElement,
  detection: faceapi.WithFaceExpressions<
    faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>
  > | null,
  mood: MoodState
): void => {
  if (!detection || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 캔버스 초기화
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 얼굴 감지 결과에서 박스 위치 가져오기
  const { box } = detection.detection;

  // 기분별 색상 설정
  const getMoodColor = (mood: MoodState): string => {
    switch (mood) {
      case 'happy':
        return 'rgba(76, 175, 80, 0.5)'; // 녹색 반투명
      case 'sad':
        return 'rgba(33, 150, 243, 0.5)'; // 파란색 반투명
      case 'stressed':
        return 'rgba(244, 67, 54, 0.5)'; // 빨간색 반투명
      case 'relaxed':
        return 'rgba(156, 39, 176, 0.5)'; // 보라색 반투명
      case 'neutral':
      default:
        return 'rgba(158, 158, 158, 0.5)'; // 회색 반투명
    }
  };

  // 기분별 이모티콘 얻기
  const getMoodEmoji = (mood: MoodState): string => {
    switch (mood) {
      case 'happy':
        return '😊';
      case 'sad':
        return '😢';
      case 'stressed':
        return '😠';
      case 'relaxed':
        return '😌';
      case 'neutral':
      default:
        return '😐';
    }
  };

  // 얼굴 위에 반투명 컬러 오버레이 그리기
  ctx.fillStyle = getMoodColor(mood);
  ctx.fillRect(box.x, box.y, box.width, box.height);

  // 얼굴 주변에 테두리 그리기
  ctx.strokeStyle = getMoodColor(mood).replace('0.5', '0.8');
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  // 이모티콘 표시 (얼굴 위쪽)
  ctx.font = `${Math.round(box.width / 2)}px Arial`;
  ctx.fillText(getMoodEmoji(mood), box.x + box.width / 4, box.y - 10);

  // 인식된 감정 텍스트 표시
  ctx.font = '16px Arial';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  const moodText = getMoodText(mood);
  ctx.strokeText(moodText, box.x, box.y + box.height + 20);
  ctx.fillText(moodText, box.x, box.y + box.height + 20);
};

// 도우미 함수: 기분 상태 텍스트 반환
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
