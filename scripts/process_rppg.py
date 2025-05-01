#!/usr/bin/env python3
"""
This script processes a sequence of frames using simplified rPPG extraction for Mac M1.
Additional HRV metrics calculation is implemented.
"""

import sys
import os
import json
import glob
import numpy as np
import cv2
from scipy import signal
from scipy import interpolate
from scipy.signal import detrend

# 시뮬레이션된 결과 생성 함수 추가 - 오류 발생 시 대체 데이터로 사용
def generate_simulated_results(error_message):
    """심박수 측정 실패 시 시뮬레이션된 결과를 반환합니다."""
    # 정상적인 범위의 심박수 값 생성
    heart_rate = np.random.normal(75, 5)  # 평균 75, 표준편차 5의 정규분포
    heart_rate = max(60, min(100, heart_rate))  # 60-100 BPM 범위로 제한
    
    # 낮은 신뢰도 설정 (시뮬레이션된 값임을 나타냄)
    confidence = 0.3
    
    print(f"Warning: Using simulated data due to error: {error_message}", file=sys.stderr)
    
    return {
        "heartRate": float(heart_rate),
        "confidence": float(confidence),
        "simulatedData": True,  # 시뮬레이션된 데이터임을 표시
        "error": str(error_message),
        "hrv": {
            "lf": 0.0,
            "hf": 0.0,
            "lfHfRatio": 1.0,
            "sdnn": 40.0,
            "rmssd": 35.0,
            "pnn50": 25.0
        }
    }

