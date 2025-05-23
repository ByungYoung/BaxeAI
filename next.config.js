/** @type {import('next').NextConfig} */
const nextConfig = {
  // 클라이언트 측에서 사용할 수 없는 패키지를 서버 컴포넌트에서만 사용하도록 설정
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 측에서 사용하지 않을 Node.js 모듈들 설정
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // 서버 외부 패키지 설정 (experimental에서 이동됨)
  serverExternalPackages: ['@google-cloud/translate'],
  // 빌드 시 ESLint 검사 비활성화
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // TypeScript 타입 검사 비활성화
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
