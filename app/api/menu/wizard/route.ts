// app/api/menu/wizard/route.ts
import { NextResponse } from "next/server";
import {
  callOpenAIOnce,
  extractTextFromResponse,
  extractJsonFromText,
} from "@/lib/openai";

/**
 * Wizard route (minimal tokens)
 * - single OpenAI call (preferHighQuality false by default)
 * - returns short menu candidates (title/time/difficulty/tips/usedItems)
 * - on OpenAI error -> deterministic fallback
 */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mealTypes = Array.isArray(body.mealTypes) ? body.mealTypes : ["主菜"];
    const servings = Math.max(1, Number(body.servings ?? 1));
    const usedFridgeItems = Array.isArray(body.usedFridgeItems)
      ? body.usedFridgeItems
      : [];
    const mode = body.mode === "omakase" ? "omakase" : "selected";
    const appetite = typeof body.appetite === "string" ? body.appetite : "普通";
    const preferHighQuality = !!body.highQuality; // optional flag from UI

    const briefItemList = usedFridgeItems.length
      ? usedFridgeItems.join(", ")
      : "なし";

    const modeInstruction =
      mode === "omakase"
        ? `おまかせ: 登録済み食材（${briefItemList}）を優先して使用してください。`
        : `指定: 次の食材（${briefItemList}）を必ず使用してください（他は使用しないでください）。`;

    // Minimal prompt: ask for 3 short candidates (title + usedItems)
    const prompt = `
あなたは家庭料理のプロです。以下の条件で **最大3件** の献立候補を短く作ってください。
出力は**純粋なJSON配列**のみ（余分な説明は一切禁止）。

条件:
- ${modeInstruction}
- 料理タイプ: ${mealTypes.join(", ")}
- 人数: ${servings}人分
- 食欲: ${appetite}

各要素はこの形にしてください（例）:
[
  {
    "title": "○○の炒め物",
    "time": "約20分",
    "difficulty": "低",
    "tips": "短いコツ",
    "ingredients": ["材料1", "材料2"],
    "usedItems": ["冷蔵庫内で使う食材(必須)"]
  }
]
`;

    try {
      const resp = await callOpenAIOnce(
        {
          input: prompt,
          preferHighQuality: preferHighQuality, // default false
          max_output_tokens: 500,
          temperature: 0.15,
        },
        15_000,
      );

      const raw = extractTextFromResponse(resp) ?? "";
      console.log("[wizard] raw preview:", raw?.slice?.(0, 800) ?? "");

      // Try to extract JSON
      let menus: any[] = [];
      const jsonText = extractJsonFromText(raw);
      if (jsonText) {
        try {
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) menus = parsed;
        } catch (e) {
          // parse fail -> keep menus empty and fallback below
        }
      } else {
        // quick attempt: whole raw is array
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) menus = parsed;
        } catch {}
      }

      if (!menus || menus.length === 0) {
        // fallback deterministic
        const fallback = fallbackGeneratedMenus(
          usedFridgeItems,
          mealTypes,
          servings,
        );
        return NextResponse.json({ menus: fallback, raw, fallback: true });
      }

      // normalize
      menus = menus.map((m: any) => ({
        title: typeof m.title === "string" ? m.title : "料理",
        time: typeof m.time === "string" ? m.time : "約30分",
        difficulty: ["低", "中", "高"].includes(m.difficulty)
          ? m.difficulty
          : "中",
        tips: typeof m.tips === "string" ? m.tips : "",
        ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
        usedItems: Array.isArray(m.usedItems) ? m.usedItems : [],
      }));

      return NextResponse.json({ menus, raw, fallback: false });
    } catch (err: any) {
      console.warn("wizard: OpenAI call error:", err);
      // immediate fallback — do not retry
      const fallback = fallbackGeneratedMenus(
        usedFridgeItems,
        mealTypes,
        servings,
      );
      return NextResponse.json({
        menus: fallback,
        raw: null,
        fallback: true,
        details: err?.message ?? String(err),
      });
    }
  } catch (err: any) {
    console.error("wizard route fatal:", err);
    return NextResponse.json(
      { error: "献立生成に失敗しました", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

function fallbackGeneratedMenus(
  usedFridgeItems: string[],
  mealTypes: string[],
  servings: number,
) {
  const items = usedFridgeItems.length
    ? usedFridgeItems
    : ["卵", "野菜", "ごはん"];
  const titles: string[] = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const t = `${items[i]}の${mealTypes[i % mealTypes.length] ?? "料理"}`;
    titles.push(t);
  }
  if (!titles.length) titles.push("簡単おまかせ料理");

  return titles.map((t, idx) => ({
    title: t,
    time: "約20分",
    difficulty: "低",
    tips: "簡易レシピ（AIが使えない場合の代替）",
    ingredients: items.slice(0, 3),
    usedItems: items.slice(0, 1),
  }));
}
