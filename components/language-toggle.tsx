'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';

export function LanguageToggle() {
  const router = useRouter();
  const { locale, setLocale } = useLanguage();

  const getLanguageName = (code: string) => {
    switch (code) {
      case 'ko':
        return '한국어';
      case 'en':
        return 'English';
      case 'ja':
        return '日本語';
      case 'zh':
        return '中文';
      default:
        return code;
    }
  };

  const changeLanguage = (newLocale: string) => {
    setLocale(newLocale);
    // 언어 변경 후 페이지 새로고침을 방지하기 위해 router.refresh() 대신
    // 상태 변경만으로 UI 업데이트 처리
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">언어 변경</span>
          {/* 현재 언어 코드 표시 */}
          <span className="absolute bottom-0.5 right-0.5 text-[0.6rem] font-semibold bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
            {locale.substring(0, 2)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => changeLanguage('ko')}
          className={locale === 'ko' ? 'bg-accent' : ''}
        >
          한국어
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('en')}
          className={locale === 'en' ? 'bg-accent' : ''}
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('ja')}
          className={locale === 'ja' ? 'bg-accent' : ''}
        >
          日本語
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('zh')}
          className={locale === 'zh' ? 'bg-accent' : ''}
        >
          中文
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
