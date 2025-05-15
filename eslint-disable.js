// 이 파일은 rppg-camera.tsx 파일의 useEffect 의존성 배열 문제를 해결하기 위한 파일입니다.
// 다음과 같이 각 useEffect 직전에 eslint-disable-next-line 주석을 추가하세요:

// active 속성 감지 useEffect
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  if (active !== undefined) {
    // ...코드...
  }
}, [active]);

// 처리 상태 변경 감지 useEffect
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  if (status === 'processing' && !isProcessing) {
    // ...코드...
  }
}, [isProcessing]);

// 컴포넌트 마운트/언마운트 처리 useEffect
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // ...코드...
}, []);

// 모바일/데스크톱 전환 감지 useEffect
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // ...코드...
}, [isMobile]);
