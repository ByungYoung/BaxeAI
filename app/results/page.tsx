"use client";

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
import { Smile, Frown, Meh, AlertCircle } from "lucide-react";
import { MoodState } from "@/lib/types";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

export default function ResultsPage() {
  const router = useRouter();
  const { currentResult, addToHistory } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveResult = async () => {
    setIsSaving(true);

    try {
      // 로컬 상태에 저장
      addToHistory();

      // 사용자 정보 준비
      const userData = currentResult?.userInfo || {
        email: "",
        name: "",
        company: "",
      };

      // DB에 저장
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userData.id, // ID가 없을 수 있음
          userEmail: userData.email, // 이메일 정보 추가
          userName: userData.name, // 이름 정보 추가
          userCompany: userData.company, // 소속 정보 추가
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

  // 기분 아이콘 및 텍스트 반환 함수
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

  const stressLevel = currentResult.hrv
    ? calculateStressLevel(currentResult.hrv.rmssd)
    : "분석 불가";

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">심박변이도 측정 결과</h1>

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
                <span className="text-gray-500">사용자</span>
                <span>
                  {currentResult.userInfo.name || currentResult.userInfo.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">소속</span>
                <span>{currentResult.userInfo.company}</span>
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
                <span className="text-gray-500">신뢰도</span>
                <span>{(currentResult.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">스트레스 레벨</span>
                <span className={getStressLevelColor(stressLevel)}>
                  {getStressLevelText(stressLevel)}
                </span>
              </div>
              {/* 기분 상태 표시 */}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">기분 상태</span>
                <span className="flex items-center gap-2">
                  {getMoodIcon(currentResult.mood)}
                  {getMoodText(currentResult.mood)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {currentResult.hrv && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>심박변이도(HRV) 상세 지표</CardTitle>
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
                  <TableCell>{currentResult.hrv.rmssd.toFixed(2)} ms</TableCell>
                  <TableCell>
                    연속된 RR 간격의 제곱 평균에 루트를 씌운 값
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>SDNN</TableCell>
                  <TableCell>{currentResult.hrv.sdnn.toFixed(2)} ms</TableCell>
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
                      ? currentResult.hrv.pnn50.toFixed(2)
                      : "-"}{" "}
                    %
                  </TableCell>
                  <TableCell>50ms 초과 차이를 보이는 RR 간격 비율</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
