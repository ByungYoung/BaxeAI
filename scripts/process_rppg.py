#!/usr/bin/env python3
"""
This script processes a sequence of frames using pyVHR to extract heart rate.
"""

import sys
import os
import json
import glob
import numpy as np
import cv2
from pyVHR.analysis.pipeline import Pipeline
from pyVHR.plot.visualize import VisualizeParams
from pyVHR.datasets.dataset import Dataset
from pyVHR.BVP.methods import *

def process_frames(frames_dir):
    """Process frames using pyVHR and return heart rate."""
    try:
        # Get all frame files and sort them
        frame_files = sorted(glob.glob(os.path.join(frames_dir, "frame_*.jpg")))
        
        if not frame_files:
            return {"error": "No frames found"}
        
        # Load frames
        frames = []
        for frame_file in frame_files:
            frame = cv2.imread(frame_file)
            frames.append(frame)
        
        # Convert to numpy array
        video_frames = np.array(frames)
        
        # Create a custom dataset for pyVHR
        # Note: This is a simplified approach - in a real implementation,
        # you would need to adapt this to pyVHR's dataset structure
        
        # Set up pyVHR pipeline
        # This is a simplified example - you would need to adjust parameters
        # based on your specific requirements
        pipeline = Pipeline()
        pipeline.set_video_frames(video_frames)
        
        # Configure face detection and tracking
        pipeline.set_detector("mtcnn")
        
        # Set rPPG method (e.g., GREEN, POS, CHROM)
        pipeline.set_method(POS)
        
        # Set BVP parameters
        pipeline.set_BVP_params(
            {'fps': 10,  # Assuming 10 fps based on our capture rate
             'minHz': 0.7,  # Min heart rate frequency (42 BPM)
             'maxHz': 4.0,  # Max heart rate frequency (240 BPM)
             'clipBefore': False}
        )
        
        # Run the pipeline
        bvps, fps, timings = pipeline.run_on_video()
        
        # Extract heart rate from BVP signal
        if bvps and len(bvps) > 0:
            # Get the first BVP signal (assuming single face)
            bvp = bvps[0]
            
            # Calculate heart rate using FFT
            # This is simplified - pyVHR has more sophisticated methods
            sampling_rate = fps
            fft_size = len(bvp)
            fft_result = np.abs(np.fft.rfft(bvp))
            
            # Get frequency bins
            freqs = np.fft.rfftfreq(fft_size, d=1.0/sampling_rate)
            
            # Find dominant frequency in the heart rate range (0.7-4 Hz)
            mask = (freqs >= 0.7) & (freqs <= 4.0)
            if np.any(mask):
                idx = np.argmax(fft_result[mask])
                dominant_freq = freqs[mask][idx]
                heart_rate = dominant_freq * 60  # Convert Hz to BPM
                
                # Calculate confidence based on signal strength
                max_amplitude = fft_result[mask][idx]
                total_power = np.sum(fft_result[mask])
                confidence = max_amplitude / total_power if total_power > 0 else 0
                
                return {
                    "heartRate": float(heart_rate),
                    "confidence": float(min(confidence, 1.0))
                }
            
        return {"heartRate": 0, "confidence": 0}
        
    except Exception as e:
        print(f"Error in pyVHR processing: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No frames directory provided"}))
        sys.exit(1)
    
    frames_dir = sys.argv[1]
    result = process_frames(frames_dir)
    print(json.dumps(result))
