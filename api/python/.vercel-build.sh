#!/bin/bash

# Vercel 빌드 환경에서 필요한 Python 패키지를 설치하는 스크립트
echo "Installing Python packages for Vercel deployment..."

# Python 버전 확인
python --version
pip --version

# werkzeug 패키지 설치
pip install werkzeug==1.0.1

# 다른 필수 패키지들도 설치
pip install numpy opencv-python-headless scipy

echo "Python packages installation complete"
