# rPPG-camera

rPPG(원격 광용적맥파) 기반 카메라 및 신호 처리 웹 애플리케이션

## 소개

이 프로젝트는 웹캠을 통해 rPPG 신호를 추출하고, 이를 처리하여 생체 신호(예: 심박수 등)를 분석하는 Next.js 기반의 웹 애플리케이션입니다.

## 주요 기능

- 웹캠 영상 캡처 및 실시간 미리보기
- rPPG 신호 추출 및 처리
- 결과 시각화(차트 등)
- 사용자 친화적 UI

## 폴더 구조

```
components/         # UI 컴포넌트 및 카메라 컴포넌트
hooks/              # 커스텀 React 훅
lib/                # API 클라이언트, rPPG 처리 로직 등
app/                # Next.js 라우트 및 API 엔드포인트
public/             # 정적 파일(이미지 등)
scripts/            # rPPG 처리용 Python 스크립트
styles/             # 전역 스타일
```

## 설치 및 실행

### 간편 설치 (권장)

#### macOS

```bash
# 설치 및 실행 스크립트 실행
./setup-mac.sh
```

#### Windows

```bash
# 설치 및 실행 스크립트 실행
setup-windows.bat
```

### 수동 설치

1. Python 환경 설정 (Python 3.9 이상 필요)

```bash
# 가상 환경 생성
python -m venv .venv

# 가상 환경 활성화 (macOS/Linux)
source .venv/bin/activate

# 가상 환경 활성화 (Windows)
.venv\Scripts\activate

# Python 패키지 설치
pip install -r requirements.txt
```

2. Node.js 의존성 설치

```bash
pnpm install
```

3. 개발 서버 실행

```bash
pnpm dev
```

### rPPG 처리 스크립트 독립 실행

테스트용으로 rPPG 처리 스크립트를 독립적으로 실행할 수 있습니다.

```bash
# macOS/Linux
python scripts/process_rppg.py <frames_directory>

# Windows
python scripts\process_rppg.py <frames_directory>
```

## 기술 스택

- Next.js
- React
- TypeScript
- Tailwind CSS
- Python (rPPG 신호 처리)

## 기여

PR 및 이슈 등록 환영합니다!

## 배포 정보

이 프로젝트는 Vercel에 최적화되어 있습니다. 배포 환경별로 다음과 같이 Python 패키지 설치가 자동화되어 있습니다:

- **Mac ARM (M1/M2/M3)**: MediaPipe 대신 OpenCV 기반 얼굴 인식 활용
- **Windows/Linux/Mac Intel**: MediaPipe 활용하여 얼굴 인식 처리
- **Python 3.12+**: 최신 SciPy 버전 사용
- **Python 3.9-3.11**: 호환 가능한 이전 버전 라이브러리 사용

자세한 내용은 `requirements.txt` 및 `vercel-build.js` 파일을 참조하세요.
