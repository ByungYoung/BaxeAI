from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import base64
import time

# Vercel 무료 티어의 패키지 크기 제한 대응을 위해 최적화된 임포트
try:
    import numpy as np
except ImportError:
    print("WARNING: numpy import failed, falling back to minimal mode")
    np = None

try:
    import cv2
except ImportError:
    print("WARNING: cv2 import failed, falling back to minimal mode")
    cv2 = None

try:
    from scipy import signal
    from scipy.signal import detrend
except ImportError:
    print("WARNING: scipy import failed, falling back to minimal mode")
    signal = None
    detrend = None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)
        
        # 입력 데이터 검증
        if 'frames' not in data:
            self.send_error_response("No frames data provided")
            return
            
        try:
            # 프레임 데이터 처리 (예시: 배열 형태의 RGB 값 가정)
            frames = np.array(data['frames'])
            
            if len(frames) < 10:
                self.send_error_response("Not enough frames for analysis (minimum 10)")
                return
            
            # RGB 신호 추출
            r_values = frames[:, 0].mean(axis=(1, 2)) if frames.ndim > 3 else frames[:, 0].mean()
            g_values = frames[:, 1].mean(axis=(1, 2)) if frames.ndim > 3 else frames[:, 1].mean()
            b_values = frames[:, 2].mean(axis=(1, 2)) if frames.ndim > 3 else frames[:, 2].mean()
            
            # 신호 전처리
            r_detrended = detrend(r_values)
            g_detrended = detrend(g_values)
            b_detrended = detrend(b_values)
            
            # 정규화
            r_normalized = (r_detrended - np.mean(r_detrended)) / np.std(r_detrended)
            g_normalized = (g_detrended - np.mean(g_detrended)) / np.std(g_detrended)
            b_normalized = (b_detrended - np.mean(b_detrended)) / np.std(b_detrended)
            
            # POS 알고리즘 적용 (간소화)
            X = np.vstack([r_normalized, g_normalized, b_normalized])
            S = np.array([[0, 1, -1], [-2, 1, 1]])
            P = np.dot(S, X)
            pos_signal = P[0, :] + ((np.std(P[0, :]) / np.std(P[1, :])) * P[1, :])
            
            # 심박수 계산
            fps = data.get('fps', 30)  # 기본 FPS = 30
            low_cutoff = 0.7  # 42 BPM
            high_cutoff = 4.0  # 240 BPM
            nyquist = fps / 2
            b, a = signal.butter(3, [low_cutoff/nyquist, high_cutoff/nyquist], btype='band')
            filtered_signal = signal.filtfilt(b, a, pos_signal)
            
            # FFT로 주파수 분석
            fft_size = len(filtered_signal)
            fft_result = np.abs(np.fft.rfft(filtered_signal))
            freqs = np.fft.rfftfreq(fft_size, d=1.0/fps)
            
            # 심박수 추출
            mask = (freqs >= 0.7) & (freqs <= 4.0)
            if np.any(mask):
                idx = np.argmax(fft_result[mask])
                dominant_freq = freqs[mask][idx]
                heart_rate = dominant_freq * 60  # BPM으로 변환
                
                # 신뢰도 계산
                max_amplitude = fft_result[mask][idx]
                total_power = np.sum(fft_result[mask])
                confidence = float(max_amplitude / total_power if total_power > 0 else 0)
                
                # 결과 반환
                result = {
                    "heartRate": float(heart_rate),
                    "confidence": confidence,
                    "processed": True
                }
            else:
                result = {
                    "error": "No valid frequency components found",
                    "heartRate": 0,
                    "confidence": 0,
                    "processed": False
                }
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error_response(f"Error processing frames: {str(e)}")
            
    def do_GET(self):
        # 간단한 서버 상태 확인용 GET 엔드포인트
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "status": "online",
            "version": "1.0",
            "python_version": sys.version,
            "opencv_version": cv2.__version__,
            "numpy_version": np.__version__,
            "environment": {
                "vercel": os.environ.get("VERCEL") == "1"
            }
        }
        
        self.wfile.write(json.dumps(response).encode())
        
    def send_error_response(self, message):
        self.send_response(400)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode())

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        # 기존 분석 코드 복사 (frames 처리, 심박수 계산 등)
        frames = np.array(data['frames'])
        if len(frames) < 10:
            print(json.dumps({"error": "Not enough frames for analysis (minimum 10)", "processed": False}))
            sys.exit(0)
        r_values = frames[:, 0].mean(axis=(1, 2)) if frames.ndim > 3 else frames[:, 0].mean()
        g_values = frames[:, 1].mean(axis=(1, 2)) if frames.ndim > 3 else frames[:, 1].mean()
        b_values = frames[:, 2].mean(axis=(1, 2)) if frames.ndim > 3 else frames[:, 2].mean()
        r_detrended = detrend(r_values)
        g_detrended = detrend(g_values)
        b_detrended = detrend(b_values)
        r_normalized = (r_detrended - np.mean(r_detrended)) / np.std(r_detrended)
        g_normalized = (g_detrended - np.mean(g_detrended)) / np.std(g_detrended)
        b_normalized = (b_detrended - np.mean(b_detrended)) / np.std(b_detrended)
        X = np.vstack([r_normalized, g_normalized, b_normalized])
        S = np.array([[0, 1, -1], [-2, 1, 1]])
        P = np.dot(S, X)
        pos_signal = P[0, :] + ((np.std(P[0, :]) / np.std(P[1, :])) * P[1, :])
        fps = data.get('fps', 30)
        low_cutoff = 0.7
        high_cutoff = 4.0
        nyquist = fps / 2
        b, a = signal.butter(3, [low_cutoff/nyquist, high_cutoff/nyquist], btype='band')
        filtered_signal = signal.filtfilt(b, a, pos_signal)
        fft_size = len(filtered_signal)
        fft_result = np.abs(np.fft.rfft(filtered_signal))
        freqs = np.fft.rfftfreq(fft_size, d=1.0/fps)
        mask = (freqs >= 0.7) & (freqs <= 4.0)
        if np.any(mask):
            idx = np.argmax(fft_result[mask])
            dominant_freq = freqs[mask][idx]
            heart_rate = dominant_freq * 60
            max_amplitude = fft_result[mask][idx]
            total_power = np.sum(fft_result[mask])
            confidence = float(max_amplitude / total_power if total_power > 0 else 0)
            result = {
                "heartRate": float(heart_rate),
                "confidence": confidence,
                "processed": True
            }
        else:
            result = {
                "error": "No valid frequency components found",
                "heartRate": 0,
                "confidence": 0,
                "processed": False
            }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "processed": False}))
        sys.exit(1)
