"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { setUserInfo } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "로그인 중 오류가 발생했습니다.");
      }

      const userData = await response.json();

      // 사용자 정보 저장
      setUserInfo({
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split("@")[0],
        company: userData.company || "",
        isGuest: userData.isGuest || false,
      });

      // 측정 페이지로 이동
      router.push("/measure");
    } catch (err: any) {
      setError(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (!email) {
      setError("게스트 로그인을 위해 이메일을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }), // 비밀번호 없이 요청
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "로그인 중 오류가 발생했습니다.");
      }

      const userData = await response.json();

      // 사용자 정보 저장
      setUserInfo({
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split("@")[0],
        company: userData.company || "",
        isGuest: userData.isGuest || false,
      });

      // 측정 페이지로 이동
      router.push("/measure");
    } catch (err: any) {
      setError(err.message || "게스트 로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-14rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>로그인</CardTitle>
          <CardDescription>
            Baxe AI 서비스를 이용하려면 로그인해주세요.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="이메일 주소를 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">비밀번호 (선택사항)</Label>
                {/* <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  비밀번호 찾기
                </Link> */}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                className="w-1/2"
                onClick={handleGuestLogin}
                variant="outline"
                disabled={isLoading}
              >
                {isLoading ? "처리 중..." : "게스트로 시작"}
              </Button>
              <Button type="submit" className="w-1/2" disabled={isLoading}>
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </div>

            <div className="text-center text-sm">
              회원가입 하고 더 많은 기능을 이용하세요{" "}
              <Link href="/signup" className="text-primary hover:underline">
                회원가입
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
