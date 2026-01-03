// app/api/generateMenu/route.ts
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { callOpenAIOnce, extractTextFromResponse } from "@/lib/openai";
import { rateLimit } from "@/lib/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    // --- 🔒 認証チェック ---
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }
    const userId = token.sub as string;

    // --- ⚙️ レート制限 ---
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("host") ||
      "unknown";
    const rl = await rateLimit(`generate:${ip}`, 60, 60);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "リクエストが多すぎます。しばらくしてからお試しください。" },
        { status: 429 },
      );
    }

    // --- 📦 リクエスト Body ---
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    const prefs = (body.preferences ?? {}) as any;

    if (!items.length) {
      return NextResponse.json({ error: "食材が必要です。" }, { status: 400 });
    }

    // --- 🕓 UsageHistory 保存 ---
    try {
      await prisma.usageHistory.create({
        data: {
          userId,
          action: "generate",
          meta: { at: new Date().toISOString() },
        } as any,
      });
    } catch (err) {
      console.warn("usageHistory 保存に失敗:", err);
    }

    // --- 🧠 OpenAI プロンプト作成 ---
    const promptParts: string[] = [
      `あなたは一流の料理研究家です。以下の食材を使って家庭で作れる献立を考えてください。`,
      `持っている食材: ${items.join(", ")}`,
    ];

    if (prefs.servings) promptParts.push(`人数: ${prefs.servings}人分`);
    if (prefs.appetite) promptParts.push(`食欲レベル: ${prefs.appetite}`);
    if (prefs.meal_parts && Array.isArray(prefs.meal_parts)) {
      promptParts.push(`希望の構成: ${prefs.meal_parts.join(", ")}`);
    }

    promptParts.push(`
以下の形式のJSON配列のみを出力してください。説明文は不要です。
[
  {
    "title": "鶏の照り焼き",
    "time": "25分",
    "difficulty": "中",
    "tips": "タレは焦げやすいので注意",
    "ingredients": ["鶏もも肉", "醤油", "みりん", "砂糖"],
    "steps": [
      "鶏もも肉を一口大に切る",
      "フライパンで皮目から焼く",
      "タレを加えて煮詰める"
    ],
    "cautions": ["強火で焼きすぎない", "タレを焦がさない"]
  }
]
各献立は最大3件まで。
`);

    const prompt = promptParts.join("\n");

    // --- 🚀 OpenAI 呼び出し ---
    const resp = await callOpenAIOnce(
      { model: "gpt-4o-mini", input: prompt, max_output_tokens: 1000 },
      25000,
    );

    // --- 🧩 JSON 抽出 ---
    const raw = extractTextFromResponse(resp);
    let menus: any[] = [];

    try {
      const first = raw.indexOf("[");
      const last = raw.lastIndexOf("]");
      if (first >= 0 && last >= 0) {
        menus = JSON.parse(raw.slice(first, last + 1));
      } else {
        console.warn("generateMenu: JSON配列が見つかりません:", raw);
      }
    } catch (err) {
      console.warn("generateMenu: JSON parse error:", err, raw);
    }

    // --- 🔧 バリデーション & デフォルト値 ---
    menus = menus.map((m) => ({
      title: m.title ?? "不明な料理",
      time: m.time ?? "約30分",
      difficulty: ["低", "中", "高"].includes(m.difficulty)
        ? m.difficulty
        : "中",
      tips: m.tips ?? "特に注意点はありません。",
      ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
      steps: Array.isArray(m.steps) ? m.steps : ["手順情報が見つかりません。"],
      cautions: Array.isArray(m.cautions) ? m.cautions : [],
    }));

    // --- 🧾 DB 保存（Menu）---
    for (const m of menus) {
      try {
        await prisma.menu.create({
          data: {
            userId,
            title: m.title,
            difficulty: m.difficulty,
            time: m.time,
            tips: m.tips,
            ingredients: m.ingredients,
          } as any,
        });
      } catch (err) {
        console.warn("menu 保存に失敗:", err);
      }
    }

    // --- 🎉 完了レスポンス ---
    return NextResponse.json({ menus });
  } catch (err: any) {
    console.error("generateMenu error:", err);
    return NextResponse.json(
      { error: "献立の生成中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}
