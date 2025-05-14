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
        
        response = {
            "python_version": sys.version,
            "platform": platform.platform(),
            "architecture": platform.architecture(),
            "env_vars": {k: v for k, v in os.environ.items() if k.startswith("PYTHON_") or k.startswith("VERCEL_")}
        }
        
        self.wfile.write(json.dumps(response, indent=2).encode())
