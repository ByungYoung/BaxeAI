import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    console.log("캐리커처 API 호출 됨");
    const data = await request.formData();
    const image = data.get("image") as File;

    if (!image) {
      console.error("이미지 파일이 없음");
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다.", success: false },
        { status: 400 }
      );
    }

    // 이미지 정보 로깅
    console.log("이미지 타입:", image.type);
    console.log("이미지 크기:", image.size, "bytes");

    // 이미지를 바이트 배열로 변환
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log("이미지 버퍼 변환 완료, 크기:", buffer.length);

    // 실제 프로덕션에서는 이미지 분석 및 캐리커처 생성 API를 호출해야 합니다
    // 여기서는 테스트를 위해 고정된 샘플 이미지 URL을 반환합니다

    // 랜덤으로 캐리커처 스타일 선택 (실제 구현에서는 AI가 생성)
    const caricatureStyles = [
      "https://images.unsplash.com/photo-1566753323558-f4e0952af115?q=80&w=1000&auto=format&fit=crop",
      "https://img.freepik.com/premium-vector/business-man-cartoon-character_24908-58909.jpg",
      "https://img.freepik.com/premium-vector/cartoon-happy-businessman-showing-thumbs-up_29190-4954.jpg",
      "https://cdn1.vectorstock.com/i/1000x1000/72/15/cartoon-character-young-happy-businessman-vector-9377215.jpg",
      "https://img.freepik.com/premium-vector/business-man-cartoon-character_24908-61578.jpg",
    ];

    const randomIndex = Math.floor(Math.random() * caricatureStyles.length);
    const caricatureUrl = caricatureStyles[randomIndex];

    // 디버깅 정보
    console.log("캐리커처 생성 성공:", caricatureUrl);

    // 생성된 이미지 URL을 반환
    return NextResponse.json({
      caricatureUrl,
      success: true,
    });
  } catch (error: any) {
    console.error("캐리커처 생성 오류:", error);
    return NextResponse.json(
      {
        error: error.message || "캐리커처 생성 중 오류가 발생했습니다.",
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}
