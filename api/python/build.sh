#!/bin/bash
# Python 패키지 설치를 위한 Vercel 빌드 헬퍼 스크립트
echo "📦 Python 패키지 설치 시작..."

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
  
  # Python으로 패키지 설치 (pip3.9 대신)
  echo "🔧 werkzeug 1.0.1 설치 중..."
  $PYTHON_CMD -m pip install --disable-pip-version-check --target . werkzeug==1.0.1
  
  # requirements.txt 설치
  echo "📋 requirements.txt 설치 중..."
  $PYTHON_CMD -m pip install --disable-pip-version-check --target . -r requirements.txt
  
  echo "✅ Python 패키지 설치 완료!"
else
  echo "❌ 사용 가능한 Python 명령어를 찾을 수 없습니다!"
  echo "현재 PATH: $PATH"
  ls -la /usr/bin | grep python
  ls -la /usr/local/bin | grep python
  echo "다음 단계로 계속 진행합니다..."
fi
