// app/api/refineRecipe/route.ts
import { NextResponse } from "next/server";
import { callOpenAIOnce, extractTextFromResponse } from "@/lib/openai";
import { rateLimit } from "@/lib/rateLimiter";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("host") || "unknown";
    const rl = rateLimit(`refine:${ip}`, 40, 60);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const body = await req.json();
    const title: string = String(body.title || "");
    const items: string[] = Array.isArray(body.items) ? body.items : [];

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const prompt = `
献立: ${title}
利用可能食材: ${items.join(", ") || "(指定なし)"}

以下を JSON で返してください:
{
  "detailed_steps": [
    { "step": "～", "timing": "例：中火で2分", "pitfall": "失敗しやすい点", "improvement": "改善のコツ" }
  ]
}
各ステップは 50-120語程度で、実行時の温度・時間の目安を含めてください。
`;

    const resp = await callOpenAIOnce({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 1200,
    }, 30_000);

    const raw = extractTextFromResponse(resp);
    let detail: any = null;
    try {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first >= 0 && last >= 0) {
        detail = JSON.parse(raw.slice(first, last + 1));
      } else {
        detail = JSON.parse(raw);
      }
    } catch (e) {
      console.error("refineRecipe parse error:", e, raw);
      detail = { detailed_steps: [], raw };
    }

    return NextResponse.json({ detail });
  } catch (err: any) {
    console.error("refineRecipe error:", err);
    return NextResponse.json({ error: err?.message ?? "server error" }, { status: 500 });
  }
}
