"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAppStore } from "@/lib/store";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

// 사용자 정보 유효성 검사 스키마
const formSchema = z.object({
  company: z.string().min(1, { message: "회사명을 입력해주세요." }),
  email: z.string().email({ message: "유효한 이메일 주소를 입력해주세요." }),
  name: z.string().optional(),
});

export default function RegisterPage() {
  const router = useRouter();
  const { setUserInfo } = useAppStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 폼 초기화
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company: "",
      email: "",
      name: "",
    },
  });

  // 폼 제출 처리
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setSubmitting(true);
      setError("");

      // API 호출하여 사용자 정보 서버에 저장
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: values.company,
          email: values.email,
          name: values.name || undefined,
        }),
      });

      if (!response.ok) {
        // 서버에서 내려준 에러 메시지 추출
        let errorMsg = "서버 응답 오류";
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      // 서버 응답 데이터 가져오기
      const userData = await response.json();

      // 사용자 정보 로컬 상태에 저장
      setUserInfo({
        ...userData,
        company: values.company,
        email: values.email,
        name: values.name || undefined,
      });

      // 측정 페이지로 이동
      router.push("/measure");
    } catch (err) {
      setError("정보 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error("Form submission error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="flex flex-col items-center py-6 md:py-10">
        <div className="w-full max-w-md">
          <div className="mb-4 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-1 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>이전으로</span>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>측정 정보 등록</CardTitle>
              <CardDescription>
                측정을 시작하기 전에 기본 정보를 입력해주세요.
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

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>회사명</FormLabel>
                        <FormControl>
                          <Input placeholder="회사명을 입력하세요" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>이메일</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="이메일 주소를 입력하세요"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>이름 (선택사항)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="이름을 입력하세요 (선택사항)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting ? "처리 중..." : "측정 시작하기"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground w-full text-center">
                입력하신 정보는 측정 결과와 함께 저장됩니다.
              </p>
            </CardFooter>
          </Card>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>
              이미 계정이 있으신가요?{" "}
              <Link href="/" className="text-primary hover:underline">
                로그인하기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
