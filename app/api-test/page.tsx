'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRef, useState } from 'react';

/**
 * Renders a client-side page for testing the caricature generation API, allowing users to upload an image, select a mood, and enter a user name to generate a caricature.
 *
 * Provides an interface for uploading an image file, previewing it, selecting a mood, and submitting the data to the `/api/caricature` endpoint. Displays the API response, including the generated caricature image if available, and indicates whether the image was AI-generated or a fallback.
 */
export default function ApiTestPage() {
  const [image, setImage] = useState<File | null>(null);
  const [mood, setMood] = useState<string>('neutral');
  const [userName, setUserName] = useState<string>('테스트 사용자');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setImage(selectedFile);

      // 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onload = e => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      alert('이미지를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('image', image);
    formData.append('mood', mood);
    formData.append('userName', userName);

    try {
      const response = await fetch('/api/caricature', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('API 호출 오류:', error);
      setResult({ error: '오류가 발생했습니다.', success: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setImagePreview(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">캐리커처 API 테스트</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API 입력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">이미지 업로드</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="mt-2 relative w-full h-64 rounded-md overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="object-cover w-full h-full" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mood">기분 선택</Label>
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger>
                  <SelectValue placeholder="기분 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="happy">행복함</SelectItem>
                  <SelectItem value="sad">슬픔</SelectItem>
                  <SelectItem value="stressed">스트레스</SelectItem>
                  <SelectItem value="relaxed">편안함</SelectItem>
                  <SelectItem value="neutral">중립</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName">사용자 이름</Label>
              <Input id="userName" value={userName} onChange={e => setUserName(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isLoading || !image}>
              {isLoading ? '처리 중...' : '캐리커처 생성'}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              초기화
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>

                {result.success && result.caricatureUrl && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">생성된 캐리커처:</h3>
                    <div className="relative w-full h-80 rounded-md overflow-hidden border">
                      <img
                        src={result.caricatureUrl}
                        alt="Generated Caricature"
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {result.isAiGenerated ? 'AI로 생성됨' : '폴백 이미지 사용됨'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !result && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                API 호출 결과가 여기에 표시됩니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
