from http.server import BaseHTTPRequestHandler
import json
import sys
import platform
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # 필요한 패키지 동적으로 임포트 확인 (Vercel Serverless 환경에서 크기 최적화)
        packages = []
        
        try:
            import numpy
            packages.append(f"numpy {numpy.__version__}")
        except ImportError:
            packages.append("numpy not installed")
            
        try:
            import cv2
            packages.append(f"opencv-python {cv2.__version__}")
        except ImportError:
            packages.append("opencv-python not installed")
            
        try:
            import scipy
            packages.append(f"scipy {scipy.__version__}")
        except ImportError:
            packages.append("scipy not installed")
        
        # 응답 데이터 구성
        response = {
            "python_version": sys.version,
            "platform": platform.platform(),
            "architecture": platform.architecture(),
            "packages": packages,
            "env_vars": {k: v for k, v in os.environ.items() if k.startswith("PYTHON_") or k.startswith("VERCEL_")}
        }
        
        self.wfile.write(json.dumps(response, indent=2).encode())
