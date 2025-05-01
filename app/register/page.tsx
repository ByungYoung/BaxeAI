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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// 회원가입 유효성 검사 스키마
const signupSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email({ message: "유효한 이메일 주소를 입력해주세요." }),
    password: z
      .string()
      .min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다." }),
    confirmPassword: z.string(),
    company: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

// 측정 정보 유효성 검사 스키마
const measureInfoSchema = z.object({
  company: z.string().min(1, { message: "회사명을 입력해주세요." }),
  email: z.string().email({ message: "유효한 이메일 주소를 입력해주세요." }),
  name: z.string().optional(),
});

export default function RegisterPage() {
  const router = useRouter();
  const { setUserInfo } = useAppStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("signup");

  // 회원가입 폼 초기화
  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      company: "",
    },
  });

  // 측정 정보 폼 초기화
  const measureForm = useForm<z.infer<typeof measureInfoSchema>>({
    resolver: zodResolver(measureInfoSchema),
    defaultValues: {
      company: "",
      email: "",
      name: "",
    },
  });

  // 회원가입 폼 제출 처리
  async function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    try {
      setSubmitting(true);
      setError("");

      // API 호출하여 사용자 회원가입 처리
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          company: values.company,
        }),
      });

      if (!response.ok) {
        // 서버에서 내려준 에러 메시지 추출
        let errorMsg = "회원가입 중 오류가 발생했습니다";
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      // 사용자 정보 로컬 상태에 저장
      const userData = await response.json();
      setUserInfo({
        ...userData,
        isGuest: false,
      });

      // 측정 페이지로 이동
      router.push("/measure");
    } catch (err: any) {
      setError(err.message || "회원가입 중 오류가 발생했습니다.");
      console.error("Form submission error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  // 측정 정보 폼 제출 처리
  async function onMeasureInfoSubmit(
    values: z.infer<typeof measureInfoSchema>
  ) {
    try {
      setSubmitting(true);
      setError("");

      // 사용자 정보 로컬 상태에 저장 (게스트 모드)
      setUserInfo({
        id: `guest-${Date.now()}`, // 고유한 게스트 ID 부여
        email: values.email,
        name: values.name || values.email.split("@")[0],
        company: values.company,
        isGuest: true,
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
                심박변이도 측정 서비스 사용을 위한 정보를 등록해주세요.
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

              <Tabs
                defaultValue="signup"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signup">회원가입</TabsTrigger>
                  <TabsTrigger value="guest">빠른 측정</TabsTrigger>
                </TabsList>

                <TabsContent value="signup" className="mt-6">
                  <Form {...signupForm}>
                    <form
                      onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={signupForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              이메일 <span className="text-red-500">*</span>
                            </FormLabel>
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
                        control={signupForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              비밀번호 <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="비밀번호를 입력하세요"
                                type="password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={signupForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              비밀번호 확인{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="비밀번호를 다시 입력하세요"
                                type="password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={signupForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>이름</FormLabel>
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

                      <FormField
                        control={signupForm.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>소속(회사/기관)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="소속을 입력하세요 (선택사항)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full mt-2"
                        disabled={submitting}
                      >
                        {submitting ? "등록 중..." : "회원가입 후 측정하기"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="guest" className="mt-6">
                  <Form {...measureForm}>
                    <form
                      onSubmit={measureForm.handleSubmit(onMeasureInfoSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={measureForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              이메일 <span className="text-red-500">*</span>
                            </FormLabel>
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
                        control={measureForm.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              소속(회사/기관){" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="소속을 입력하세요"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={measureForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>이름</FormLabel>
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
                        className="w-full mt-2"
                        disabled={submitting}
                      >
                        {submitting ? "등록 중..." : "빠른 측정 시작하기"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
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
              <Link href="/login" className="text-primary hover:underline">
                로그인하기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
