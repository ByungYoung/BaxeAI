#!/bin/bash
# BaxeAI 실행 스크립트 (macOS)
# 이 스크립트는 Python 환경 설정과 필요한 패키지 설치를 자동화합니다

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 시작 메시지
echo -e "${PURPLE}========================================${NC}"
echo -e "${PURPLE}         BaxeAI 설정 스크립트          ${NC}"
echo -e "${PURPLE}========================================${NC}"

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
log_info "작업 디렉토리: $SCRIPT_DIR"

# Python 버전 확인
PYTHON_CMD=$(which python3)
if [ -z "$PYTHON_CMD" ]; then
    log_error "Python3를 찾을 수 없습니다. 설치해주세요."
    exit 1
fi

PY_VERSION=$($PYTHON_CMD --version)
log_info "사용할 Python: $PY_VERSION ($PYTHON_CMD)"

# 가상환경 생성
VENV_DIR=".venv"
if [ ! -d "$VENV_DIR" ]; then
    log_info "가상환경 생성 중..."
    $PYTHON_CMD -m venv $VENV_DIR
    if [ $? -ne 0 ]; then
        log_error "가상환경 생성 실패"
        exit 1
    fi
    log_success "가상환경 생성 완료"
else
    log_info "가상환경이 이미 존재합니다"
fi

# 가상환경 활성화
log_info "가상환경 활성화 중..."
source "$VENV_DIR/bin/activate"
if [ $? -ne 0 ]; then
    log_error "가상환경 활성화 실패"
    exit 1
fi
log_success "가상환경 활성화 완료"

# pip 업그레이드
log_info "pip 업그레이드 중..."
pip install --upgrade pip
if [ $? -ne 0 ]; then
    log_warning "pip 업그레이드 실패했지만 계속 진행합니다"
fi

# 필수 패키지 설치
log_info "필수 Python 패키지 설치 중..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    log_warning "requirements.txt 설치 중 문제 발생. 필수 패키지만 설치합니다."
    pip install numpy opencv-python-headless scipy scikit-learn matplotlib pandas numba
fi
log_success "Python 패키지 설치 완료"

# Node.js 패키지 설치
if ! command -v pnpm &> /dev/null; then
    log_info "pnpm을 설치합니다..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        log_error "pnpm 설치 실패"
        exit 1
    fi
fi

log_info "Node.js 패키지 설치 중..."
pnpm install
if [ $? -ne 0 ]; then
    log_error "Node.js 패키지 설치 실패"
    exit 1
fi
log_success "Node.js 패키지 설치 완료"

# process_rppg.py 스크립트 실행 권한 부여
if [ -f "scripts/process_rppg.py" ]; then
    log_info "process_rppg.py 스크립트 실행 권한 설정 중..."
    chmod +x scripts/process_rppg.py
    log_success "스크립트 실행 권한 설정 완료"
fi

# 개발 서버 실행
echo -e "${PURPLE}========================================${NC}"
log_success "모든 설정이 완료되었습니다!"
echo -e "${PURPLE}========================================${NC}"
echo ""
log_info "개발 서버를 실행하려면: pnpm run dev"
echo ""

# 실행 옵션 제공
echo -e "옵션을 선택하세요:"
echo -e "1) ${GREEN}개발 서버 시작${NC}"
echo -e "2) ${YELLOW}종료${NC}"
read -p "선택 (기본값: 1): " choice

case ${choice:-1} in
    1)
        log_info "개발 서버를 시작합니다..."
        exec pnpm run dev
        ;;
    2)
        log_info "설정만 완료하고 종료합니다."
        exit 0
        ;;
    *)
        log_error "잘못된 선택입니다."
        exit 1
        ;;
esac
