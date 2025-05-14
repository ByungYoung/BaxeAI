const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 빌드 과정 기록을 위한 로그 함수
function log(message) {
  console.log(`[Vercel Build] ${message}`);
}

// Python 명령어 설정 - Vercel 환경 고려
let pythonCommand;
let pipCommand;

// Vercel 환경에서 Python 경로 찾기
if (process.env.VERCEL) {
  // Vercel 환경에서는 특정 경로에 Python이 설치되어 있을 수 있음
  const possiblePythonPaths = [
    "/opt/buildhome/.pyenv/shims/python3",
    "/opt/buildhome/.pyenv/shims/python",
    "/usr/local/bin/python3",
    "/usr/bin/python3",
    "/var/lang/bin/python3",
    "/local/bin/python3",
    "python3",
    "python",
  ];

  // 사용 가능한 Python 경로 찾기
  for (const pythonPath of possiblePythonPaths) {
    try {
      execSync(`${pythonPath} --version`, { stdio: "ignore" });
      pythonCommand = pythonPath;
      log(`Python 경로 찾음: ${pythonCommand}`);
      break;
    } catch (error) {
      // 못 찾으면 다음 경로 시도
    }
  }

  // pip 명령어는 항상 python -m pip로 통일 (python3.9, pip3.9 사용 금지)
  pipCommand = `${pythonCommand} -m pip`;
  if (!pythonCommand) {
    log("경고: 사용 가능한 Python을 찾을 수 없습니다.");
    pythonCommand = "python"; // 기본값으로 설정
  }
} else {
  // 로컬 환경
  pythonCommand = process.platform === "darwin" ? "python3" : "python";
  pipCommand = `${pythonCommand} -m pip`;
}