# Apple M1 호환성을 위해 pyVHR 의존성 우회
def process_frames(frames_dir):
    """Process frames using CPU-based rPPG and return heart rate and HRV metrics."""
    try:
        # Get all frame files and sort them
        frame_files = sorted(glob.glob(os.path.join(frames_dir, "frame_*.jpg")))
        
        if not frame_files:
            raise Exception("No frames found")
        
        print(f"Found {len(frame_files)} frames for processing", file=sys.stderr)
        
        # 얼굴 감지를 위한 OpenCV 하르 캐스케이드 사용 (CUDA 없이도 작동)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # 시간 경과에 따른 RGB 값을 저장할 리스트
        r_values = []
        g_values = []
        b_values = []
        timestamps = []  # 각 프레임의 시간(초) 추적
        
        fps = 20  # 20 fps로 설정 (50ms 간격으로 캡처)
        frame_time = 1.0 / fps
        
        # 얼굴이 감지된 프레임 수를 카운트
        face_detected_frames = 0
        
        for i, frame_file in enumerate(frame_files):
            frame = cv2.imread(frame_file)
            if frame is None:
                continue
                
            # 현재 프레임의 타임스탬프 추가
            timestamps.append(i * frame_time)
            
            # 그레이스케일로 변환하여 얼굴 감지
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            if len(faces) > 0:
                # 가장 큰 얼굴 영역 선택
                max_face = max(faces, key=lambda rect: rect[2] * rect[3])
                (x, y, w, h) = max_face
                
                # 얼굴이 감지되었으므로 카운트 증가
                face_detected_frames += 1
                
                # 얼굴 영역 추출
                face_roi = frame[y:y+h, x:x+w]
                
                # 피부색 마스킹
                # YCrCb 색상 공간에서 피부색 필터링
                ycrcb = cv2.cvtColor(face_roi, cv2.COLOR_BGR2YCrCb)
                lower = np.array([0, 133, 77], dtype=np.uint8)
                upper = np.array([255, 173, 127], dtype=np.uint8)
                mask = cv2.inRange(ycrcb, lower, upper)
                
                # 마스크를 적용하여 얼굴 ROI에서 피부 영역만 추출
                skin = cv2.bitwise_and(face_roi, face_roi, mask=mask)
                
                # 피부 픽셀 수가 충분한 경우에만 처리
                if np.sum(mask) > 1000:  # 마스크된 픽셀이 최소 1000개 이상
                    # 각 채널별 평균 값 계산
                    b, g, r = cv2.split(skin)
                    r_values.append(np.sum(r) / np.sum(mask))
                    g_values.append(np.sum(g) / np.sum(mask))
                    b_values.append(np.sum(b) / np.sum(mask))
                else:
                    # 얼굴이나 피부가 충분히 감지되지 않은 경우 타임스탬프 제거
                    timestamps.pop()
                    face_detected_frames -= 1  # 피부가 충분하지 않으므로, 카운트 다시 감소
        
        # 총 프레임 중 얼굴 감지 비율 계산
        detection_ratio = face_detected_frames / len(frame_files) if frame_files else 0
        print(f"Face detection ratio: {detection_ratio:.2f} ({face_detected_frames}/{len(frame_files)})", file=sys.stderr)
        
        # 충분한 프레임이 처리되었는지 확인
        if len(r_values) < 10:
            raise Exception(f"Not enough valid frames with face detected: {len(r_values)} frames")
        
        # timestamps 배열도 동일한 길이로 조정
        timestamps = timestamps[:len(r_values)]
        
        # 신호 전처리 (정규화)
        r_values = np.array(r_values)
        g_values = np.array(g_values)
        b_values = np.array(b_values)
        timestamps = np.array(timestamps)
        
        # 신호 디트렌딩 (추세 제거)
        r_detrended = detrend(r_values)
        g_detrended = detrend(g_values)
        b_detrended = detrend(b_values)
        
        # 정규화
        r_normalized = (r_detrended - np.mean(r_detrended)) / np.std(r_detrended)
        g_normalized = (g_detrended - np.mean(g_detrended)) / np.std(g_detrended)
        b_normalized = (b_detrended - np.mean(b_detrended)) / np.std(b_detrended)
        
        # POS 알고리즘 구현
        # Wang et al., "Algorithmic Principles of Remote PPG," 2017
        h, w = 3, len(r_normalized)
        X = np.vstack([r_normalized, g_normalized, b_normalized])
        mean_color = np.mean(X, axis=1, keepdims=True)
        
        # 3x3 projection matrix - POS 알고리즘
        S = np.array([[0, 1, -1], [-2, 1, 1]])
        P = np.dot(S, X)
        
        # POS 신호 계산
        pos_signal = P[0, :] + ((np.std(P[0, :]) / np.std(P[1, :])) * P[1, :])
        
        # 버터워스 밴드패스 필터 적용
        low_cutoff = 0.7  # 42 BPM
        high_cutoff = 4.0  # 240 BPM
        nyquist = fps / 2
        b, a = signal.butter(3, [low_cutoff/nyquist, high_cutoff/nyquist], btype='band')
        filtered_signal = signal.filtfilt(b, a, pos_signal)
        
        # FFT로 주파수 분석
        fft_size = len(filtered_signal)
        fft_result = np.abs(np.fft.rfft(filtered_signal))
        freqs = np.fft.rfftfreq(fft_size, d=1.0/fps)
        
        # 심박수 범위 내 주파수로 제한
        mask = (freqs >= 0.7) & (freqs <= 4.0)
        if np.any(mask):
            idx = np.argmax(fft_result[mask])
            dominant_freq = freqs[mask][idx]
            heart_rate = dominant_freq * 60  # BPM으로 변환
            
            # 신호 강도 기반으로 신뢰도 계산
            max_amplitude = fft_result[mask][idx]
            total_power = np.sum(fft_result[mask])
            confidence = max_amplitude / total_power if total_power > 0 else 0
            
            print(f"Estimated heart rate: {heart_rate:.1f} BPM (confidence: {confidence:.2f})", file=sys.stderr)
            
            # 피크 감지를 통한 R-R interval 추출
            # 필터링된 신호에서 심박 피크 찾기 (세밀한 피크 감지를 위해 필터 변경)
            b_rpeaks, a_rpeaks = signal.butter(3, [0.8/nyquist, 3.5/nyquist], btype='band')
            filtered_for_peaks = signal.filtfilt(b_rpeaks, a_rpeaks, pos_signal)
            
            # 피크 감지 - 더 민감하게 설정
            prominence = np.std(filtered_for_peaks) * 0.3  # 표준 편차 기반 임계값
            distance = int(fps * 60 / heart_rate * 0.65)  # 예상되는 심박 간격의 65%를 최소 거리로 설정
            peaks, props = signal.find_peaks(filtered_for_peaks, distance=distance, prominence=prominence)
            
            print(f"Detected {len(peaks)} peaks", file=sys.stderr)
            
            # 피크 간격을 밀리초 단위로 변환 (RR 간격)
            if len(peaks) > 1:
                rr_intervals_sec = np.diff(timestamps[peaks])
                rr_intervals_ms = rr_intervals_sec * 1000  # 밀리초 단위로 변환
                
                # HRV 지표 계산을 위해 이상치 제거
                # 45-155% 범위를 벗어나는 RR 간격 제거 (범위를 더 완화)
                rr_mean = np.mean(rr_intervals_ms)
                valid_rr = rr_intervals_ms[(rr_intervals_ms > 0.45 * rr_mean) & (rr_intervals_ms < 1.55 * rr_mean)]
                
                print(f"Valid RR intervals: {len(valid_rr)} out of {len(rr_intervals_ms)}", file=sys.stderr)
                
                # RR 간격이 부족하면 오류 발생
                if len(valid_rr) < 3:
                    raise Exception(f"Not enough valid RR intervals detected: {len(valid_rr)} intervals")
                
                # 시간 영역 HRV 지표 계산
                # 1. SDNN (Standard Deviation of NN intervals)
                sdnn = np.std(valid_rr, ddof=1)
                
                # 2. RMSSD (Root Mean Square of Successive Differences)
                rmssd = np.sqrt(np.mean(np.square(np.diff(valid_rr)))) if len(valid_rr) > 1 else 0
                
                # 3. pNN50 (Percentage of successive RR intervals that differ by more than 50 ms)
                diff_rr = np.abs(np.diff(valid_rr)) if len(valid_rr) > 1 else []
                nn50 = sum(diff_rr > 50) if len(diff_rr) > 0 else 0
                pnn50 = (nn50 / len(diff_rr)) * 100 if len(diff_rr) > 0 else 0
                
                # 주파수 영역 HRV 지표 계산
                lf_power, hf_power, lf_hf_ratio = calculate_frequency_domain_hrv(valid_rr)
                

