"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, HeartPulse } from "lucide-react";

export default function VercelPythonTest() {
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Python 서버 상태 확인
  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/vercel-python");
      const data = await response.json();
      setServerStatus(data);
      setError(null);
    } catch (err: any) {
      setError(`서버 상태 확인 중 오류: ${err.message}`);
      setServerStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Python 테스트 함수
  const testPythonFunction = async () => {
    try {
      setTesting(true);
      setResult(null);

      // 테스트용 더미 데이터 생성
      const dummyFrames = Array(30)
        .fill(0)
        .map(() => {
          // 가상의 3x3 RGB 프레임 생성
          return [
            Array(3)
              .fill(0)
              .map(() => Math.floor(Math.random() * 255)),
            Array(3)
              .fill(0)
              .map(() => Math.floor(Math.random() * 255)),
            Array(3)
              .fill(0)
              .map(() => Math.floor(Math.random() * 255)),
          ];
        });

      // API 호출
      const response = await fetch("/api/vercel-python", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frames: dummyFrames,
          fps: 30,
        }),
      });

      const data = await response.json();
      setResult(data);
      setError(null);
    } catch (err: any) {
      setError(`Python 함수 테스트 중 오류: ${err.message}`);
      setResult(null);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Vercel Python 테스트</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 서버 상태 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>Python 서버 상태</CardTitle>
            <CardDescription>@vercel/python 런타임 상태 확인</CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">서버 상태 확인 중...</span>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>오류 발생</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : serverStatus ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${
                      serverStatus.api_status === "connected"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                  <span className="font-medium">
                    상태:{" "}
                    {serverStatus.api_status === "connected"
                      ? "연결됨"
                      : "연결 안됨"}
                  </span>
                </div>

                {serverStatus.status && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Python 버전:</span>{" "}
                        {serverStatus.python_version?.split(" ")[0]}
                      </div>
                      <div>
                        <span className="font-medium">NumPy 버전:</span>{" "}
                        {serverStatus.numpy_version}
                      </div>
                      <div>
                        <span className="font-medium">OpenCV 버전:</span>{" "}
                        {serverStatus.opencv_version}
                      </div>
                      <div>
                        <span className="font-medium">Vercel 환경:</span>{" "}
                        {serverStatus.environment?.vercel ? "예" : "아니오"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                서버 상태 정보 없음
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button onClick={checkServerStatus} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {loading ? "확인 중..." : "상태 다시 확인"}
            </Button>
          </CardFooter>
        </Card>

        {/* 테스트 실행 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>Python 함수 테스트</CardTitle>
            <CardDescription>더미 데이터로 rPPG 분석 테스트</CardDescription>
          </CardHeader>

          <CardContent>
            {testing ? (
              <div className="space-y-4 py-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">테스트 실행 중...</span>
                </div>
                <Progress value={45} className="w-full" />
              </div>
            ) : result ? (
              <div className="space-y-4">
                {result.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>분석 오류</AlertTitle>
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <HeartPulse className="h-12 w-12 text-red-500" />
                      <span className="text-3xl font-bold ml-2">
                        {result.heartRate.toFixed(1)}
                      </span>
                      <span className="text-xl text-gray-500 ml-1">BPM</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">신뢰도:</span>{" "}
                        {(result.confidence * 100).toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium">처리됨:</span>{" "}
                        {result.processed ? "예" : "아니오"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <HeartPulse className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                테스트를 실행하여 결과를 확인하세요
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button onClick={testPythonFunction} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <HeartPulse className="mr-2 h-4 w-4" />
              )}
              {testing ? "분석 중..." : "테스트 실행"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
