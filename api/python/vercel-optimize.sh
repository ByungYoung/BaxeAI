#!/bin/bash
# Vercel 무료 티어를 위한 패키지 설치 최적화 스크립트
# 250MB 제한을 준수하기 위한 최소한의 Python 패키지만 설치

echo "====== Vercel Python 최적화 스크립트 시작 ======"

# Python 버전 확인
python --version || python3 --version
cd api/python

# 설치 전 클린업 - 기존 패키지 제거
rm -rf ./numpy ./cv2 ./scipy ./werkzeug __pycache__ 2>/dev/null
echo "환경 정리 완료"

# 메모리 사용량 감소를 위해 설정
export PIP_NO_CACHE_DIR=1
export PIP_NO_DEPS=1
export PYTHONDONTWRITEBYTECODE=1
export PYTHONOPTIMIZE=2

echo "===== 필수 패키지 설치 시작 ====="

# 첫 번째 패키지만 설치 (순차적으로 설치하여 메모리 사용량 감소)
python -m pip install --no-deps --only-binary=:all: numpy==1.21.0
echo "NumPy 설치 완료"

# 두 번째 패키지 설치
python -m pip install --no-deps --only-binary=:all: opencv-python-headless==4.5.0
echo "OpenCV 설치 완료"

# 세 번째 패키지 설치
python -m pip install --no-deps --only-binary=:all: scipy==1.7.0
echo "SciPy 설치 완료"

# 필수 패키지만 설치
python -m pip install --no-deps --only-binary=:all: werkzeug==1.0.1
echo "Werkzeug 설치 완료"

# 설치된 패키지 크기 확인
echo "===== 설치된 패키지 크기 ====="
du -sh ./numpy ./cv2 ./scipy ./werkzeug 2>/dev/null

echo "===== 불필요한 파일 제거 ====="

# 불필요한 파일 제거로 크기 최소화
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null
find . -type d -name "test" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -delete
find . -type f -name "*.pyo" -delete
find . -type f -name "*.c" -delete
find . -type f -name "*.h" -delete
find . -type f -name "*.cpp" -delete

# 최종 크기 확인
echo "===== 최종 패키지 크기 ====="
du -sh . 2>/dev/null

echo "====== Vercel Python 최적화 스크립트 완료 ======"
