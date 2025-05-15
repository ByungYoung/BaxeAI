#!/usr/bin/env node

/**
 * Vercel Python 함수를 로컬에서 테스트하기 위한 개발 서버
 *
 * 이 스크립트는 로컬 개발 중에 Python 함수를 테스트하기 위한 서버를 실행합니다.
 * 자동으로 api/python 디렉토리의 파일을 감시하고, 변경 시 서버를 재시작합니다.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { parse } = require('url');

// 설정
const PORT = 3001; // Python API 서버 포트
const API_DIR = path.join(__dirname, 'api/python');
const VERCEL_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};

// Colors
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 로깅
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}] `;

  switch (type) {
    case 'info':
      console.log(`${COLORS.blue}${prefix}${COLORS.reset}${message}`);
      break;
    case 'success':
      console.log(`${COLORS.green}${prefix}${COLORS.green}${message}${COLORS.reset}`);
      break;
    case 'warning':
      console.log(`${COLORS.yellow}${prefix}${COLORS.yellow}${message}${COLORS.reset}`);
      break;
    case 'error':
      console.log(`${COLORS.red}${prefix}${COLORS.red}${message}${COLORS.reset}`);
      break;
    default:
      console.log(`${prefix}${message}`);
  }
}

// Python 명령어 가져오기 (OS에 따라)
function getPythonCommand() {
  const isWindows = process.platform === 'win32';

  // Python 3.9 버전을 우선 시도
  try {
    const pythonVersion = isWindows
      ? require('child_process').execSync('python --version').toString()
      : require('child_process').execSync('python3 --version').toString();

    log(`감지된 Python 버전: ${pythonVersion.trim()}`, 'info');
  } catch (e) {
    // 오류 발생 시 무시
    log(`Python 버전 확인 중 오류: ${e.message}`, 'warning');
  }

  return isWindows ? 'python' : 'python3';
}

// Python 요청 처리
function handlePythonRequest(req, res, pythonFile) {
  return new Promise((resolve, reject) => {
    const method = req.method;
    const contentType = req.headers['content-type'] || '';
    let body = '';

    // 요청 바디 수집
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // Python 스크립트 실행
      const pythonCommand = getPythonCommand();
      const pythonArgs = [
        '-c',
        `
import sys
sys.path.insert(0, "${API_DIR}")
import json
from ${path.basename(pythonFile, '.py')} import handler

class MockRequest:
    def __init__(self, method, path, headers, body):
        self.method = method
        self.path = path
        self.headers = headers
        self.body = body
        self._body = body

    def rfile(self):
        return MockBodyReader(self.body)

class MockBodyReader:
    def __init__(self, body):
        self.body = body.encode() if isinstance(body, str) else body

    def read(self, length):
        return self.body

class MockResponse:
    def __init__(self):
        self.status = 200
        self.headers = {}
        self.body = b''

    def send_response(self, status):
        self.status = status

    def send_header(self, name, value):
        self.headers[name] = value

    def end_headers(self):
        pass

    def wfile(self):
        return MockBodyWriter(self)

class MockBodyWriter:
    def __init__(self, response):
        self.response = response

    def write(self, body):
        self.response.body = body

# 요청과 응답 객체 준비
req = MockRequest("${method}", "${req.url}", ${JSON.stringify(
          req.headers
        )}, ${JSON.stringify(body)})
res = MockResponse()

# 핸들러 실행
h = handler()
if "${method}" == "GET":
    h.do_GET()
elif "${method}" == "POST":
    h.do_POST()

# 응답 출력
print(json.dumps({
    "status": res.status,
    "headers": res.headers,
    "body": res.body.decode() if hasattr(res, "body") and res.body else ""
}))
      `,
      ];

      const pythonProcess = spawn(pythonCommand, pythonArgs);
      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', data => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', data => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', code => {
        if (code !== 0) {
          log(`Python 프로세스 오류 (코드: ${code}): ${stderrData}`, 'error');
          res.writeHead(500, {
            'Content-Type': 'application/json',
            ...VERCEL_HEADERS,
          });
          res.end(
            JSON.stringify({
              error: 'Python processing error',
              details: stderrData,
            })
          );
          reject(new Error(`Python process exited with code ${code}`));
          return;
        }

        try {
          const pythonResult = JSON.parse(stdoutData);

          // Python 핸들러의 응답 헤더 설정
          res.writeHead(pythonResult.status, {
            ...pythonResult.headers,
            ...VERCEL_HEADERS,
          });

          // 응답 바디 전송
          res.end(pythonResult.body);
          resolve();
        } catch (error) {
          log(`Python 결과 파싱 오류: ${error.message}`, 'error');
          log(`Python stdout: ${stdoutData}`, 'error');
          res.writeHead(500, {
            'Content-Type': 'application/json',
            ...VERCEL_HEADERS,
          });
          res.end(
            JSON.stringify({
              error: 'Failed to parse Python response',
              stdout: stdoutData,
              message: error.message,
            })
          );
          reject(error);
        }
      });
    });
  });
}

// API 서버 생성
const server = http.createServer(async (req, res) => {
  // CORS 프리플라이트 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204, VERCEL_HEADERS);
    res.end();
    return;
  }

  const parsedUrl = parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Python API 요청 라우팅
  if (pathname.startsWith('/api/python/')) {
    const pythonFileName = pathname.replace('/api/python/', '');
    const pythonFilePath = path.join(API_DIR, `${pythonFileName}.py`);

    if (fs.existsSync(pythonFilePath)) {
      log(`Python 요청 처리: ${pythonFileName}.py (${req.method})`, 'info');
      try {
        await handlePythonRequest(req, res, pythonFilePath);
      } catch (error) {
        log(`요청 처리 중 오류: ${error.message}`, 'error');
      }
    } else {
      log(`Python 파일 없음: ${pythonFileName}.py`, 'error');
      res.writeHead(404, {
        'Content-Type': 'application/json',
        ...VERCEL_HEADERS,
      });
      res.end(JSON.stringify({ error: 'Python handler not found' }));
    }
    return;
  }

  // 기타 요청은 404
  res.writeHead(404, {
    'Content-Type': 'application/json',
    ...VERCEL_HEADERS,
  });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// 서버 시작
function startServer() {
  server.listen(PORT, () => {
    log(`Vercel Python 개발 서버 실행 중: http://localhost:${PORT}`, 'success');
    log(`다음 경로로 Python API 접근 가능: http://localhost:${PORT}/api/python/{filename}`, 'info');
  });
}

// 파일 변경 감시
function watchFiles() {
  const watcher = chokidar.watch(`${API_DIR}/**/*.py`, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
  });

  watcher
    .on('change', path => {
      log(`파일 변경 감지: ${path}`, 'warning');
    })
    .on('add', path => {
      log(`새 Python 핸들러 추가됨: ${path}`, 'success');
    });

  log('Python 파일 변경 감시 중...', 'info');
}

// 서버 실행 및 파일 감시
startServer();
watchFiles();
