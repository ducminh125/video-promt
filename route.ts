import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, imageUrl, ...otherData } = body;

    // Backend bổ sung yêu cầu để đảm bảo tính đồng nhất
    const systemPromptInjected = `
${prompt}
---
[LƯU Ý BẮT BUỘC TỪ HỆ THỐNG]: Đặc điểm khuôn mặt, nhận dạng và ngoại hình của người xuất hiện trong video phải hoàn toàn đồng nhất với người được gửi trong ảnh minh họa.
    `.trim();

    // Thực hiện gọi API thật tới Mai Đức Minh'web / Shopaikey
    // const res = await fetch('https://api.shopaikey.com/...', { method: 'POST', body: JSON.stringify({ prompt: systemPromptInjected, imageUrl }) })

    return NextResponse.json({ 
      success: true, 
      message: "Đã tiếp nhận yêu cầu", 
      injectedPrompt: systemPromptInjected 
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
