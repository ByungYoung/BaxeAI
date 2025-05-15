'use client';

import { ReactNode, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter, usePathname } from 'next/navigation';

interface AuthStatusProviderProps {
  children: ReactNode;
}

// 로그인이 필요한 경로 목록
const PROTECTED_PATHS = ['/measure', '/history', '/results'];

export function AuthStatusProvider({ children }: AuthStatusProviderProps) {
  const { isAuthenticated } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();

  // 인증이 필요한 페이지에 대한 접근 제어
  useEffect(() => {
    if (!isAuthenticated && PROTECTED_PATHS.some(path => pathname?.startsWith(path))) {
      // 로그인되지 않은 상태로 보호된 경로에 접근하면 로그인 페이지로 리디렉션
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || '/')}`);
    }
  }, [isAuthenticated, pathname, router]);

  return <>{children}</>;
}
