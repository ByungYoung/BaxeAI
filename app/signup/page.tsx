"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-14rem)]">
      <p className="text-muted-foreground">
        측정 정보 등록 페이지로 이동 중...
      </p>
    </div>
  );
}
