#!/bin/bash

# OpenAI API 키 설정 및 테스트 도우미 스크립트

# 색상 설정
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API 키 설정 파일 경로
ENV_FILE=".env.local"

# 환영 메시지
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}    OpenAI API 설정 도우미    ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# .env.local 파일 확인
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}✓ ${ENV_FILE} 파일을 찾았습니다.${NC}"
  
  # API 키 존재 확인
  if grep -q "OPENAI_API_KEY" "$ENV_FILE"; then
    echo -e "${GREEN}✓ OpenAI API 키 설정이 있습니다.${NC}"
    
    # API 키가 실제 값을 가지고 있는지 확인 (sk-로 시작하는지)
    API_KEY=$(grep "OPENAI_API_KEY" "$ENV_FILE" | cut -d '=' -f2)
    if [[ "$API_KEY" == sk-* ]]; then
      echo -e "${GREEN}✓ API 키가 올바른 형식입니다.${NC}"
    else
      echo -e "${RED}✗ API 키가 올바른 형식이 아닙니다. 'sk-'로 시작해야 합니다.${NC}"
      UPDATE_NEEDED=true
    fi
  else
    echo -e "${RED}✗ OpenAI API 키 설정이 없습니다.${NC}"
    UPDATE_NEEDED=true
  fi
else
  echo -e "${RED}✗ ${ENV_FILE} 파일이 없습니다. 새로 생성합니다.${NC}"
  touch "$ENV_FILE"
  UPDATE_NEEDED=true
fi

# API 키 입력/업데이트 필요한 경우
if [ "$UPDATE_NEEDED" = true ]; then
  echo ""
  echo -e "${YELLOW}OpenAI API 키를 입력하세요 (sk-로 시작):${NC}"
  read -p "> " NEW_API_KEY
  
  if [[ "$NEW_API_KEY" == sk-* ]]; then
    # 기존 파일에서 API 키 줄 제거
    if [ -f "$ENV_FILE" ]; then
      sed -i '' '/OPENAI_API_KEY/d' "$ENV_FILE" 2>/dev/null || sed -i '/OPENAI_API_KEY/d' "$ENV_FILE"
    fi
    
    # 새 API 키 추가
    echo "OPENAI_API_KEY=$NEW_API_KEY" >> "$ENV_FILE"
    echo -e "${GREEN}✓ API 키가 성공적으로 업데이트되었습니다.${NC}"
  else
    echo -e "${RED}✗ 유효하지 않은 API 키 형식입니다. API 키는 'sk-'로 시작해야 합니다.${NC}"
    echo -e "${RED}✗ API 키 설정이 취소되었습니다.${NC}"
  fi
fi

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}    API 테스트 방법    ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "${YELLOW}1. 개발 서버를 실행합니다:${NC}"
echo -e "   npm run dev"
echo -e "   ${GREEN}또는${NC}"
echo -e "   pnpm run dev"
echo ""
echo -e "${YELLOW}2. 브라우저에서 테스트 페이지에 접속합니다:${NC}"
echo -e "   http://localhost:3000/api-test"
echo ""
echo -e "${YELLOW}3. 테스트 페이지에서 캐리커처를 생성합니다.${NC}"
echo ""
echo -e "${GREEN}이 스크립트를 다시 실행하여 API 키를 언제든지 업데이트할 수 있습니다.${NC}"
echo ""
