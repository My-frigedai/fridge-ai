// app/api/menu/wizard/candidates/route.ts
import { NextResponse } from "next/server";
import { callOpenAIOnce, extractTextFromResponse } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { mealTypes, fridgeItems } = await req.json();

    // --- Responses API は string のみ受け取れる ---
    const prompt = `
以下の料理タイプに使えそうな食材を提案してください。
- 料理タイプ: ${mealTypes.join(", ")}
- 冷蔵庫の食材: ${fridgeItems.join(", ")}
- 出力はJSON配列で
`;

    // ❗️唯一の修正箇所：input は string
    const resp = await callOpenAIOnce({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 200,
    });

    // --- パース部分はそのまま利用 ---
    const raw = extractTextFromResponse(resp);
    let candidates: string[] = [];

    try {
      const first = raw.indexOf("[");
      const last = raw.lastIndexOf("]");
      if (first >= 0 && last >= 0) {
        candidates = JSON.parse(raw.slice(first, last + 1));
      }
    } catch (err) {
      console.error("parse candidates failed:", err, raw);
    }

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("candidates error:", err);
    return NextResponse.json(
      { error: "候補食材取得に失敗しました" },
      { status: 500 },
    );
  }
}
