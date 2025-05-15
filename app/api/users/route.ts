import { NextRequest, NextResponse } from 'next/server';
import { withDb } from '@/lib/db';
import { users, measurementResults } from '@/lib/db/schema';
import { eq, like, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as bcrypt from 'bcryptjs';

// 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    return await withDb(async db => {
      // 조건부 쿼리 빌드
      const usersList = await db
        .select()
        .from(users)
        .where(email ? like(users.email, `%${email}%`) : undefined)
        .orderBy(users.createdAt);

      // 비밀번호 필드 제거 (보안)
      const sanitizedUsers = usersList.map(user => {
        const { password, ...rest } = user;
        return rest;
      });

      return NextResponse.json(sanitizedUsers);
    });
  } catch (error) {
    console.error('사용자 목록 조회 중 오류 발생:', error);
    return NextResponse.json(
      { error: '사용자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 새 사용자 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company, password } = body;

    // 필수 필드 확인
    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호는 필수 항목입니다.' }, { status: 400 });
    }

    return await withDb(async db => {
      // 이미 존재하는 이메일 확인
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existingUser.length > 0) {
        return NextResponse.json({ error: '이미 등록된 이메일 주소입니다.' }, { status: 409 });
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, 10);

      // 사용자 생성
      const userId = createId();
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          email,
          name: name || email.split('@')[0],
          company: company || '미지정',
          password: hashedPassword,
          isAdmin: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 비밀번호 필드 제거 후 응답
      const { password: _, ...userWithoutPassword } = newUser;

      return NextResponse.json(userWithoutPassword, { status: 201 });
    });
  } catch (error) {
    console.error('사용자 등록 중 오류 발생:', error);
    return NextResponse.json({ error: '사용자 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 사용자 정보 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, company, password, isAdmin } = body;

    if (!id) {
      return NextResponse.json({ error: '사용자 ID는 필수 항목입니다.' }, { status: 400 });
    }

    return await withDb(async db => {
      // 업데이트할 데이터 준비
      const updateData: any = {};

      if (name !== undefined) updateData.name = name;
      if (company !== undefined) updateData.company = company;
      if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

      // 비밀번호가 제공된 경우 해싱
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      // 업데이트할 내용이 있는지 확인
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: '업데이트할 정보가 제공되지 않았습니다.' },
          { status: 400 }
        );
      }

      // 업데이트 타임스탬프 추가
      updateData.updatedAt = new Date();

      // 사용자 정보 업데이트
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // 비밀번호 필드 제거 후 응답
      const { password: _, ...userWithoutPassword } = updatedUser;

      return NextResponse.json(userWithoutPassword);
    });
  } catch (error) {
    console.error('사용자 정보 업데이트 중 오류 발생:', error);
    return NextResponse.json(
      { error: '사용자 정보 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용자 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '사용자 ID는 필수 항목입니다.' }, { status: 400 });
    }

    return await withDb(async db => {
      // 관련 측정 결과 삭제
      await db.delete(measurementResults).where(eq(measurementResults.userId, id));

      // 사용자 삭제
      const deleteResult = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ deletedId: users.id });

      if (deleteResult.length === 0) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      return NextResponse.json({ deletedId: id });
    });
  } catch (error) {
    console.error('사용자 삭제 중 오류 발생:', error);
    return NextResponse.json({ error: '사용자 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
