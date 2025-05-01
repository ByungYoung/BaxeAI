"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RPPGCamera from "@/components/rppg-camera";
import { processWithPyVHR } from "@/lib/api-client";
import { AlertCircle, ArrowLeft, Smile, Frown, Meh } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MoodState } from "@/lib/types";

export default function MeasurePage() {
  const router = useRouter();
  const { userInfo, setCurrentResult } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodState>("neutral");

  // 사용자 정보가 없으면 등록 페이지로 리디렉션
  useEffect(() => {
    if (!userInfo) {
      router.push("/register");
    }
  }, [userInfo, router]);

  // 프레임 처리 함수
  const handleFramesCapture = async (frames: string[]) => {
    try {
      setIsProcessing(true);
      setError(null);

      // 서버에 프레임 전송 및 처리 요청
      const result = await processWithPyVHR(frames);

      // 상태 저장 (기분 상태 포함)
      setCurrentResult(
        result.heartRate,
        result.confidence,
        result.hrv,
        selectedMood
      );

      // 결과 페이지로 이동
      router.push("/results");
    } catch (err) {
      console.error("Processing error:", err);
      setError("측정 데이터 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getMoodIcon = (mood: MoodState) => {
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

  if (!userInfo) {
    return null; // 리디렉션 중이므로 아무것도 렌더링하지 않음
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Button
        variant="outline"
        size="sm"
        className="mb-4"
        onClick={() => router.back()}
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> 뒤로가기
      </Button>

      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>심박변이도 측정</CardTitle>
          <CardDescription>
            카메라를 통해 30초 동안 얼굴을 촬영하여 심박수와 심박변이도를
            측정합니다.
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

          <div className="space-y-6">
            {/* 기분 선택 UI */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-center">
                현재 기분 상태를 선택하세요
              </h3>
              <RadioGroup
                value={selectedMood}
                onValueChange={(value) => setSelectedMood(value as MoodState)}
                className="grid grid-cols-2 md:grid-cols-5 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="happy" id="mood-happy" />
                  <Label
                    htmlFor="mood-happy"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Smile className="h-5 w-5 text-green-500" />
                    <span>행복함</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="neutral" id="mood-neutral" />
                  <Label
                    htmlFor="mood-neutral"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Meh className="h-5 w-5 text-gray-500" />
                    <span>보통</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sad" id="mood-sad" />
                  <Label
                    htmlFor="mood-sad"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Frown className="h-5 w-5 text-blue-500" />
                    <span>우울함</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="stressed" id="mood-stressed" />
                  <Label
                    htmlFor="mood-stressed"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span>스트레스</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="relaxed" id="mood-relaxed" />
                  <Label
                    htmlFor="mood-relaxed"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Smile className="h-5 w-5 text-teal-500" />
                    <span>편안함</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <RPPGCamera
                onFramesCapture={handleFramesCapture}
                isProcessing={isProcessing}
                processText="측정 데이터를 분석 중입니다..."
                measurementTime={30} // 30초 측정
                className="w-full"
              />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">측정 안내</h3>
              <ul className="text-sm text-gray-600 list-disc list-inside text-left mx-auto space-y-1 max-w-lg">
                <li className="font-medium text-amber-600">
                  측정 성공률을 높이기 위한 중요 팁!
                </li>
                <li>밝은 자연광이 있는 환경에서 측정하세요 (창가 추천)</li>
                <li>형광등이나 깜빡이는 조명은 피하세요</li>
                <li>얼굴과 카메라 사이 거리는 30-50cm가 적당합니다</li>
                <li>
                  측정 중에는 움직임을 최소화하고 편안한 자세를 유지하세요
                </li>
                <li>얼굴 전체가 화면에 잘 보이도록 카메라를 조정하세요</li>
                <li>30초간 측정이 진행됩니다</li>
                <li>측정이 완료되면 자동으로 결과 페이지로 이동합니다</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
