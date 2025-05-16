'use client';

import { FaceMeasurementCamera } from '@/components/camera/face-measurement-camera';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { processWithPyVHR } from '@/lib/api-client';
import {
  calculateMoodMatchScore,
  detectExpression,
  inferMoodFromExpression,
  loadFaceDetectionModels,
} from '@/lib/face-detection';
import { useAppStore } from '@/lib/store';
import { MoodState } from '@/lib/types';
import { AlertCircle, ArrowLeft, Frown, Meh, Smile } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function MeasurePage() {
  const router = useRouter();
  const { userInfo, setCurrentResult } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodState>('neutral');
  const [isReady, setIsReady] = useState(false);
  const [detectedMood, setDetectedMood] = useState<MoodState | null>(null);
  const [moodMatchScore, setMoodMatchScore] = useState<number | null>(null);
  const [isAnalyzingExpression, setIsAnalyzingExpression] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const expressionAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null); // 얼굴 마스킹을 위한 캔버스 참조
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // 사용자 정보가 없으면 등록 페이지로 리디렉션
  useEffect(() => {
    if (!userInfo) {
      router.push('/register');
    } else {
      // 페이지 로드 후 카메라가 초기화될 시간을 주기 위해 준비 상태를 약간 지연
      setTimeout(() => {
        setIsReady(true);
      }, 1000);

      // 얼굴 인식 모델 로드
      const loadModels = async () => {
        try {
          await loadFaceDetectionModels();
          setModelsLoaded(true);
        } catch (err) {
          console.error('얼굴 인식 모델 로드 실패:', err);
        }
      };

      loadModels();
    }

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => {
      if (expressionAnalysisIntervalRef.current) {
        clearInterval(expressionAnalysisIntervalRef.current);
      }
    };
  }, [userInfo, router]);

  // 표정 분석 시작
  const startExpressionAnalysis = () => {
    if (!videoRef.current || !modelsLoaded) return;

    setIsAnalyzingExpression(true);

    // 2초마다 표정 분석 수행
    expressionAnalysisIntervalRef.current = setInterval(async () => {
      if (videoRef.current && faceCanvasRef.current) {
        try {
          const detection = await detectExpression(videoRef.current);

          if (detection) {
            const detectedMood = inferMoodFromExpression(detection.expressions);
            const matchScore = calculateMoodMatchScore(detection.expressions, selectedMood);

            setDetectedMood(detectedMood);
            setMoodMatchScore(matchScore);

            // 캔버스에 얼굴 마스킹 그리기
            const drawMoodMask = (
              canvas: HTMLCanvasElement,
              detection: any,
              mood: MoodState
            ): void => {
              if (!detection || !canvas) return;

              const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
              ctx.fillStyle = getMoodColor(detectedMood);
              ctx.fillRect(box.x, box.y, box.width, box.height);

              // 얼굴 주변에 테두리 그리기
              ctx.strokeStyle = getMoodColor(detectedMood).replace('0.5', '0.8');
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // 이모티콘 표시 (얼굴 위쪽)
              ctx.font = `${Math.round(box.width / 2)}px Arial`;
              ctx.fillText(getMoodEmoji(detectedMood), box.x + box.width / 4, box.y - 10);

              // 인식된 감정 텍스트 표시
              ctx.font = '16px Arial';
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 3;
              const getMoodText = (mood: MoodState): string => {
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
              };
              const moodText = getMoodText(detectedMood);
              ctx.strokeText(moodText, box.x, box.y + box.height + 20);
              ctx.fillText(moodText, box.x, box.y + box.height + 20);
            };

            // 마스킹 캔버스 크기 설정
            faceCanvasRef.current.width = videoRef.current.videoWidth;
            faceCanvasRef.current.height = videoRef.current.videoHeight;

            // 마스크 그리기
            drawMoodMask(faceCanvasRef.current, detection, detectedMood);
          }
        } catch (err) {
          console.error('표정 분석 오류:', err);
        }
      }
    }, 2000);
  };

  // 선택한 기분 변경 시 일치도도 업데이트
  useEffect(() => {
    if (isAnalyzingExpression && videoRef.current) {
      const updateMoodMatch = async () => {
        try {
          const detection = await detectExpression(videoRef.current!);

          if (detection) {
            const matchScore = calculateMoodMatchScore(detection.expressions, selectedMood);
            setMoodMatchScore(matchScore);
          }
        } catch (err) {
          console.error('기분 일치도 업데이트 오류:', err);
        }
      };

      updateMoodMatch();
    }
  }, [selectedMood, isAnalyzingExpression]);

  // 프레임 처리 함수
  const handleFramesCapture = async (frames: string[]) => {
    try {
      setIsProcessing(true);
      setError(null);

      if (frames.length < 10) {
        throw new Error(
          '충분한 프레임이 캡처되지 않았습니다. 더 밝은 환경에서 다시 시도해 주세요.'
        );
      }

      // 서버에 프레임 전송 및 처리 요청
      const result = await processWithPyVHR(frames);

      if (!result || !result.heartRate) {
        throw new Error(
          '측정 데이터를 분석할 수 없습니다. 더 밝은 조명 환경에서 다시 시도해 주세요.'
        );
      }

      // 온도 측정 (예: 체온을 시뮬레이션, 실제로는 온도 센서 데이터를 사용)
      const randomTemp = 36.5 + (Math.random() * 1.0 - 0.5); // 36.0°C ~ 37.0°C 범위의 체온
      const temperature = parseFloat(randomTemp.toFixed(1));

      // 상태 저장 (기분 상태 및 온도 포함)
      setCurrentResult(
        result.heartRate,
        result.confidence,
        result.hrv,
        selectedMood,
        detectedMood || undefined,
        moodMatchScore !== null ? moodMatchScore : undefined,
        temperature
      );

      // 결과 페이지로 이동
      router.push('/results');
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || '측정 데이터 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getMoodIcon = (mood: MoodState) => {
    switch (mood) {
      case 'happy':
        return <Smile className="h-5 w-5 text-green-500" />;
      case 'sad':
        return <Frown className="h-5 w-5 text-blue-500" />;
      case 'stressed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'relaxed':
        return <Smile className="h-5 w-5 text-teal-500" />;
      default:
        return <Meh className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!userInfo) {
    return null; // 리디렉션 중이므로 아무것도 렌더링하지 않음
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Button variant="outline" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" /> 뒤로가기
      </Button>

      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>Baxe AI</CardTitle>
          <CardDescription>
            Advanced Non-Contact Biomarker & Mental Wellness Scanner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isReady && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>카메라 초기화 중...</AlertTitle>
              <AlertDescription>
                카메라와 측정 시스템을 준비하고 있습니다. 잠시만 기다려주세요.
              </AlertDescription>
            </Alert>
          )}

          {!modelsLoaded && isReady && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>표정 인식 모델 로딩 중...</AlertTitle>
              <AlertDescription>
                표정 인식을 위한 AI 모델을 불러오는 중입니다. 잠시만 기다려주세요.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* 기분 선택 UI */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-center">현재 기분 상태를 선택하세요</h3>
              <RadioGroup
                value={selectedMood}
                onValueChange={value => setSelectedMood(value as MoodState)}
                className="grid grid-cols-2 md:grid-cols-5 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="happy" id="mood-happy" />
                  <Label htmlFor="mood-happy" className="flex items-center gap-2 cursor-pointer">
                    <Smile className="h-5 w-5 text-green-500" />
                    <span>행복함</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="neutral" id="mood-neutral" />
                  <Label htmlFor="mood-neutral" className="flex items-center gap-2 cursor-pointer">
                    <Meh className="h-5 w-5 text-gray-500" />
                    <span>보통</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sad" id="mood-sad" />
                  <Label htmlFor="mood-sad" className="flex items-center gap-2 cursor-pointer">
                    <Frown className="h-5 w-5 text-blue-500" />
                    <span>우울함</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="stressed" id="mood-stressed" />
                  <Label htmlFor="mood-stressed" className="flex items-center gap-2 cursor-pointer">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span>스트레스</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="relaxed" id="mood-relaxed" />
                  <Label htmlFor="mood-relaxed" className="flex items-center gap-2 cursor-pointer">
                    <Smile className="h-5 w-5 text-teal-500" />
                    <span>편안함</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* 표정 분석 결과 */}
              {isAnalyzingExpression && detectedMood && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium mb-2">표정 분석 결과</h4>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">감지된 표정:</span>
                    <span className="flex items-center gap-1 font-medium">
                      {getMoodIcon(detectedMood)}
                      {detectedMood === 'happy'
                        ? '행복함'
                        : detectedMood === 'sad'
                          ? '우울함'
                          : detectedMood === 'stressed'
                            ? '스트레스'
                            : detectedMood === 'relaxed'
                              ? '편안함'
                              : '보통'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>선택한 기분과 일치도:</span>
                      <span className="font-medium">{moodMatchScore || 0}%</span>
                    </div>
                    <Progress value={moodMatchScore || 0} className="h-2" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden relative">
              <FaceMeasurementCamera
                onFramesCapture={handleFramesCapture}
                isProcessing={isProcessing}
                processText="측정 데이터를 분석 중입니다..."
                measurementTime={30} // 30초 측정
                className="w-full"
                videoRef={videoRef}
              />

              {modelsLoaded && !isAnalyzingExpression && (
                <div className="p-3">
                  <Button
                    onClick={startExpressionAnalysis}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    표정 분석 시작
                  </Button>
                </div>
              )}
              <canvas
                ref={faceCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">측정 안내</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside text-left mx-auto space-y-1 max-w-lg">
                <li className="font-medium text-amber-600 dark:text-amber-400">
                  측정 성공률을 높이기 위한 중요 팁!
                </li>
                <li>밝은 자연광이 있는 환경에서 측정하세요 (창가 추천)</li>
                <li>형광등이나 깜빡이는 조명은 피하세요</li>
                <li>얼굴과 카메라 사이 거리는 30-50cm가 적당합니다</li>
                <li>측정 중에는 움직임을 최소화하고 편안한 자세를 유지하세요</li>
                <li>얼굴 전체가 화면에 잘 보이도록 카메라를 조정하세요</li>
                <li>30초간 측정이 진행됩니다</li>
                <li>측정이 완료되면 자동으로 결과 페이지로 이동합니다</li>
                <li className="font-medium text-amber-600 dark:text-amber-400">
                  얼굴이 감지되지 않아도 측정이 가능합니다. 단, 정확도가 떨어질 수 있으니 가능하면
                  얼굴이 잘 보이게 해주세요.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
