"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { LogIn, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AuthButtons() {
  const { isAuthenticated, userInfo, clearUserInfo } = useAppStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      // 서버에 로그아웃 요청
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      // 로컬 상태 초기화
      clearUserInfo();

      // 홈 페이지로 이동
      router.push("/");
    } catch (error) {
      console.error("로그아웃 중 오류 발생:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Link href="/login">
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-1"
        >
          <LogIn className="h-4 w-4 mr-1" />
          로그인
        </Button>
        <Button variant="outline" size="icon" className="sm:hidden">
          <LogIn className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-1"
        >
          <User className="h-4 w-4 mr-1" />
          {userInfo?.name || userInfo?.email?.split("@")[0] || "사용자"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="sm:hidden">
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>내 계정</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>{userInfo?.email}</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">프로필 설정</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="text-red-500 focus:text-red-500"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