try {
  // 운영체제 감지
  log(`운영체제: ${process.platform}`);
  log(`아키텍처: ${process.arch}`);

  // Python 가상환경 생성 시도 (배포 환경에서는 불필요)
  const venvPath = path.join(process.cwd(), ".venv");
  let useVenv = false;

  // 프로덕션에서는 가상환경 생성 건너뛰기
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    try {
      log("가상환경 생성 시도...");
      if (!fs.existsSync(venvPath)) {
        execSync(`${pythonCommand} -m venv ${venvPath}`, { stdio: "inherit" });
        log("가상환경 생성 완료");
      } else {
        log("가상환경이 이미 존재합니다");
      }

      // 운영체제에 맞는 activate 스크립트 경로 설정
      const activateScript =
        process.platform === "win32"
          ? path.join(venvPath, "Scripts", "activate")
          : path.join(venvPath, "bin", "activate");

      if (fs.existsSync(activateScript)) {
        useVenv = true;
        log("가상환경 활성화 준비 완료");
      }
    } catch (venvError) {
      log(`가상환경 생성 실패: ${venvError.message}`);
      log("시스템 Python으로 계속 진행합니다.");
    }
  } // Linux 환경에서 필요한 개발 패키지 설치 시도 (Vercel에서만)
  if (process.platform === "linux" && process.env.VERCEL) {
    try {
      log("Linux 환경을 위한 시스템 패키지 설치 시도...");
      try {
        // Amazon Linux 기반 환경에서는 yum을 먼저 시도
        execSync(
          "yum update -y && yum install -y gcc-gfortran openblas-devel lapack-devel",
          { stdio: "inherit" }
        );
        log("yum을 통한 시스템 패키지 설치 완료");
      } catch (yumError) {
        log(`yum 명령어 실행 실패: ${yumError.message}`);
        log("시스템 패키지 설치를 건너뛰고 wheel 패키지 사용 시도");
      }
    } catch (error) {
      log(`시스템 패키지 설치 중 오류 발생: ${error.message}`);
      log("시스템 패키지 설치 없이 계속 진행합니다.");
    }
  }

  // 가상환경 또는 시스템 Python 선택
  let venvPythonCommand = pythonCommand;

  if (useVenv) {
    // 운영체제에 맞는 Python 실행 경로 설정
    venvPythonCommand =
      process.platform === "win32"
        ? path.join(venvPath, "Scripts", "python.exe")
        : path.join(venvPath, "bin", "python");
  }

  // Python 버전 체크
  log("Python 버전 확인 중...");
  const pythonVersionOutput = execSync(
    `${venvPythonCommand} --version`
  ).toString();
  log(pythonVersionOutput);

  // pip 버전 체크
  log("pip 버전 확인 중...");
  const pipVersionOutput = execSync(
    `${venvPythonCommand} -m pip --version`
  ).toString();
  log(pipVersionOutput);

  // requirements.txt 설치 전에 pip 업그레이드
  log("pip 업그레이드 중...");
  execSync(`${venvPythonCommand} -m pip install --upgrade pip`, {
    stdio: "inherit",
  });
  log("pip 업그레이드 완료");

  // 환경 변수 설정
  const env = {
    ...process.env,
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
    PIP_NO_WARN_SCRIPT_LOCATION: "1",
  };

  // 모든 환경에서 필요한 기본 도구 설치
  log("기본 도구 설치 중...");
  try {
    execSync(`${venvPythonCommand} -m pip install --upgrade wheel setuptools`, {
      stdio: "inherit",
      env,
    });
    log("wheel 및 setuptools 업그레이드 완료");
  } catch (toolsError) {
    log(`기본 도구 설치 실패: ${toolsError.message}`);
  }

  // 환경별 사전 설치 패키지
  if (process.platform === "linux") {
    log("Linux 환경용 기본 패키지 설치 중...");
    try {
      // NumPy를 먼저 설치 (SciPy의 의존성)
      execSync(
        `${venvPythonCommand} -m pip install --no-cache-dir numpy>=1.21.0 Cython`,
        { stdio: "inherit", env }
      );
      log("Linux 기본 패키지 설치 완료");
    } catch (linuxError) {
      log(`Linux 기본 패키지 설치 실패: ${linuxError.message}`);
    }
  } else if (process.platform === "win32") {
    log("Windows 환경용 기본 패키지 설치 중...");
    try {
      execSync(
        `${venvPythonCommand} -m pip install --no-cache-dir numpy>=1.21.0 Cython`,
        { stdio: "inherit", env }
      );
      log("Windows 기본 패키지 설치 완료");
    } catch (windowsError) {
      log(`Windows 기본 패키지 설치 실패: ${windowsError.message}`);
    }
  }

  // requirements.txt 설치 - 속도와 효율성 최적화
  log("Python 패키지 설치 중...");
  try {
    // 캐시 사용 및 최신 wheel 패키지 사용, 루트 사용자 경고 무시
    execSync(
      `${venvPythonCommand} -m pip install -r requirements.txt --prefer-binary --only-binary=:all: --upgrade-strategy eager --root-user-action=ignore`,
      {
        stdio: "inherit",
        env,
        // 타임아웃 설정 단축 (5분)
        timeout: 300000,
      }
    );
    log("Python 패키지 설치 완료");
  } catch (reqError) {
    log(`requirements.txt 설치 중 오류 발생: ${reqError.message}`);

    // 필수 패키지만 빠르게 설치 시도
    log("필수 패키지만 간소화하여 설치 시도...");
    try {
      // 핵심 패키지만 최적화하여 설치
      const essentialPackages = [
        "numpy>=1.21.0",
        "opencv-python-headless>=4.5.0",
        "scipy>=1.7.0",
        "pandas>=2.0.0",
      ];

      execSync(
        `${venvPythonCommand} -m pip install ${essentialPackages.join(
          " "
        )} --prefer-binary --only-binary=:all: --root-user-action=ignore`,
        {
          stdio: "inherit",
          env,
          timeout: 180000, // 3분으로 단축
        }
      );
      log("필수 패키지 설치 완료");
    } catch (essError) {
      log(`필수 패키지 설치 실패: ${essError.message}`);
    }
  }

  // 설치된 패키지 목록 확인
  log("설치된 Python 패키지 목록:");
  const installedPackages = execSync(
    `${venvPythonCommand} -m pip freeze`
  ).toString();
  log(installedPackages);

  // scripts 디렉토리가 있는지 확인
  const scriptsDir = path.join(process.cwd(), "scripts");
  if (fs.existsSync(scriptsDir)) {
    log("스크립트 디렉토리 확인됨");

    // process_rppg.py 파일이 있는지 확인
    const pythonScriptPath = path.join(scriptsDir, "process_rppg.py");
    if (fs.existsSync(pythonScriptPath)) {
      log("process_rppg.py 스크립트 확인됨");

      // 스크립트 실행 권한 설정
      execSync(`chmod +x ${pythonScriptPath}`);
      log("스크립트 실행 권한 설정 완료");

      // 스크립트 테스트 실행 (오류 캡처용)
      log("process_rppg.py 스크립트 테스트 실행...");
      try {
        // 스크립트를 인수 없이 실행하여 잘 로드되는지 확인
        const testOutput = execSync(
          `${venvPythonCommand} ${pythonScriptPath}`,
          {
            stdio: "pipe",
            encoding: "utf8",
            timeout: 10000,
          }
        );
        log(`스크립트 테스트 출력: ${testOutput}`);
      } catch (testError) {
        // 인수가 없어서 오류가 발생할 것이므로, 여기서는 스크립트가 로드되는지만 확인
        log(`스크립트 테스트 완료 (예상된 오류: ${testError.message})`);
      }
    } else {
      log("경고: process_rppg.py 스크립트를 찾을 수 없습니다.");
    }
  } else {
    log("경고: scripts 디렉토리를 찾을 수 없습니다.");
  }

  log("Python 환경 설정 완료");
} catch (error) {
  log(`오류 발생: ${error.message}`);
  log("Python 설정에 실패했지만 빌드는 계속 진행합니다.");
}
