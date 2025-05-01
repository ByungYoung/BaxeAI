"use client";

import { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Smile, Frown, Meh, AlertCircle, Camera } from "lucide-react";
import { MoodState } from "@/lib/types";
import { toast } from "@/components/ui/use-toast";
import { analyzeHealthStatus, getMoodManagementTips } from "@/lib/openai-client";
import { loadFaceDetectionModels, detectExpression, drawMoodMask } from "@/lib/face-detection";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResultsPage() {
  const router = useRouter();
  const { currentResult, addToHistory } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [healthAnalysis, setHealthAnalysis] = useState<string | null>(null);
  const [moodTips, setMoodTips] = useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isMoodTipsLoading, setIsMoodTipsLoading] = useState(false);
  const [showFaceMask, setShowFaceMask] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentDetection = useRef<any>(null);

  useEffect(() => {
    const loadModels = async () => {
      const loaded = await loadFaceDetectionModels();
      setModelsLoaded(loaded);
    };

    if (currentResult) {
      loadModels();
    }
  }, [currentResult]);

  useEffect(() => {
    if (currentResult && !healthAnalysis) {
      setIsAnalysisLoading(true);
      analyzeHealthStatus(currentResult)
        .then((analysis) => {
          setHealthAnalysis(analysis);
        })
        .catch((error) => {
          console.error("건강 분석 오류:", error);
          setHealthAnalysis("분석을 가져오는 중 오류가 발생했습니다.");
        })
        .finally(() => {
          setIsAnalysisLoading(false);
        });
    }

    if (currentResult?.mood && !moodTips) {
      setIsMoodTipsLoading(true);
      getMoodManagementTips(currentResult.mood)
        .then((tips) => {
          setMoodTips(tips);
        })
        .catch((error) => {
          console.error("팁 가져오기 오류:", error);
          setMoodTips("팁을 가져오는 중 오류가 발생했습니다.");
        })
        .finally(() => {
          setIsMoodTipsLoading(false);
        });
    }
  }, [currentResult, healthAnalysis, moodTips]);

  const startFaceMasking = async () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current || !currentResult?.mood) {
      toast({
        title: "표정 인식 준비 중",
        description: "표정 인식 모델을 로드 중입니다. 잠시 후 다시 시도하세요.",
      });
      return;
    }

    setShowFaceMask(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;

        const intervalId = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;

          try {
            const detection = await detectExpression(videoRef.current);
            currentDetection.current = detection;

            if (detection && canvasRef.current && currentResult.mood) {
              drawMoodMask(
                canvasRef.current,
                detection as any,
                currentResult.detectedMood || currentResult.mood
              );
            }
          } catch (err) {
            console.error("표정 감지 오류:", err);
          }
        }, 200);

        return () => {
          clearInterval(intervalId);
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
        };
      }
    } catch (err) {
      console.error("카메라 접근 오류:", err);
      toast({
        title: "카메라 오류",
        description: "카메라에 접근할 수 없습니다. 권한을 확인해주세요.",
        variant: "destructive",
      });
      setShowFaceMask(false);
    }
  };

  const stopFaceMasking = () => {
    setShowFaceMask(false);

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleSaveResult = async () => {
    setIsSaving(true);

    try {
      addToHistory();

      const userData = currentResult?.userInfo || {
        id: "",
        email: "",
        name: "",
        company: "",
      };

      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userData.id,
          userEmail: userData.email,
          userName: userData.name,
          userCompany: userData.company,
          heartRate: currentResult?.heartRate,
          confidence: currentResult?.confidence,
          rmssd: currentResult?.hrv?.rmssd,
          sdnn: currentResult?.hrv?.sdnn,
          lf: currentResult?.hrv?.lf,
          hf: currentResult?.hrv?.hf,
          lfHfRatio: currentResult?.hrv?.lfHfRatio,
          pnn50: currentResult?.hrv?.pnn50,
          mood: currentResult?.mood,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "측정 결과를 저장하는 데 실패했습니다."
        );
      }

      toast({
        title: "저장 완료",
        description: "측정 결과가 성공적으로 저장되었습니다.",
      });

      router.push("/history");
    } catch (error) {
      console.error("결과 저장 중 오류:", error);
      toast({
        title: "저장 오류",
        description:
          error instanceof Error
            ? error.message
            : "측정 결과를 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMeasureAgain = () => {
    router.push("/measure");
  };

  const getMoodIcon = (mood?: MoodState) => {
    switch (mood) {
      case "happy":
        return <Smile className="h-5 w-5 text-green-500" />;
      case "sad":
        return <Frown className="h-5 w-5 text-blue-500" />;
      case "stressed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "relaxed":
        return <Smile className="h-5 w-5 text-teal-500" />;
      default:
        return <Meh className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMoodText = (mood?: MoodState): string => {
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
  };

  if (!currentResult) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">측정 결과가 없습니다</h1>
        <p className="text-gray-600 mb-6">먼저 심박수를 측정해주세요</p>
        <Button onClick={() => router.push("/measure")}>측정하러 가기</Button>
      </div>
    );
  }

  const stressLevel =
    currentResult.hrv && currentResult.hrv.rmssd !== undefined
      ? calculateStressLevel(currentResult.hrv.rmssd)
      : "분석 불가";

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Baxe AI 측정 결과</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">측정시간</span>
                <span>
                  {formatDistanceToNow(new Date(currentResult.timestamp), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">사용자 이름</span>
                <span>{currentResult.userInfo.name || "이름없음"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">이메일</span>
                <span>{currentResult.userInfo.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">소속</span>
                <span>{currentResult.userInfo.company || "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>측정 결과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">심박수</span>
                <span>{currentResult.heartRate.toFixed(1)} BPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">스트레스 레벨</span>
                <span className={getStressLevelColor(stressLevel)}>
                  {getStressLevelText(stressLevel)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">기분 상태</span>
                <span className="flex items-center gap-2">
                  {getMoodIcon(currentResult.mood)}
                  {getMoodText(currentResult.mood)}
                </span>
              </div>

              {currentResult.detectedMood && (
                <>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-gray-500">감지된 표정</span>
                    <span className="flex items-center gap-2">
                      {getMoodIcon(currentResult.detectedMood)}
                      {getMoodText(currentResult.detectedMood)}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">
                        선택한 기분과 표정 일치도
                      </span>
                      <span className="font-medium">
                        {currentResult.moodMatchScore || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${currentResult.moodMatchScore || 0}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {currentResult.moodMatchScore &&
                      currentResult.moodMatchScore > 70
                        ? "매우 높은 일치도: 표정과 선택된 기분이 일치합니다."
                        : currentResult.moodMatchScore &&
                          currentResult.moodMatchScore > 40
                        ? "보통 일치도: 표정과 선택된 기분이 어느 정도 일치합니다."
                        : "낮은 일치도: 표정과 선택된 기분이 다르게 나타납니다."}
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-center mt-3">
                {!showFaceMask ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startFaceMasking}
                    className="w-full"
                    disabled={!modelsLoaded}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {modelsLoaded ? "표정 마스킹 보기" : "모델 로딩 중..."}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={stopFaceMasking}
                    className="w-full"
                  >
                    표정 마스킹 중지
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showFaceMask && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>표정 마스킹</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain z-10"
                  style={{ display: "none" }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain z-20"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {currentResult.detectedMood
                  ? `감지된 표정 '${getMoodText(
                      currentResult.detectedMood
                    )}'에 대한 마스킹입니다.`
                  : `선택한 기분 '${getMoodText(
                      currentResult.mood
                    )}'에 대한 마스킹입니다.`}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Baxe AI 건강 상태 분석</CardTitle>
          </CardHeader>
          <CardContent>
            {isAnalysisLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300">
                  {healthAnalysis}
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  ※ 본 분석은 참고용 정보이며, 의학적 진단을 대체하지 않습니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>감정 관리 추천</CardTitle>
          </CardHeader>
          <CardContent>
            {isMoodTipsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300">{moodTips}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {currentResult.hrv && (
        <>
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>자율신경계 균형</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">
                      LF (저주파)
                    </span>
                    <span className="text-blue-600 font-bold text-xl">
                      {currentResult.hrv.lf !== undefined
                        ? `${currentResult.hrv.lf.toFixed(2)} ms²`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">
                      HF (고주파)
                    </span>
                    <span className="text-green-600 font-bold text-xl">
                      {currentResult.hrv.hf !== undefined
                        ? `${currentResult.hrv.hf.toFixed(2)} ms²`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-500 font-medium">
                      LF/HF 비율
                    </span>
                    <span className="text-purple-600 font-bold text-xl">
                      {currentResult.hrv.lfHfRatio !== undefined
                        ? currentResult.hrv.lfHfRatio.toFixed(2)
                        : "-"}
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-4">
                  ※ LF는 교감신경계 활성도를, HF는 부교감신경계 활성도를
                  나타냅니다. LF/HF 비율이 높으면 교감신경계 활성도가 상대적으로
                  높은 상태입니다.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>자율신경계 해석</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>
                    {interpretLfHf(
                      currentResult.hrv.lfHfRatio,
                      currentResult.hrv.lf,
                      currentResult.hrv.hf
                    )}
                  </p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-gray-500 font-medium">
                      스트레스 레벨
                    </span>
                    <span className={getStressLevelColor(stressLevel)}>
                      {getStressLevelText(stressLevel)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Baxe AI 분석 상세 지표</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>지표</TableHead>
                    <TableHead>값</TableHead>
                    <TableHead>의미</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>RMSSD</TableCell>
                    <TableCell>
                      {currentResult.hrv.rmssd !== undefined
                        ? `${currentResult.hrv.rmssd.toFixed(2)} ms`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      연속된 RR 간격의 제곱 평균에 루트를 씌운 값
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>SDNN</TableCell>
                    <TableCell>
                      {currentResult.hrv.sdnn !== undefined
                        ? `${currentResult.hrv.sdnn.toFixed(2)} ms`
                        : "-"}
                    </TableCell>
                    <TableCell>RR 간격의 표준편차</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>LF</TableCell>
                    <TableCell>
                      {currentResult.hrv.lf !== undefined
                        ? currentResult.hrv.lf.toFixed(2)
                        : "-"}{" "}
                      ms²
                    </TableCell>
                    <TableCell>저주파 파워 (0.04-0.15Hz)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>HF</TableCell>
                    <TableCell>
                      {currentResult.hrv.hf !== undefined
                        ? currentResult.hrv.hf.toFixed(2)
                        : "-"}{" "}
                      ms²
                    </TableCell>
                    <TableCell>고주파 파워 (0.15-0.4Hz)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>LF/HF 비율</TableCell>
                    <TableCell>
                      {currentResult.hrv.lfHfRatio !== undefined
                        ? currentResult.hrv.lfHfRatio.toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell>저주파와 고주파 파워의 비율</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>pNN50</TableCell>
                    <TableCell>
                      {currentResult.hrv.pnn50 !== undefined
                        ? `${currentResult.hrv.pnn50.toFixed(2)} %`
                        : "-"}
                    </TableCell>
                    <TableCell>50ms 초과 차이를 보이는 RR 간격 비율</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-center gap-4 mt-10">
        <Button
          onClick={handleMeasureAgain}
          variant="outline"
          disabled={isSaving}
        >
          다시 측정하기
        </Button>
        <Button onClick={handleSaveResult} disabled={isSaving}>
          {isSaving ? "저장 중..." : "결과 저장하기"}
        </Button>
      </div>
    </div>
  );
}

function calculateStressLevel(rmssd: number): string {
  if (rmssd > 50) return "low";
  if (rmssd > 20) return "moderate";
  return "high";
}

function getStressLevelText(level: string): string {
  switch (level) {
    case "low":
      return "낮음";
    case "moderate":
      return "보통";
    case "high":
      return "높음";
    default:
      return "분석 불가";
  }
}

function getStressLevelColor(level: string): string {
  switch (level) {
    case "low":
      return "text-green-500 font-medium";
    case "moderate":
      return "text-yellow-500 font-medium";
    case "high":
      return "text-red-500 font-medium";
    default:
      return "text-gray-500";
  }
}

function interpretLfHf(lfHfRatio?: number, lf?: number, hf?: number): string {
  if (lfHfRatio === undefined || lf === undefined || hf === undefined) {
    return "자율신경계 균형을 해석할 수 없습니다.";
  }

  if (lfHfRatio > 2) {
    return "교감신경계가 활성화된 상태로 스트레스가 높을 수 있습니다.";
  } else if (lfHfRatio < 1) {
    return "부교감신경계가 활성화된 상태로 편안한 상태일 수 있습니다.";
  } else {
    return "교감신경계와 부교감신경계가 균형을 이루고 있는 상태입니다.";
  }
}
