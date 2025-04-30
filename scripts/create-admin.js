// 관리자 계정 생성 스크립트
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

// 관리자 계정 정보 (실제 배포 시 환경변수 등으로 관리하는 것이 좋습니다)
const ADMIN_EMAIL = "admin@xitst.com";
const ADMIN_PASSWORD = "admin";
const ADMIN_NAME = "관리자";
const ADMIN_COMPANY = "시스템 관리자";

// 비밀번호 해싱 함수
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function createAdminUser() {
  try {
    // 이미 존재하는 관리자 계정 확인
    const existingAdmin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    if (existingAdmin) {
      // 이미 존재하면 관리자 권한 업데이트
      const updatedAdmin = await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: {
          isAdmin: true,
          name: ADMIN_NAME,
          company: ADMIN_COMPANY,
          password: hashedPassword,
        },
      });
      console.log("관리자 계정이 업데이트되었습니다:", updatedAdmin.email);
      return updatedAdmin;
    } else {
      // 새 관리자 계정 생성
      const newAdmin = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          company: ADMIN_COMPANY,
          password: hashedPassword,
          isAdmin: true,
        },
      });
      console.log("관리자 계정이 생성되었습니다:", newAdmin.email);
      return newAdmin;
    }
  } catch (error) {
    console.error("관리자 계정 생성 중 오류 발생:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
