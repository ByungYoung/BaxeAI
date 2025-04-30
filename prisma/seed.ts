// CommonJS 형식으로 변경
const { PrismaClient } = require("@prisma/client");
const bcryptjs = require("bcryptjs");

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcryptjs.hash(password, saltRounds);
}

async function main() {
  const ADMIN_EMAIL = "admin@xitst.com";
  const ADMIN_PASSWORD = "admin";
  const ADMIN_NAME = "관리자";
  const ADMIN_COMPANY = "시스템 관리자";

  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  // Upsert 작업 - 있으면 업데이트, 없으면 생성
  const admin = await prisma.user.upsert({
    where: {
      email: ADMIN_EMAIL,
    },
    update: {
      name: ADMIN_NAME,
      company: ADMIN_COMPANY,
      password: hashedPassword,
      isAdmin: true,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      company: ADMIN_COMPANY,
      password: hashedPassword,
      isAdmin: true,
    },
  });

  console.log(
    `관리자 계정 ${admin.email}이(가) 성공적으로 ${
      admin.id ? "생성" : "업데이트"
    }되었습니다.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // 연결 닫기
    await prisma.$disconnect();
  });
