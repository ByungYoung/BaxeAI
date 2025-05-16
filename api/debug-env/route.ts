import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

/**
 * 서버 환경의 파일 시스템과 환경 변수를 디버깅하기 위한 API 엔드포인트
 */
export async function GET() {
  // 보안상의 이유로 프로덕션 환경에서는 이 API를 비활성화
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG) {
    return NextResponse.json({ error: 'Debug API is disabled in production' }, { status: 403 });
  }

  const debug = {
    environment: process.env.NODE_ENV || 'unknown',
    vercel: process.env.VERCEL === '1',
    cwd: process.cwd(),
    files: {} as Record<string, any>,
    envVars: {} as Record<string, string>,
  };

  // 중요한 디렉토리 검사
  const dirsToCheck = ['/', '/public', '/public/fonts', '/fonts', '/scripts', '/api/python'];

  for (const dir of dirsToCheck) {
    try {
      const fullPath = path.join(process.cwd(), dir);
      const files = await fs.readdir(fullPath);
      debug.files[dir] = files;
    } catch (err) {
      debug.files[dir] = `Error: ${(err as Error).message}`;
    }
  }

  // 특정 파일 존재 확인
  const filesToCheck = [
    '/process_rppg.py',
    '/scripts/process_rppg.py',
    '/api/python/process_rppg.py',
    '/public/fonts/NotoSansCJKkr-Regular.ttf',
    '/fonts/NotoSansCJKkr-Regular.ttf',
    '/public/fonts/NanumGothic-Regular.ttf',
  ];

  for (const file of filesToCheck) {
    try {
      const fullPath = path.join(process.cwd(), file);
      const stats = await fs.stat(fullPath);
      debug.files[file] = {
        exists: true,
        size: stats.size,
        isDirectory: stats.isDirectory(),
      };
    } catch (err) {
      debug.files[file] = {
        exists: false,
        error: (err as Error).message,
      };
    }
  }

  // 안전한 환경 변수만 포함
  const safeEnvVars = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'VERCEL_URL'];
  for (const key of safeEnvVars) {
    if (process.env[key]) {
      debug.envVars[key] = process.env[key] as string;
    }
  }

  return NextResponse.json(debug);
}
