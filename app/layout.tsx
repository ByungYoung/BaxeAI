import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LanguageProvider } from "@/hooks/use-language";
import { AuthStatusProvider } from "@/components/auth-status-provider";
import { AuthButtons } from "@/components/auth-buttons";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Baxe ai",
  description: "xitst read your body, lead your mind",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    other: [
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </head>
      <body className={`${inter.className} h-full antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            <AuthStatusProvider>
              <div className="min-h-full flex flex-col bg-background text-foreground">
                {/* 헤더 부분 - 중앙 정렬로 변경 */}
                <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="max-w-screen-xl mx-auto flex h-14 items-center justify-between px-4 md:px-8">
                    {/* 모바일 메뉴와 로고 */}
                    <div className="flex items-center gap-2">
                      {/* 모바일 메뉴 */}
                      <Sheet>
                        <SheetTrigger asChild className="md:hidden">
                          <Button variant="ghost" size="icon">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">메뉴 열기</span>
                          </Button>
                        </SheetTrigger>
                        <SheetContent
                          side="left"
                          className="w-[240px] sm:w-[300px]"
                        >
                          <div className="py-4 font-semibold text-lg">
                            Baxe AI: read your body, lead your mind
                          </div>
                          <nav className="flex flex-col gap-3 mt-2">
                            <Link
                              href="/"
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
                            >
                              홈
                            </Link>
                            <Link
                              href="/register"
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
                            >
                              측정 시작
                            </Link>
                            <Link
                              href="/history"
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
                            >
                              측정 기록
                            </Link>
                          </nav>
                          <div className="flex items-center gap-2 mt-8">
                            <ThemeToggle />
                            <LanguageToggle />
                          </div>
                        </SheetContent>
                      </Sheet>
                      {/* 로고 */}
                      <Link
                        href="/"
                        className="font-bold text-lg flex items-center"
                      >
                        <span>심박변이도 측정</span>
                      </Link>
                    </div>

                    {/* 데스크톱 메뉴 - 중앙 배치 */}
                    <nav className="hidden md:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2 space-x-1">
                      <Link
                        href="/"
                        className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-accent"
                      >
                        홈
                      </Link>
                      <Link
                        href="/register"
                        className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-accent"
                      >
                        측정 시작
                      </Link>
                      <Link
                        href="/history"
                        className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-accent"
                      >
                        측정 기록
                      </Link>
                    </nav>

                    {/* 우측 도구 모음 */}
                    <div className="flex items-center gap-2">
                      <AuthButtons />
                      <LanguageToggle />
                      <ThemeToggle />
                    </div>
                  </div>
                </header>

                {/* 메인 콘텐츠 */}
                <main className="flex-grow">
                  <div className="max-w-screen-xl mx-auto py-4 px-4 md:py-8 md:px-6">
                    {children}
                  </div>
                </main>

                {/* 푸터 */}
                <footer className="border-t py-4">
                  <div className="max-w-screen-xl mx-auto px-4 flex flex-col items-center justify-between gap-4 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                      © {new Date().getFullYear()} 심박변이도 측정 서비스. All
                      rights reserved.
                    </p>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        이용약관
                      </Link>
                      <span className="text-muted-foreground">·</span>
                      <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        개인정보처리방침
                      </Link>
                    </div>
                  </div>
                </footer>
              </div>
            </AuthStatusProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
