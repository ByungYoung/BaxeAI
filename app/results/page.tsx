'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { detectExpression, drawMoodMask, loadFaceDetectionModels } from '@/lib/face-detection';
import { analyzeHealthStatus, getMoodManagementTips } from '@/lib/openai-client';
import { useAppStore } from '@/lib/store';
import { MoodState } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import {
  AlertCircle,
  Camera,
  Download,
  FileText,
  Frown,
  Globe,
  ImageIcon,
  Loader2,
  Meh,
  Smile,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Extend the Window interface to include jspdf
declare global {
  interface Window {
    jspdf?: {
      addFont?: (fontBase64: string, fontName: string, fontStyle: string) => void;
    };
  }
}

function getStressLevelText(level: string): string {
  switch (level) {
    case '낮음':
      return '낮음';
    case '보통':
      return '보통';
    case '높음':
      return '높음';
    default:
      return '분석 불가';
  }
}

function getStressLevelColor(level: string): string {
  switch (level) {
    case '낮음':
      return 'text-green-500 font-medium';
    case '보통':
      return 'text-yellow-500 font-medium';
    case '높음':
      return 'text-red-500 font-medium';
    default:
      return 'text-gray-500';
  }
}

function interpretLfHf(
  lfHfRatio: number | undefined,
  lf: number | undefined,
  hf: number | undefined
): string {
  if (lfHfRatio === undefined || lf === undefined || hf === undefined) {
    return 'Focus & Recovery 지표를 해석할 수 없습니다.';
  }

  if (lfHfRatio > 2) {
    return '현재 긴장·집중 모드가 활성화되어 있어 일에 몰입하기 좋은 상태입니다. 다만, 이 상태가 오래 지속되면 피로가 쌓일 수 있으니 적절한 휴식이 필요합니다.';
  } else if (lfHfRatio < 1) {
    return '현재 휴식·회복 모드가 활성화된 상태입니다. 심신을 재충전하기에 좋은 상태이지만, 중요한 업무나 의사결정이 필요하다면 집중력을 높이는 활동이 도움될 수 있습니다.';
  } else {
    return '긴장과 휴식 사이에서 균형이 잘 잡힌 상태입니다. 현재 업무와 휴식을 적절히 병행할 수 있는 이상적인 상태입니다.';
  }
}

function calculateStressLevel(rmssd: number): string {
  if (rmssd > 50) {
    return '낮음'; // Low stress
  } else if (rmssd >= 30 && rmssd <= 50) {
    return '보통'; // Moderate stress
  } else if (rmssd < 30) {
    return '높음'; // High stress
  } else {
    return '분석 불가'; // Unable to analyze
  }
}

export default function ResultsPage() {
  const router = useRouter();
  const { currentResult, addToHistory, setCurrentResult } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [healthAnalysis, setHealthAnalysis] = useState<string | null>(null);
  const [moodTips, setMoodTips] = useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isMoodTipsLoading, setIsMoodTipsLoading] = useState(false);
  const [showFaceMask, setShowFaceMask] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<'ko' | 'en' | 'ja'>('ko');
  const [fontLoaded, setFontLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentDetection = useRef<any>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      const loaded = await loadFaceDetectionModels();
      setModelsLoaded(loaded === undefined ? false : loaded);
    };

    if (currentResult) {
      loadModels();
    }
  }, [currentResult]);

  useEffect(() => {
    if (currentResult && !healthAnalysis) {
      setIsAnalysisLoading(true);
      analyzeHealthStatus(currentResult)
        .then(analysis => {
          setHealthAnalysis(analysis);
        })
        .catch(error => {
          console.error('건강 분석 오류:', error);
          setHealthAnalysis('분석을 가져오는 중 오류가 발생했습니다.');
        })
        .finally(() => {
          setIsAnalysisLoading(false);
        });
    }

    if (currentResult?.mood && !moodTips) {
      setIsMoodTipsLoading(true);
      getMoodManagementTips(
        currentResult.mood,
        currentResult.detectedMood,
        currentResult.moodMatchScore
      )
        .then(tips => {
          setMoodTips(tips);
        })
        .catch(error => {
          console.error('팁 가져오기 오류:', error);
          setMoodTips('팁을 가져오는 중 오류가 발생했습니다.');
        })
        .finally(() => {
          setIsMoodTipsLoading(false);
        });
    }
  }, [currentResult, healthAnalysis, moodTips]);

  useEffect(() => {
    const loadFont = async () => {
      if (typeof window === 'undefined' || fontLoaded) return;

      try {
        // jsPDF에 폰트 추가
        if (pdfLanguage === 'ko' || pdfLanguage === 'ja') {
          // 직접 파일 경로를 사용하여 폰트 로드
          const fontUrl = `/fonts/NotoSansCJKkr-Regular.ttf`;

          // URL 객체로 폰트 가져오기
          const fontResponse = await fetch(fontUrl);

          if (!fontResponse.ok) {
            throw new Error(`폰트를 로드하지 못했습니다: ${fontResponse.statusText}`);
          }

          const fontData = await fontResponse.arrayBuffer();
          const fontBase64 = arrayBufferToBase64(fontData);

          // jsPDF에 폰트 등록
          const fontName = pdfLanguage === 'ko' ? 'NotoSansKR' : 'NotoSansJP';

          if (window.jspdf && window.jspdf.addFont) {
            window.jspdf.addFont(fontBase64, fontName, 'normal');
          } else {
            console.warn('jsPDF 인스턴스가 없거나 addFont 메서드를 찾을 수 없습니다');
          }
        }

        setFontLoaded(true);
      } catch (error) {
        console.error('폰트 설정 실패:', error);
        setFontLoaded(true); // 오류가 발생해도 기본 폰트로 계속 진행
      }
    };

    loadFont();
  }, [fontLoaded, pdfLanguage]);

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  };

  const startFaceMasking = async () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current || !currentResult?.mood) {
      toast({
        title: '표정 인식 준비 중',
        description: '표정 인식 모델을 로드 중입니다. 잠시 후 다시 시도하세요.',
      });
      return;
    }

    setShowFaceMask(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;

        const intervalId = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;

          try {
            const detection = await detectExpression(videoRef.current);
            currentDetection.current = detection;

            if (detection && canvasRef.current && currentResult.mood) {
              drawMoodMask(
                canvasRef.current,
                detection as any,
                currentResult.detectedMood || currentResult.mood
              );
            }
          } catch (err) {
            console.error('표정 감지 오류:', err);
          }
        }, 200);

        return () => {
          clearInterval(intervalId);
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        };
      }
    } catch (err) {
      console.error('카메라 접근 오류:', err);
      toast({
        title: '카메라 오류',
        description: '카메라에 접근할 수 없습니다. 권한을 확인해주세요.',
        variant: 'destructive',
      });
      setShowFaceMask(false);
    }
  };

  const stopFaceMasking = () => {
    setShowFaceMask(false);

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = async () => {
    if (!videoRef.current) {
      toast({
        title: '카메라 오류',
        description: '카메라가 준비되지 않았습니다.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!captureCanvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        captureCanvasRef.current = canvas;
      } else {
        captureCanvasRef.current.width = videoRef.current.videoWidth || 640;
        captureCanvasRef.current.height = videoRef.current.videoHeight || 480;
      }

      const context = captureCanvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(
          videoRef.current,
          0,
          0,
          captureCanvasRef.current.width,
          captureCanvasRef.current.height
        );
        const imageData = captureCanvasRef.current.toDataURL('image/jpeg');
        setCapturedImageData(imageData);

        toast({
          title: '이미지 캡쳐 완료',
          description: '이미지가 캡쳐되었습니다. 이제 캐리커처를 생성할 수 있습니다.',
        });
      }
    } catch (err) {
      console.error('이미지 캡쳐 오류:', err);
      toast({
        title: '캡쳐 오류',
        description: '이미지 캡쳐 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const generateCaricature = async () => {
    if (!capturedImageData) {
      toast({
        title: '이미지 없음',
        description: '먼저 이미지를 캡처해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingCaricature(true);

    try {
      const base64Data = capturedImageData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', blob, 'captured-image.jpg');

      const response = await fetch('/api/caricature', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('캐리커처 생성에 실패했습니다.');
      }

      const result = await response.json();

      if (!result.success || !result.caricatureUrl) {
        throw new Error(result.error || '캐리커처 URL을 받아오지 못했습니다.');
      }

      setCurrentResult({
        ...currentResult!,
        caricatureUrl: result.caricatureUrl,
      });

      toast({
        title: '캐리커처 생성 완료',
        description: '캐리커처 이미지가 성공적으로 생성되었습니다.',
      });
    } catch (error: any) {
      console.error('캐리커처 생성 오류:', error);
      toast({
        title: '캐리커처 생성 실패',
        description: error.message || '캐리커처 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingCaricature(false);
    }
  };

  const handleSaveResult = async () => {
    setIsSaving(true);

    try {
      addToHistory();

      const userData = currentResult?.userInfo || {
        id: '',
        email: '',
        name: '',
        company: '',
      };

      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.id,
          userEmail: userData.email,
          userName: userData.name,
          userCompany: userData.company,
          heartRate: currentResult?.heartRate,
          confidence: currentResult?.confidence,
          temperature: currentResult?.temperature, // 온도 정보 추가
          rmssd: currentResult?.hrv?.rmssd,
          sdnn: currentResult?.hrv?.sdnn,
          lf: currentResult?.hrv?.lf,
          hf: currentResult?.hrv?.hf,
          lfHfRatio: currentResult?.hrv?.lfHfRatio,
          pnn50: currentResult?.hrv?.pnn50,
          mood: currentResult?.mood,
          caricatureUrl: currentResult?.caricatureUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '측정 결과를 저장하는 데 실패했습니다.');
      }

      toast({
        title: '저장 완료',
        description: '측정 결과가 성공적으로 저장되었습니다.',
      });

      router.push('/history');
    } catch (error) {
      console.error('결과 저장 중 오류:', error);
      toast({
        title: '저장 오류',
        description:
          error instanceof Error ? error.message : '측정 결과를 저장하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePdf = async () => {
    if (!currentResult) return;

    setIsGeneratingPdf(true);

    try {
      // jsPDF 인스턴스 생성
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // PDF 언어에 따른 텍스트 설정
      const headerText =
        pdfLanguage === 'ko'
          ? 'BaxeAI 측정 결과'
          : pdfLanguage === 'ja'
            ? 'BaxeAI 測定結果'
            : 'BaxeAI Measurement Result';

      const texts = {
        date: pdfLanguage === 'ko' ? '측정일시' : pdfLanguage === 'ja' ? '測定日時' : 'Date',
        userName: pdfLanguage === 'ko' ? '사용자' : pdfLanguage === 'ja' ? 'ユーザー' : 'User',
        email: pdfLanguage === 'ko' ? '이메일' : pdfLanguage === 'ja' ? 'メール' : 'Email',
        company: pdfLanguage === 'ko' ? '소속' : pdfLanguage === 'ja' ? '所属' : 'Company',
        heartRate: pdfLanguage === 'ko' ? '심박수' : pdfLanguage === 'ja' ? '心拍数' : 'Heart Rate',
        stressLevel:
          pdfLanguage === 'ko'
            ? '스트레스 레벨'
            : pdfLanguage === 'ja'
              ? 'ストレスレベル'
              : 'Stress Level',
        mood: pdfLanguage === 'ko' ? '기분 상태' : pdfLanguage === 'ja' ? '気分' : 'Mood',
        healthAnalysis:
          pdfLanguage === 'ko'
            ? '건강 상태 분석'
            : pdfLanguage === 'ja'
              ? '健康状態分析'
              : 'Health Analysis',
        moodTips:
          pdfLanguage === 'ko'
            ? '감정 관리 추천'
            : pdfLanguage === 'ja'
              ? '気分管理のヒント'
              : 'Mood Management Tips',
        hrv:
          pdfLanguage === 'ko'
            ? '심박 변이도 상세'
            : pdfLanguage === 'ja'
              ? '心拍変動詳細'
              : 'HRV Details',
        lf:
          pdfLanguage === 'ko'
            ? 'LF (저주파)'
            : pdfLanguage === 'ja'
              ? 'LF (低周波)'
              : 'LF (Low Frequency)',
        hf:
          pdfLanguage === 'ko'
            ? 'HF (고주파)'
            : pdfLanguage === 'ja'
              ? 'HF (高周波)'
              : 'HF (High Frequency)',
        lfHfRatio:
          pdfLanguage === 'ko' ? 'LF/HF 비율' : pdfLanguage === 'ja' ? 'LF/HF 比率' : 'LF/HF Ratio',
        rmssd: pdfLanguage === 'ko' ? 'RMSSD' : pdfLanguage === 'ja' ? 'RMSSD' : 'RMSSD',
        sdnn: pdfLanguage === 'ko' ? 'SDNN' : pdfLanguage === 'ja' ? 'SDNN' : 'SDNN',
        pnn50: pdfLanguage === 'ko' ? 'PNN50' : pdfLanguage === 'ja' ? 'PNN50' : 'PNN50',
        disclaimer:
          pdfLanguage === 'ko'
            ? '※ 본 분석은 참고용 정보이며, 의학적 진단을 대체하지 않습니다.'
            : pdfLanguage === 'ja'
              ? '※ この分析は参考情報であり、医学的診断に代わるものではありません。'
              : '※ This analysis is for reference only and does not replace medical diagnosis.',
      };

      const moodText = {
        happy: pdfLanguage === 'ko' ? '행복함' : pdfLanguage === 'ja' ? '幸せ' : 'Happy',
        sad: pdfLanguage === 'ko' ? '우울함' : pdfLanguage === 'ja' ? '落ち込み' : 'Sad',
        stressed:
          pdfLanguage === 'ko' ? '스트레스' : pdfLanguage === 'ja' ? 'ストレス' : 'Stressed',
        relaxed: pdfLanguage === 'ko' ? '편안함' : pdfLanguage === 'ja' ? 'リラックス' : 'Relaxed',
        neutral: pdfLanguage === 'ko' ? '보통' : pdfLanguage === 'ja' ? '普通' : 'Neutral',
      };

      const stressLevelText = {
        낮음: pdfLanguage === 'ko' ? '낮음' : pdfLanguage === 'ja' ? '低い' : 'Low',
        보통: pdfLanguage === 'ko' ? '보통' : pdfLanguage === 'ja' ? '普通' : 'Moderate',
        높음: pdfLanguage === 'ko' ? '높음' : pdfLanguage === 'ja' ? '高い' : 'High',
        '분석 불가':
          pdfLanguage === 'ko'
            ? '분석 불가'
            : pdfLanguage === 'ja'
              ? '分析不可'
              : 'Unable to analyze',
      };

      // 파일명 설정
      const fileName =
        pdfLanguage === 'ko'
          ? `BaxeAI_측정결과_${new Date().toISOString().split('T')[0]}.pdf`
          : pdfLanguage === 'ja'
            ? `BaxeAI_測定結果_${new Date().toISOString().split('T')[0]}.pdf`
            : `BaxeAI_Result_${new Date().toISOString().split('T')[0]}.pdf`;

      // PDF 여백 설정
      const margin = 20;
      const pageWidth = 210;
      const contentWidth = pageWidth - margin * 2;

      // 헤더 추가
      pdf.setFontSize(20);
      pdf.text(headerText, pageWidth / 2, margin, { align: 'center' });

      // 기본 폰트 설정
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);

      // 날짜 및 사용자 기본 정보 추가
      const measurementDate = new Date(currentResult.timestamp).toLocaleString(
        pdfLanguage === 'ko' ? 'ko-KR' : pdfLanguage === 'ja' ? 'ja-JP' : 'en-US'
      );

      let yPos = margin + 15;
      const lineHeight = 8;

      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);
      pdf.text('1. ' + texts.date, margin, yPos);
      pdf.text(measurementDate, margin + 60, yPos);
      yPos += lineHeight + 2;

      pdf.text('2. ' + texts.userName, margin, yPos);
      pdf.text(currentResult.userInfo?.name || '-', margin + 60, yPos);
      yPos += lineHeight;

      pdf.text('   ' + texts.email, margin, yPos);
      pdf.text(currentResult.userInfo?.email || '-', margin + 60, yPos);
      yPos += lineHeight;

      pdf.text('   ' + texts.company, margin, yPos);
      pdf.text(currentResult.userInfo?.company || '-', margin + 60, yPos);
      yPos += lineHeight * 2;

      // 심박수 및 스트레스 레벨
      pdf.setFontSize(14);
      pdf.setTextColor(40, 40, 40);
      pdf.text('● ' + texts.heartRate + ' & ' + texts.stressLevel, margin, yPos);
      yPos += lineHeight + 2;

      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);

      pdf.text(
        texts.heartRate +
          ': ' +
          (typeof currentResult.heartRate === 'number' ? currentResult.heartRate.toFixed(1) : '0') +
          ' BPM',
        margin + 10,
        yPos
      );
      yPos += lineHeight;

      // 온도 정보 추가
      if (currentResult.temperature) {
        const temperatureText =
          pdfLanguage === 'ko' ? '체온' : pdfLanguage === 'ja' ? '体温' : 'Temperature';
        pdf.text(
          temperatureText + ': ' + currentResult.temperature.toFixed(1) + '°C',
          margin + 10,
          yPos
        );
        yPos += lineHeight;
      }

      const stressLevel =
        currentResult.hrv && currentResult.hrv.rmssd !== undefined
          ? calculateStressLevel(currentResult.hrv.rmssd)
          : '분석 불가';

      pdf.text(
        texts.stressLevel +
          ': ' +
          (stressLevel in stressLevelText
            ? stressLevelText[stressLevel as keyof typeof stressLevelText]
            : stressLevelText['분석 불가']),
        margin + 10,
        yPos
      );
      yPos += lineHeight;

      pdf.text(
        texts.mood +
          ': ' +
          (currentResult.mood && currentResult.mood in moodText
            ? moodText[currentResult.mood as keyof typeof moodText]
            : '-'),
        margin + 10,
        yPos
      );
      yPos += lineHeight * 2;

      // 이미지가 있을 경우 캐리커처 추가
      if (currentResult.caricatureUrl) {
        pdf.setFontSize(14);
        pdf.setTextColor(40, 40, 40);

        const caricatureTitle =
          pdfLanguage === 'ko'
            ? '● BaxeAI 캐리커처'
            : pdfLanguage === 'ja'
              ? '● BaxeAI キャリカチュア'
              : '● BaxeAI Caricature';

        pdf.text(caricatureTitle, margin, yPos);
        yPos += lineHeight + 2;

        try {
          // 이미지 추가 시도
          const imgWidth = 70;
          const imgHeight = 70;
          const imgX = (pageWidth - imgWidth) / 2;

          // 캐리커처를 PDF에 추가
          // 참고: 실제 이미지 URL에서 이미지를 가져와서 추가하는 코드가 필요합니다.
          // 이 부분은 서버에서 이미지를 가져오는 작업이 필요하며 현재 구현상 제한이 있습니다.
          // 대신 이미지가 있음을 안내하고 이동
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);

          const caricatureMessage =
            pdfLanguage === 'ko'
              ? '(캐리커처 이미지는 별도로 저장하여 확인해주세요)'
              : pdfLanguage === 'ja'
                ? '(キャリカチュア画像は別途保存してご確認ください)'
                : '(Please save the caricature image separately for viewing)';

          pdf.text(caricatureMessage, margin + 10, yPos);
          yPos += lineHeight * 3;
        } catch (err) {
          console.error('PDF에 이미지 추가 중 오류:', err);
          pdf.text('Image could not be added', margin + 10, yPos);
          yPos += lineHeight * 2;
        }
      }

      // 건강 상태 분석
      pdf.setFontSize(14);
      pdf.setTextColor(40, 40, 40);
      pdf.text('● ' + texts.healthAnalysis, margin, yPos);
      yPos += lineHeight + 2;

      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      // 건강 분석을 여러 줄로 나누어 표시
      const healthAnalysisText =
        healthAnalysis ||
        (pdfLanguage === 'ko'
          ? '건강 상태 분석 정보가 없습니다.'
          : pdfLanguage === 'ja'
            ? '健康状態分析情報がありません。'
            : 'No health analysis information available.');

      // 너무 긴 텍스트를 여러 줄로 분리하고 페이지 경계 확인
      const splitHealthText = pdf.splitTextToSize(healthAnalysisText, contentWidth - 20);

      // 새 페이지가 필요한지 확인 (현재 위치 + 텍스트 높이가 페이지 끝에 가까우면)
      if (yPos + splitHealthText.length * lineHeight + 20 > 270) {
        pdf.addPage();
        yPos = margin; // 새 페이지에서 시작 위치 초기화
        // 제목 다시 추가
        pdf.setFontSize(14);
        pdf.setTextColor(40, 40, 40);
        pdf.text('● ' + texts.healthAnalysis + ' (계속)', margin, yPos);
        yPos += lineHeight + 2;
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
      }

      pdf.text(splitHealthText, margin + 10, yPos);
      yPos += splitHealthText.length * lineHeight + 5;

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(texts.disclaimer, margin + 10, yPos);
      yPos += lineHeight * 2;

      // 감정 관리 추천
      pdf.setFontSize(14);
      pdf.setTextColor(40, 40, 40);
      pdf.text('● ' + texts.moodTips, margin, yPos);
      yPos += lineHeight + 2;

      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      // 감정 관리 팁을 여러 줄로 나누어 표시
      const moodTipsText =
        moodTips ||
        (pdfLanguage === 'ko'
          ? '감정 관리 추천 정보가 없습니다.'
          : pdfLanguage === 'ja'
            ? '感情管理のヒント情報がありません。'
            : 'No mood management tips available.');

      // 너무 긴 텍스트를 여러 줄로 분리
      const splitMoodText = pdf.splitTextToSize(moodTipsText, contentWidth - 20);

      // 새 페이지가 필요한지 확인 (보다 엄격한 기준 적용)
      if (yPos + splitMoodText.length * lineHeight + 20 > 270) {
        pdf.addPage();
        yPos = margin;
        // 제목 다시 추가
        pdf.setFontSize(14);
        pdf.setTextColor(40, 40, 40);
        pdf.text('● ' + texts.moodTips + ' (계속)', margin, yPos);
        yPos += lineHeight + 2;
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
      }

      pdf.text(splitMoodText, margin + 10, yPos);
      yPos += splitMoodText.length * lineHeight + 10;

      // HRV 데이터가 있으면 표시
      if (currentResult.hrv) {
        // 새 페이지가 필요한지 확인
        if (yPos + 80 > 280) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.setFontSize(14);
        pdf.setTextColor(40, 40, 40);
        pdf.text('● ' + texts.hrv, margin, yPos);
        yPos += lineHeight + 2;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);

        // LF, HF, LF/HF 비율 표시
        pdf.text('- ' + texts.lf + ':', margin + 10, yPos);
        pdf.text(
          currentResult.hrv?.lf !== undefined && currentResult.hrv?.lf !== null
            ? `${Number(currentResult.hrv.lf).toFixed(2)} ms²`
            : '-',
          margin + 70,
          yPos
        );
        yPos += lineHeight;

        pdf.text('- ' + texts.hf + ':', margin + 10, yPos);
        pdf.text(
          currentResult.hrv?.hf !== undefined && currentResult.hrv?.hf !== null
            ? `${Number(currentResult.hrv.hf).toFixed(2)} ms²`
            : '-',
          margin + 70,
          yPos
        );
        yPos += lineHeight;

        pdf.text('- ' + texts.lfHfRatio + ':', margin + 10, yPos);
        pdf.text(
          currentResult.hrv?.lfHfRatio !== undefined && currentResult.hrv?.lfHfRatio !== null
            ? Number(currentResult.hrv.lfHfRatio).toFixed(2)
            : '-',
          margin + 70,
          yPos
        );
        yPos += lineHeight + 5;

        // RMSSD, SDNN, PNN50 표시
        pdf.text('- ' + texts.rmssd + ':', margin + 10, yPos);
        pdf.text(
          currentResult.hrv?.rmssd !== undefined && currentResult.hrv?.rmssd !== null
            ? Number(currentResult.hrv.rmssd).toFixed(2)
            : '-',
          margin + 70,
          yPos
        );
        yPos += lineHeight;

        pdf.text('- ' + texts.sdnn + ':', margin + 10, yPos);
        pdf.text(
          currentResult.hrv?.sdnn !== undefined && currentResult.hrv?.sdnn !== null
            ? Number(currentResult.hrv.sdnn).toFixed(2)
            : '-',
          margin + 70,
          yPos
        );
        yPos += lineHeight;

        pdf.text('- ' + texts.pnn50 + ':', margin + 10, yPos);
        pdf.text(
          currentResult.hrv?.pnn50 !== undefined && currentResult.hrv?.pnn50 !== null
            ? Number(currentResult.hrv.pnn50).toFixed(2) + '%'
            : '-',
          margin + 70,
          yPos
        );
        yPos += lineHeight + 5;

        // 자율신경계 해석 추가
        const nervousSystemAnalysis = interpretLfHf(
          currentResult.hrv?.lfHfRatio,
          currentResult.hrv?.lf,
          currentResult.hrv?.hf
        );

        const nervousSystemTitle =
          pdfLanguage === 'ko'
            ? '자율신경계 해석:'
            : pdfLanguage === 'ja'
              ? '自律神経系の解釈:'
              : 'Autonomic Nervous System Interpretation:';

        pdf.text(nervousSystemTitle, margin + 10, yPos);
        yPos += lineHeight;

        const translatedAnalysis =
          pdfLanguage === 'ko'
            ? nervousSystemAnalysis
            : pdfLanguage === 'ja'
              ? nervousSystemAnalysis
                  .replace(
                    '현재 긴장·집중 모드가 활성화되어 있어 일에 몰입하기 좋은 상태입니다. 다만, 이 상태가 오래 지속되면 피로가 쌓일 수 있으니 적절한 휴식이 필요합니다.',
                    '現在緊張・集中モードが活性化されており、仕事に没頭しやすい状態です。ただし、この状態が長く続くと疲労が蓄積する可能性があるため、適切な休息が必要です。'
                  )
                  .replace(
                    '현재 휴식·회복 모드가 활성화된 상태입니다. 심신을 재충전하기에 좋은 상태이지만, 중요한 업무나 의사결정이 필요하다면 집중력을 높이는 활동이 도움될 수 있습니다.',
                    '現在休息・回復モードが活性化された状態です。心身をリフレッシュするのに良い状態ですが、重要な業務や意思決定が必要な場合は集中力を高める活動が役立つ可能性があります。'
                  )
                  .replace(
                    '긴장과 휴식 사이에서 균형이 잘 잡힌 상태입니다. 현재 업무와 휴식을 적절히 병行할 수 있는 이상적인 상태입니다。',
                    '緊張と休息の間でバランスが取れている状態です。現在、業務と休息を適切に両立できる理想的な状態です。'
                  )
                  .replace(
                    'Focus & Recovery 지표를 해석할 수 없습니다.',
                    'Focus & Recovery 指標を解釈することができません。'
                  )
              : nervousSystemAnalysis
                  .replace(
                    '현재 긴장·집중 모드가 활성화되어 있어 일에 몰입하기 좋은 상태입니다. 다만, 이 상태가 오래 지속되면 피로가 쌓일 수 있으니 적절한 휴식이 필요합니다.',
                    'Currently in tension and focus mode, ideal for work immersion. However, prolonged state may lead to fatigue, requiring proper rest.'
                  )
                  .replace(
                    '현재 휴식·회복 모드가 활성화된 상태입니다. 심신을 재충전하기에 좋은 상태이지만, 중요한 업무나 의사결정이 필요하다면 집중력을 높이는 활동이 도움될 수 있습니다.',
                    'Currently in rest and recovery mode, ideal for recharging. For critical tasks or decisions, activities to boost focus may help.'
                  )
                  .replace(
                    '긴장과 휴식 사이에서 균형이 잘 잡힌 상태입니다. 현재 업무와 휴식을 적절히 병행할 수 있는 이상적인 상태입니다.',
                    'Balanced between tension and rest, ideal for combining work and relaxation effectively.'
                  )
                  .replace(
                    'Focus & Recovery 지표를 해석할 수 없습니다.',
                    'Unable to interpret Focus & Recovery indicator.'
                  );

        const splitAnalysisText = pdf.splitTextToSize(translatedAnalysis, contentWidth - 40);
        pdf.text(splitAnalysisText, margin + 20, yPos);
      }

      // 푸터 추가
      const footerText =
        pdfLanguage === 'ko'
          ? 'BaxeAI에서 생성된 보고서 - ' + new Date().toLocaleDateString('ko-KR')
          : pdfLanguage === 'ja'
            ? 'BaxeAIで生成されたレポート - ' + new Date().toLocaleDateString('ja-JP')
            : 'Report generated by BaxeAI - ' + new Date().toLocaleDateString('en-US');

      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(footerText, pageWidth / 2, 287, { align: 'center' });

      // PDF 저장
      pdf.save(fileName);

      toast({
        title:
          pdfLanguage === 'ko'
            ? 'PDF 저장 완료'
            : pdfLanguage === 'ja'
              ? 'PDF 保存完了'
              : 'PDF saved successfully',
        description:
          pdfLanguage === 'ko'
            ? `${fileName} 파일이 저장되었습니다.`
            : pdfLanguage === 'ja'
              ? `ファイル ${fileName} が保存されました。`
              : `File ${fileName} has been saved.`,
      });
    } catch (error) {
      toast({
        title:
          pdfLanguage === 'ko'
            ? 'PDF 저장 실패'
            : pdfLanguage === 'ja'
              ? 'PDF 保存失敗'
              : 'PDF save failed',
        description:
          pdfLanguage === 'ko'
            ? '결과를 PDF로 저장하는데 문제가 발생했습니다.'
            : pdfLanguage === 'ja'
              ? '結果をPDFとして保存する際に問題が発生しました。'
              : 'There was a problem saving the result as PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleMeasureAgain = () => {
    router.push('/measure');
  };

  const getMoodIcon = (mood?: MoodState) => {
    switch (mood) {
      case 'happy':
        return <Smile className="h-5 w-5 text-green-500" />;
      case 'sad':
        return <Frown className="h-5 w-5 text-blue-500" />;
      case 'stressed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'relaxed':
        return <Smile className="h-5 w-5 text-teal-500" />;
      default:
        return <Meh className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMoodText = (mood?: MoodState): string => {
    switch (mood) {
      case 'happy':
        return '행복함';
      case 'sad':
        return '우울함';
      case 'stressed':
        return '스트레스';
      case 'relaxed':
        return '편안함';
      case 'neutral':
        return '보통';
      default:
        return '알 수 없음';
    }
  };

  if (!currentResult) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">측정 결과가 없습니다</h1>
        <p className="text-gray-600 mb-6">먼저 심박수를 측정해주세요</p>
        <Button onClick={() => router.push('/measure')}>측정하러 가기</Button>
      </div>
    );
  }

  const heartRate = typeof currentResult.heartRate === 'number' ? currentResult.heartRate : 0;
  const confidence = typeof currentResult.confidence === 'number' ? currentResult.confidence : 0;

  // 스트레스 레벨 계산
  const stressLevel =
    currentResult.hrv && currentResult.hrv.rmssd !== undefined
      ? calculateStressLevel(currentResult.hrv.rmssd)
      : '분석 불가';

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Baxe AI 측정 결과</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>
                  {pdfLanguage === 'ko' ? '한국어' : pdfLanguage === 'ja' ? '日本語' : 'English'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>PDF 언어 선택</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPdfLanguage('ko')}>한국어</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPdfLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPdfLanguage('ja')}>日本語</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={handleSavePdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {pdfLanguage === 'ko'
                  ? '저장 중...'
                  : pdfLanguage === 'ja'
                    ? '保存中...'
                    : 'Saving...'}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {pdfLanguage === 'ko' ? 'PDF 저장' : pdfLanguage === 'ja' ? 'PDF 保存' : 'Save PDF'}
              </>
            )}
          </Button>
        </div>
      </div>

      <div ref={resultRef}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">측정시간</span>
                  <span>
                    {formatDistanceToNow(new Date(currentResult.timestamp), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">사용자 이름</span>
                  <span>{currentResult.userInfo?.name || '이름없음'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">이메일</span>
                  <span>{currentResult.userInfo?.email || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">소속</span>
                  <span>{currentResult.userInfo?.company || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>측정 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">심박수</span>
                  <span>{heartRate.toFixed(1)} BPM</span>
                </div>
                {currentResult.temperature !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">체온</span>
                    <span>{currentResult.temperature.toFixed(1)} °C</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">스트레스 레벨</span>
                  <span className={getStressLevelColor(stressLevel)}>
                    {getStressLevelText(stressLevel)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">기분 상태</span>
                  <span className="flex items-center gap-2">
                    {getMoodIcon(currentResult.mood)}
                    {getMoodText(currentResult.mood)}
                  </span>
                </div>

                {currentResult.detectedMood && (
                  <>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-gray-500">감지된 표정</span>
                      <span className="flex items-center gap-2">
                        {getMoodIcon(currentResult.detectedMood)}
                        {getMoodText(currentResult.detectedMood)}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">선택한 기분과 표정 일치도</span>
                        <span className="font-medium">{currentResult.moodMatchScore || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${currentResult.moodMatchScore || 0}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {currentResult.moodMatchScore && currentResult.moodMatchScore > 70
                          ? '매우 높은 일치도: 표정과 선택된 기분이 일치합니다.'
                          : currentResult.moodMatchScore && currentResult.moodMatchScore > 40
                            ? '보통 일치도: 표정과 선택된 기분이 어느 정도 일치합니다.'
                            : '낮은 일치도: 표정과 선택된 기분이 다르게 나타납니다.'}
                      </p>
                    </div>
                  </>
                )}

                <div className="flex justify-center mt-3">
                  {!showFaceMask ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startFaceMasking}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      카메라 시작하기
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopFaceMasking}
                      className="w-full"
                    >
                      표정 마스킹 중지
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>BaxeAI 캐리커처</CardTitle>
            </CardHeader>
            <CardContent>
              {currentResult.caricatureUrl ? (
                <div className="flex flex-col items-center">
                  <div className="relative aspect-square w-full max-w-md bg-gray-200 rounded-lg overflow-hidden">
                    <Image
                      src={currentResult.caricatureUrl}
                      alt="캐리커처 이미지"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-4">
                    BaxeAI가 생성한 개성있는 캐리커처 이미지입니다.
                  </p>
                </div>
              ) : showFaceMask ? (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-contain z-10"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full object-contain z-20"
                    />
                  </div>

                  {capturedImageData ? (
                    <div className="mt-4">
                      <p className="text-center text-sm mb-2">캡쳐된 이미지:</p>
                      <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden">
                        <Image
                          src={capturedImageData}
                          alt="캡쳐한 이미지"
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" size="sm" onClick={captureImage}>
                      <Camera className="h-4 w-4 mr-2" />
                      이미지 캡쳐
                    </Button>
                    <Button
                      size="sm"
                      onClick={generateCaricature}
                      disabled={!capturedImageData || isGeneratingCaricature}
                    >
                      {isGeneratingCaricature ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          캐리커처 생성
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-10">
                  <ImageIcon className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">캐리커처 만들기</h3>
                  <p className="text-gray-500 mb-6">
                    표정 마스킹을 시작하고 이미지를 캡처하여 AI 캐리커처를 생성해보세요.
                  </p>
                  <Button onClick={startFaceMasking}>
                    <Camera className="h-4 w-4 mr-2" />
                    카메라 시작하기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {showFaceMask && !currentResult.caricatureUrl && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>표정 마스킹</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain z-10"
                    style={{ display: 'none' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-contain z-20"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {currentResult.detectedMood
                    ? `감지된 표정 '${getMoodText(
                        currentResult.detectedMood
                      )}'에 대한 마스킹입니다.`
                    : `선택한 기분 '${getMoodText(currentResult.mood)}'에 대한 마스킹입니다.`}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {currentResult.hrv && (
          <>
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Focus & Recovery Index</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">
                        <span className="inline-block mr-2">⚡</span>
                        LF(저주파) : 긴장,집중 모드
                      </span>
                      <span className="text-blue-600 font-bold text-xl">
                        {currentResult.hrv?.lf !== undefined && currentResult.hrv?.lf !== null
                          ? `${Number(currentResult.hrv.lf).toFixed(2)} ms²`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">
                        <span className="inline-block mr-2">💧</span>
                        HF(고주파) : 휴식,회복 모드
                      </span>
                      <span className="text-green-600 font-bold text-xl">
                        {currentResult.hrv?.hf !== undefined && currentResult.hrv?.hf !== null
                          ? `${Number(currentResult.hrv.hf).toFixed(2)} ms²`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-gray-500 font-medium">
                        <span className="inline-block mr-2">⚖️</span>
                        LF/HF 비율 : Balance Score
                      </span>
                      <span className="text-purple-600 font-bold text-xl">
                        {currentResult.hrv?.lfHfRatio !== undefined &&
                        currentResult.hrv?.lfHfRatio !== null
                          ? Number(currentResult.hrv.lfHfRatio).toFixed(2)
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-4">
                    ※ LF는 긴장·집중 모드를, HF는 휴식·회복 모드를 나타냅니다. LF/HF 비율이 높으면
                    긴장·집중 모드가 상대적으로 활성화된 상태입니다.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stress Insight</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p>
                      {interpretLfHf(
                        currentResult.hrv?.lfHfRatio,
                        currentResult.hrv?.lf,
                        currentResult.hrv?.hf
                      )}
                    </p>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-gray-500 font-medium">스트레스 레벨</span>
                      <span className={getStressLevelColor(stressLevel)}>
                        {getStressLevelText(stressLevel)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Baxe AI 분석 상세지표</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>지표</TableHead>
                      <TableHead>값</TableHead>
                      <TableHead>설명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>RMSSD</TableCell>
                      <TableCell>
                        {currentResult.hrv?.rmssd !== undefined && currentResult.hrv?.rmssd !== null
                          ? Number(currentResult.hrv.rmssd).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        오늘 당신이 스트레스에서 얼마나 빨리 회복할 수 있는지 보여주는 민첩성 점수
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>SDNN</TableCell>
                      <TableCell>
                        {currentResult.hrv?.sdnn !== undefined && currentResult.hrv?.sdnn !== null
                          ? Number(currentResult.hrv.sdnn).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        하루 종일 마음이 안정적으로 유지됐는지 알려주는 균형 지수
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>LF</TableCell>
                      <TableCell>
                        {currentResult.hrv?.lf !== undefined && currentResult.hrv?.lf !== null
                          ? Number(currentResult.hrv.lf).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        지금 몸이 긴장·집중 모드에 올라온 정도 (시험·발표 직전처럼)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>HF</TableCell>
                      <TableCell>
                        {currentResult.hrv?.hf !== undefined && currentResult.hrv?.hf !== null
                          ? Number(currentResult.hrv.hf).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        지금 몸이 휴식·회복 모드에 들어간 정도 (편하게 쉬는 상태)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>LF/HF 비율</TableCell>
                      <TableCell>
                        {currentResult.hrv?.lfHfRatio !== undefined &&
                        currentResult.hrv?.lfHfRatio !== null
                          ? Number(currentResult.hrv.lfHfRatio).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell>긴장과 휴식이 어느 쪽으로 기울었는지 한눈에 보는 저울값</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>PNN50</TableCell>
                      <TableCell>
                        {currentResult.hrv?.pnn50 !== undefined && currentResult.hrv?.pnn50 !== null
                          ? Number(currentResult.hrv.pnn50).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        오늘 하루, 내 몸이 상황에 따라 속도를 자연스럽게 바꾼 횟수 비율
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Mind Snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {isAnalysisLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div>
                        {healthAnalysis ? (
                          <p className="text-sm">{healthAnalysis}</p>
                        ) : (
                          <Skeleton className="h-20 w-full" />
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Instant Action</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {isMoodTipsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div>
                        {moodTips ? (
                          <p className="text-sm">{moodTips}</p>
                        ) : (
                          <Skeleton className="h-20 w-full" />
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="flex justify-center gap-4 mt-10">
          <Button
            variant="outline"
            onClick={handleMeasureAgain}
            disabled={isSaving || isGeneratingPdf}
          >
            {pdfLanguage === 'ko'
              ? '다시 측정하기'
              : pdfLanguage === 'ja'
                ? '再測定する'
                : 'Measure Again'}
          </Button>
          <Button onClick={handleSaveResult} disabled={isSaving || isGeneratingPdf}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {pdfLanguage === 'ko'
                  ? '저장 중...'
                  : pdfLanguage === 'ja'
                    ? '保存中...'
                    : 'Saving...'}
              </>
            ) : pdfLanguage === 'ko' ? (
              '결과 저장하기'
            ) : pdfLanguage === 'ja' ? (
              '結果を保存する'
            ) : (
              'Save Result'
            )}
          </Button>
          <Button variant="secondary" onClick={handleSavePdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {pdfLanguage === 'ko'
                  ? 'PDF 생성 중...'
                  : pdfLanguage === 'ja'
                    ? 'PDF 作成中...'
                    : 'Generating PDF...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {pdfLanguage === 'ko'
                  ? 'PDF로 저장'
                  : pdfLanguage === 'ja'
                    ? 'PDFとして保存'
                    : 'Save as PDF'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
