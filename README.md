# rpgg-camera

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

1. 의존성 설치

```bash
pnpm install
```

2. 개발 서버 실행

```bash
pnpm dev
```

3. (선택) rPPG 처리 Python 스크립트 실행

```bash
python scripts/process_rppg.py
```

## 기술 스택

- Next.js
- React
- TypeScript
- Tailwind CSS
- Python (rPPG 신호 처리)

## 기여

PR 및 이슈 등록 환영합니다!
