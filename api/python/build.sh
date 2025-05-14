#!/bin/bash
# Python 패키지 설치를 위한 Vercel 빌드 헬퍼 스크립트
echo "📦 Python 패키지 설치 시작..."

# Python 버전 확인
python_version=$(python --version 2>&1)
echo "🐍 Python 버전: $python_version"

# python -m pip로 패키지 설치 (pip3.9 대신)
echo "🔧 werkzeug 1.0.1 설치 중..."
python -m pip install --disable-pip-version-check --target . werkzeug==1.0.1

# requirements.txt 설치
echo "📋 requirements.txt 설치 중..."
python -m pip install --disable-pip-version-check --target . -r requirements.txt

echo "✅ Python 패키지 설치 완료!"
