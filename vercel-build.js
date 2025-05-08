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
  // Linux 환경에서 필요한 개발 패키지 설치 시도
  if (process.platform === 'linux') {
    try {
      log('Linux 환경을 위한 시스템 패키지 설치 시도...');
      try {
        execSync('apt-get update && apt-get install -y build-essential gfortran libopenblas-dev liblapack-dev', { stdio: 'inherit' });
        log('시스템 패키지 설치 완료');
      } catch (aptError) {
        log(`apt-get 명령어 실행 실패. 다른 설치 방법 시도: ${aptError.message}`);
        try {
          execSync('yum update -y && yum install -y gcc-gfortran openblas-devel lapack-devel', { stdio: 'inherit' });
          log('yum을 통한 시스템 패키지 설치 완료');
        } catch (yumError) {
          log(`yum 명령어 실행 실패: ${yumError.message}`);
          log('시스템 패키지 설치를 건너뛰고 wheel 패키지 사용 시도');
        }
      }
    } catch (error) {
      log(`시스템 패키지 설치 중 오류 발생: ${error.message}`);
      log('시스템 패키지 설치 없이 계속 진행합니다.');
    }
  }

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

  // 환경 변수 설정
  const env = {
    ...process.env,
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    PIP_NO_WARN_SCRIPT_LOCATION: '1',
  };

  // Linux에서 설치 성공 가능성을 높이기 위한 wheel 사용 강제
  if (process.platform === 'linux') {
    log('Linux 환경에서 wheel 사용 설정...');
    try {
      execSync(`${pythonCommand} -m pip install --upgrade wheel setuptools`, { stdio: 'inherit', env });
      log('wheel 및 setuptools 업그레이드 완료');
      
      // NumPy를 먼저 설치 (SciPy의 의존성)
      log('NumPy 먼저 설치 중...');
      execSync(`${pythonCommand} -m pip install --no-cache-dir numpy==1.23.0`, { stdio: 'inherit', env });
      log('NumPy 설치 완료');
    } catch (wheelError) {
      log(`wheel 설치 실패: ${wheelError.message}`);
    }
  }

  // requirements.txt 설치 - Python 모듈로 직접 실행하여 환경 일관성 유지
  log('Python 패키지 설치 중...');
  execSync(`${pythonCommand} -m pip install --no-cache-dir -r requirements.txt`, { 
    stdio: 'inherit',
    env
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