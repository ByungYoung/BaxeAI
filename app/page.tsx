"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Heart, Clock, BarChart2, Camera } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { userInfo } = useAppStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 컴포넌트 마운트 후 로그인 상태 확인
  useEffect(() => {
    setIsLoggedIn(!!userInfo?.id);
  }, [userInfo]);

  // 측정 페이지 경로 결정 (로그인 상태에 따라)
  const measurePath = isLoggedIn ? "/measure" : "/register";

  return (
    <div className="space-y-8">
      {/* 히어로 섹션 */}
      <section className="py-8 md:py-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col gap-6 items-center text-center">
            <div className="space-y-4 max-w-2xl mx-auto">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                Baxe AI로 심박수와 스트레스를 측정하세요
              </h1>
              <p className="text-muted-foreground md:text-lg">
                스마트폰이나 웹캠 카메라만으로 당신의 현재 상태를 측정하고
                스트레스 수준을 분석해 보세요.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href={measurePath}>
                  <Button size="lg">
                    {isLoggedIn ? "측정 시작하기" : "회원가입 후 시작하기"}
                  </Button>
                </Link>
                <Link href="#features">
                  <Button variant="outline" size="lg">
                    자세히 알아보기
                  </Button>
                </Link>
              </div>
            </div>
            <div className="w-full max-w-md mx-auto">
              <div className="bg-background p-4 rounded-xl shadow-md">
                <div className="aspect-video overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                  <Heart className="w-16 h-16 text-red-500 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 특징/기능 섹션 */}
      <section id="features" className="py-8">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">서비스 특징</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              카메라를 활용한 비접촉식 측정으로 편리하게 심박수와 심박변이도를
              분석하여 건강 상태와 스트레스 수준을 확인할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                  <Camera className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">비접촉식 측정</h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  특별한 장비 없이 일반 카메라만으로 얼굴의 미세한 색상 변화를
                  감지하여 심박수와 심박변이도를 측정합니다.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                  <Heart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">심박변이도 분석</h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  심박 간격의 변화를 분석하여 자율신경계 기능과 스트레스 대응
                  능력을 평가합니다.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                  <BarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">건강 지표</h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  측정된 데이터를 기반으로 스트레스 수준과 자율신경계 균형
                  상태를 쉽게 이해할 수 있도록 시각화하여 제공합니다.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">빠른 측정</h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  단 30초 만에 측정이 완료되며, 즉시 결과를 확인할 수 있어 일상
                  속에서 쉽게 건강을 체크할 수 있습니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-8 bg-blue-600 dark:bg-blue-700 text-white rounded-lg mb-8">
        <div className="container px-4 md:px-6 text-center">
          <h2 className="text-2xl font-bold mb-3">지금 바로 시작하세요</h2>
          <p className="mb-6 max-w-2xl mx-auto">
            간단한 정보 입력 후 카메라만으로 심박변이도를 측정하고 당신의
            스트레스 수준과 건강 상태를 확인해 보세요.
          </p>
          <Link href={measurePath}>
            <Button size="lg" variant="secondary" className="font-semibold">
              {isLoggedIn ? "측정 시작하기" : "측정 정보 등록"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
