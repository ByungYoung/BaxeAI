/** @type {import('next').NextConfig} */
const nextConfig = {
  // 클라이언트 측에서 사용할 수 없는 패키지를 서버 컴포넌트에서만 사용하도록 설정
  webpack: (config, { isServer }) => {
    // WebAssembly 지원을 위한 설정
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // WebAssembly 파일을 로드하기 위한 로더 설정
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

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

  // 서버 외부 패키지 설정
  serverExternalPackages: ["@google-cloud/translate"],

  // 이미지 도메인 허용 설정
  images: {
    domains: [
      'localhost',
      'baxe-ai.vercel.app',
      'baxe.ai',
      'placehold.co',
    ],
  },

  // 기본 빌드 설정
  swcMinify: true,
};

module.exports = nextConfig;

