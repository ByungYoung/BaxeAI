@echo off
:: BaxeAI 설치 스크립트 (Windows)
:: 이 스크립트는 Python 환경 설정과 필요한 패키지 설치를 자동화합니다

echo ========================================
echo          BaxeAI 설정 스크립트 (Windows)
echo ========================================

:: 컬러 설정
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "BLUE=[34m"
set "PURPLE=[35m"
set "NC=[0m"

:: 현재 디렉토리
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
echo %BLUE%[INFO]%NC% 작업 디렉토리: %SCRIPT_DIR%

:: Python 확인
where python > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[ERROR]%NC% Python을 찾을 수 없습니다. 설치해주세요.
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo %BLUE%[INFO]%NC% 사용할 Python: %PYTHON_VERSION%

:: 가상환경 생성
set "VENV_DIR=.venv"
if not exist "%VENV_DIR%" (
    echo %BLUE%[INFO]%NC% 가상환경 생성 중...
    python -m venv %VENV_DIR%
    if %ERRORLEVEL% NEQ 0 (
        echo %RED%[ERROR]%NC% 가상환경 생성 실패
        exit /b 1
    )
    echo %GREEN%[SUCCESS]%NC% 가상환경 생성 완료
) else (
    echo %BLUE%[INFO]%NC% 가상환경이 이미 존재합니다
)

:: 가상환경 활성화
echo %BLUE%[INFO]%NC% 가상환경 활성화 중...
call "%VENV_DIR%\Scripts\activate.bat"
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[ERROR]%NC% 가상환경 활성화 실패
    exit /b 1
)
echo %GREEN%[SUCCESS]%NC% 가상환경 활성화 완료

:: pip 업그레이드
echo %BLUE%[INFO]%NC% pip 업그레이드 중...
python3 -m pip install --upgrade pip
if %ERRORLEVEL% NEQ 0 (
    echo %YELLOW%[WARNING]%NC% pip 업그레이드 실패했지만 계속 진행합니다
)

:: 필수 패키지 설치
echo %BLUE%[INFO]%NC% 필수 Python 패키지 설치 중...
python3 -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo %YELLOW%[WARNING]%NC% requirements.txt 설치 중 문제 발생. 필수 패키지만 설치합니다.
    python3 -m pip install numpy opencv-python-headless scipy scikit-learn matplotlib pandas numba
)
echo %GREEN%[SUCCESS]%NC% Python 패키지 설치 완료

:: Node.js 패키지 설치
where pnpm > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %BLUE%[INFO]%NC% pnpm을 설치합니다...
    npm install -g pnpm
    if %ERRORLEVEL% NEQ 0 (
        echo %RED%[ERROR]%NC% pnpm 설치 실패
        exit /b 1
    )
)

echo %BLUE%[INFO]%NC% Node.js 패키지 설치 중...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[ERROR]%NC% Node.js 패키지 설치 실패
    exit /b 1
)
echo %GREEN%[SUCCESS]%NC% Node.js 패키지 설치 완료

:: 개발 서버 실행
echo ========================================
echo %GREEN%[SUCCESS]%NC% 모든 설정이 완료되었습니다!
echo ========================================
echo.
echo %BLUE%[INFO]%NC% 개발 서버를 실행하려면: pnpm run dev
echo.

:: 실행 옵션 제공
echo 옵션을 선택하세요:
echo 1) %GREEN%개발 서버 시작%NC%
echo 2) %YELLOW%종료%NC%
set /p choice="선택 (기본값: 1): "

if "%choice%"=="" set choice=1
if "%choice%"=="1" (
    echo %BLUE%[INFO]%NC% 개발 서버를 시작합니다...
    call pnpm run dev
) else if "%choice%"=="2" (
    echo %BLUE%[INFO]%NC% 설정만 완료하고 종료합니다.
) else (
    echo %RED%[ERROR]%NC% 잘못된 선택입니다.
    exit /b 1
)

exit /b 0