# 주파수 영역 HRV 지표를 계산하는 개선된 함수
def calculate_frequency_domain_hrv(rr_intervals_ms):
    try:
        # RR 간격을 초 단위로 변환
        rr_intervals_sec = rr_intervals_ms / 1000.0
        
        # RR 간격의 평균 계산하여 심박 변이 신호 생성
        rr_mean = np.mean(rr_intervals_sec)
        rr_diff = rr_intervals_sec - rr_mean
        
        # 4Hz로 리샘플링하기 위한 시간 배열 생성
        fs_interp = 4.0  # Hz
        t_rr = np.cumsum(rr_intervals_sec)
        t_rr = np.insert(t_rr, 0, 0)  # 첫 번째 시간포인트를 0으로 추가
        t_rr = t_rr[:-1]  # 마지막 포인트 제거 (RR 간격과 길이 맞추기)
        
        if len(t_rr) <= 3:  # 충분한 데이터가 없는 경우
            raise Exception(f"Not enough data points for HRV frequency analysis: {len(t_rr)} points")
        
        # 균일한 시간 간격으로 재구성
        t_interp = np.arange(0, t_rr[-1], 1.0/fs_interp)
            
        # 큐빅 스플라인 보간 (좀더 부드러운 결과)
        f_interp = interpolate.interp1d(t_rr, rr_diff, kind='cubic', bounds_error=False, fill_value="extrapolate")
        rr_interp = f_interp(t_interp)
        
        # 웰치 방법을 사용한 PSD 계산
        # nperseg 값 최적화: 주파수 해상도 vs 분산 트레이드오프
        nperseg = min(len(rr_interp), 256)  # 신호 길이보다는 작게, 하지만 충분한 해상도를 위해
        
        fxx, pxx = signal.welch(rr_interp, fs=fs_interp, nperseg=nperseg, detrend='constant')
        
        # 관련 주파수 대역 필터링
        lf_indices = np.logical_and(fxx >= 0.04, fxx <= 0.15)  # LF: 0.04-0.15 Hz
        hf_indices = np.logical_and(fxx >= 0.15, fxx <= 0.4)   # HF: 0.15-0.4 Hz
        
        if not np.any(lf_indices) or not np.any(hf_indices):
            raise Exception("No valid frequency bands found for HRV analysis")
        
        # 파워 계산 (면적)
        lf_power = np.trapz(pxx[lf_indices], fxx[lf_indices])
        hf_power = np.trapz(pxx[hf_indices], fxx[hf_indices])
        
        # LF/HF 비율 계산
        if hf_power <= 0:
            raise Exception(f"Invalid HF power: {hf_power}")
            
        lf_hf_ratio = lf_power / hf_power
        
        return lf_power, hf_power, lf_hf_ratio
            
    except Exception as e:
        print(f"Error in HRV frequency domain calculation: {str(e)}", file=sys.stderr)
        raise e

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No frames directory provided"}))
        sys.exit(1)
    
    frames_dir = sys.argv[1]
    
    try:
        result = process_frames(frames_dir)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "heartRate": 0, "confidence": 0}))
        sys.exit(1)
