#!/bin/bash
# Python 패키지 설치를 위한 Vercel 빌드 헬퍼 스크립트 (무료 티어 최적화)
echo "📦 Python 패키지 설치 시작 (Vercel 무료 티어 최적화)..."

# Vercel 환경에서 사용 가능한 Python 명령어 찾기
PYTHON_CMD=""
for cmd in python3 python python3.9 python2; do
  if command -v $cmd &>/dev/null; then
    PYTHON_CMD=$cmd
    break
  fi
done

# Python 버전 확인
if [ -n "$PYTHON_CMD" ]; then
  python_version=$($PYTHON_CMD --version 2>&1)
  echo "🐍 Python 버전: $python_version ($PYTHON_CMD)"
  
  # pip 옵션 설정 (250MB 제한에 맞춤)
  PIP_OPTIONS="--disable-pip-version-check --no-cache-dir --only-binary=:all: --no-deps"
  
  echo "🔧 필수 패키지 최소 버전으로 설치..."
  
  # 주요 패키지 직접 설치 (버전 고정, 의존성 최소화)
  $PYTHON_CMD -m pip install $PIP_OPTIONS --target . werkzeug==1.0.1
  $PYTHON_CMD -m pip install $PIP_OPTIONS --target . numpy==1.21.0
  $PYTHON_CMD -m pip install $PIP_OPTIONS --target . opencv-python-headless==4.5.0
  $PYTHON_CMD -m pip install $PIP_OPTIONS --target . scipy==1.7.0
  
  # 설치 패키지 크기 확인
  echo "📊 설치된 패키지 크기 확인:"
  du -sh ./numpy ./cv2 ./scipy ./werkzeug 2>/dev/null || echo "패키지 크기를 확인할 수 없습니다"
  
  # 불필요한 파일 정리 (용량 절약)
  echo "🧹 불필요한 파일 정리..."
  find . -type d -name "__pycache__" -exec rm -rf {} +
  find . -type d -name "tests" -exec rm -rf {} +
  find . -type d -name "test" -exec rm -rf {} +
  find . -type f -name "*.pyc" -delete
  find . -type f -name "*.pyo" -delete
  find . -type f -name "*.c" -delete
  find . -type f -name "*.h" -delete
  find . -type f -name "*.cpp" -delete
  
  echo "✅ Python 패키지 설치 및 최적화 완료!"
else
  echo "❌ 사용 가능한 Python 명령어를 찾을 수 없습니다!"
  echo "현재 PATH: $PATH"
  ls -la /usr/bin | grep python
  ls -la /usr/local/bin | grep python
  echo "다음 단계로 계속 진행합니다..."
fi
