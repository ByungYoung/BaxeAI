#!/usr/bin/env python3
import sys
import json
import platform
import os

def main():
    """Python 버전 및 환경 정보를 출력합니다."""
    info = {
        "python_version": sys.version,
        "platform": platform.platform(),
        "architecture": platform.architecture(),
        "env_vars": {k: v for k, v in os.environ.items() if k.startswith("PYTHON_") or k.startswith("VERCEL_")}
    }
    
    print(json.dumps(info, indent=2))

if __name__ == "__main__":
    main()
