'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Camera, Pause, Play } from 'lucide-react';
import { memo } from 'react';

type CameraUIProps = {
  cameraActive: boolean;
  status: 'idle' | 'countdown' | 'recording' | 'processing';
  cameraError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  actualCanvasRef: React.RefObject<HTMLCanvasElement>;
  faceCanvasRef: React.RefObject<HTMLCanvasElement>;
  countdown: number;
  processText: string;
  progress: number;
  remainingTime: number;
  isMobile: boolean;
  frameCount: number;
  statusMessage: string;
  showQualityAlert: boolean;
  temperature: number | null; // 측정된 온도 값 추가
  onResetClick: () => void;
  onStartClick: () => void;
  setCameraError: (error: string | null) => void;
  startCamera: () => void;
  className?: string;
};

/**
 * 카메라 UI 컴포넌트
 * 카메라 화면과 컨트롤 버튼을 포함하는 UI 렌더링 담당
 */
export const CameraUI = memo(
  ({
    cameraActive,
    status,
    cameraError,
    videoRef,
    actualCanvasRef,
    faceCanvasRef,
    countdown,
    processText,
    progress,
    remainingTime,
    isMobile,
    frameCount,
    statusMessage,
    showQualityAlert,
    temperature,
    onResetClick,
    onStartClick,
    setCameraError,
    startCamera,
    className = '',
  }: CameraUIProps) => {
    // 버튼 텍스트 설정
    const getButtonText = () => {
      switch (status) {
        case 'recording':
          return (
            <>
              <Pause className="h-4 w-4 mr-2" />
              측정 중단
            </>
          );
        case 'countdown':
        case 'processing':
          return (
            <>
              <Play className="h-4 w-4 mr-2" />
              측정 시작
            </>
          );
        default:
          return (
            <>
              <Play className="h-4 w-4 mr-2" />
              측정 시작
            </>
          );
      }
    };

    // 버튼 비활성화 조건
    const isButtonDisabled = status === 'countdown' || status === 'processing';

    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative aspect-video bg-black rounded-md overflow-hidden">
            {/* 비디오 및 캔버스 */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!cameraActive && 'hidden'}`}
            />
            <canvas
              ref={actualCanvasRef}
              className="absolute top-0 left-0 w-full h-full opacity-0"
            />
            <canvas ref={faceCanvasRef} className="absolute top-0 left-0 w-full h-full" />

            {/* 카메라 비활성화 시 검은 화면 */}
            {!cameraActive && <div className="absolute inset-0 bg-black"></div>}

            {/* 카메라 오류 표시 */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-white text-center p-4">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                  <h3 className="text-lg font-bold mb-2">카메라 오류</h3>
                  <p className="text-sm">{cameraError}</p>
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={() => {
                      setCameraError(null);
                      startCamera();
                    }}
                  >
                    다시 시도
                  </Button>
                </div>
              </div>
            )}

            {/* 카운트다운 오버레이 */}
            {status === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-white text-center">
                  <div className="text-6xl font-bold mb-2">{countdown}</div>
                  <p className="text-xl">측정 준비...</p>
                </div>
              </div>
            )}

            {/* 처리 중 오버레이 */}
            {status === 'processing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
                  <p>{processText}</p>
                </div>
              </div>
            )}

            {/* 진행 상태 표시 */}
            {status === 'recording' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                <div
                  className="h-full bg-red-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* 녹화 시간 표시 */}
            {status === 'recording' && (
              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full">
                <span className="font-mono">{remainingTime}초</span>
              </div>
            )}

            {/* 녹화 중 표시 */}
            {status === 'recording' && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 text-white px-3 py-1 rounded-full">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span>측정 중</span>
              </div>
            )}

            {/* 온도 표시 (실시간) */}
            {status === 'recording' && temperature !== null && (
              <div className="absolute top-16 left-4 flex items-center gap-2 bg-black/70 text-white px-3 py-1 rounded-full">
                <span className="font-mono">체온: {temperature}°C</span>
              </div>
            )}
          </div>

          {/* 품질 알림 */}
          {showQualityAlert && status === 'recording' && (
            <Alert variant="default" className="mt-2 bg-amber-50 border-amber-300">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700">측정 품질 낮음</AlertTitle>
              <AlertDescription className="text-amber-600">
                얼굴이 잘 보이도록 조명을 밝게 하고 카메라 위치를 조정하세요.
              </AlertDescription>
            </Alert>
          )}

          {/* Baxe AI 분석 상세지표 */}
          {temperature !== null && (
            <div className="mt-2 p-3 rounded-md border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50">
              <h3 className="font-bold text-blue-800 mb-2 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1 text-blue-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16a1 1 0 11-2 0V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Baxe AI 분석 상세지표
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm transition-all hover:shadow">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-gray-600">체온</p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                      ${temperature > 37.5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                    >
                      {temperature > 37.5 ? '높음' : '정상'}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <p className="text-2xl font-bold text-blue-700">{temperature}</p>
                    <p className="text-lg font-medium text-blue-500 ml-1">°C</p>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${temperature > 37.5 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(((temperature - 36) / 2.5) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                {/* 추가 지표를 위한 칸 */}
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-gray-600">심박수</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      대기중
                    </span>
                  </div>
                  <div className="flex items-end">
                    <p className="text-2xl font-bold text-blue-700">-</p>
                    <p className="text-lg font-medium text-blue-500 ml-1">BPM</p>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-gray-300" style={{ width: '10%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              <p className="font-medium">{statusMessage}</p>
              <p className="text-muted-foreground">
                {frameCount > 0 ? `캡처된 프레임: ${frameCount}` : ''}
                {isMobile && ' (모바일 모드)'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onResetClick}
                disabled={isButtonDisabled || status === 'recording'}
              >
                <Camera className="h-4 w-4 mr-2" />
                재설정
              </Button>

              <Button
                onClick={onStartClick}
                size="sm"
                variant={status === 'recording' ? 'destructive' : 'default'}
                disabled={isButtonDisabled || !!cameraError}
              >
                {getButtonText()}
              </Button>
            </div>
          </div>

          {/* 모바일 사용자를 위한 추가 팁 */}
          {isMobile && (
            <Alert variant="default" className="mt-2 bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">모바일 사용 팁</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>휴대폰을 고정된 위치에 두세요</li>
                  <li>가능한 밝은 조명 환경에서 측정하세요</li>
                  <li>측정 중 화면 방향을 바꾸지 마세요</li>
                  <li>다른 앱으로 전환하지 말고 측정에 집중하세요</li>
                  <li>배터리 절약 모드를 끄고 측정하세요</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }
);

CameraUI.displayName = 'CameraUI';
