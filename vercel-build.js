const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 빌드 과정 기록을 위한 로그 함수
function log(message) {
  console.log(`[Vercel Build] ${message}`);
}

// Python 명령어 설정 - macOS에서는 python3 사용
const pythonCommand = process.platform === 'darwin' ? 'python3' : 'python';
// pip 명령어 설정 - macOS에서는 pip3 사용
const pipCommand = process.platform === 'darwin' ? 'pip3' : 'pip';

try {
  // Python 버전 체크
  log('Python 버전 확인 중...');
  const pythonVersionOutput = execSync(`${pythonCommand} --version`).toString();
  log(pythonVersionOutput);

  // pip 버전 체크
  log('pip 버전 확인 중...');
  const pipVersionOutput = execSync(`${pythonCommand} -m pip --version`).toString();
  log(pipVersionOutput);

  // requirements.txt 설치 전에 pip 업그레이드
  log('pip 업그레이드 중...');
  execSync(`${pythonCommand} -m pip install --upgrade pip`, { stdio: 'inherit' });
  log('pip 업그레이드 완료');

  // requirements.txt 설치 - Python 모듈로 직접 실행하여 환경 일관성 유지
  log('Python 패키지 설치 중...');
  execSync(`${pythonCommand} -m pip install --no-cache-dir -r requirements.txt`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      PIP_DISABLE_PIP_VERSION_CHECK: '1',
      PIP_NO_WARN_SCRIPT_LOCATION: '1',
    }
  });
  log('Python 패키지 설치 완료');

  // 설치된 패키지 목록 확인
  log('설치된 Python 패키지 목록:');
  const installedPackages = execSync(`${pythonCommand} -m pip freeze`).toString();
  log(installedPackages);

  // scripts 디렉토리가 있는지 확인
  const scriptsDir = path.join(process.cwd(), 'scripts');
  if (fs.existsSync(scriptsDir)) {
    log('스크립트 디렉토리 확인됨');
    
    // process_rppg.py 파일이 있는지 확인
    const pythonScriptPath = path.join(scriptsDir, 'process_rppg.py');
    if (fs.existsSync(pythonScriptPath)) {
      log('process_rppg.py 스크립트 확인됨');
      
      // 스크립트 실행 권한 설정
      execSync(`chmod +x ${pythonScriptPath}`);
      log('스크립트 실행 권한 설정 완료');
    } else {
      log('경고: process_rppg.py 스크립트를 찾을 수 없습니다.');
    }
  } else {
    log('경고: scripts 디렉토리를 찾을 수 없습니다.');
  }
  
  log('Python 환경 설정 완료');
} catch (error) {
  log(`오류 발생: ${error.message}`);
  log('Python 설정에 실패했지만 빌드는 계속 진행합니다.');
}