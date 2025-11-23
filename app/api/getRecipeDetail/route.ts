// app/api/getRecipeDetail/route.ts
import { NextResponse } from "next/server";
import { callOpenAIOnce, extractTextFromResponse, extractJsonFromText } from "@/lib/openai";

/**
 * getRecipeDetail (single-call)
 * - preferHighQuality flag selects gpt-4o; default uses gpt-4o-mini
 * - only 1 OpenAI call; if it fails (429/quota/timeout) -> immediate deterministic fallback
 * - returns normalized recipe object for frontend
 */

export async function POST(req: Request) {
  try {
    const bodyRaw = await req.json().catch(() => ({}));
    const title = typeof bodyRaw.title === "string" ? bodyRaw.title : "";
    const fridgeItems = Array.isArray(bodyRaw.fridgeItems) ? bodyRaw.fridgeItems : [];
    const itemsToUse = Array.isArray(bodyRaw.itemsToUse) ? bodyRaw.itemsToUse : [];
    const allowAny = !!bodyRaw.allowAny || bodyRaw.mode === "omakase";
    const servings = Math.max(1, Number(bodyRaw.servings ?? 1));
    const preferHighQuality = !!bodyRaw.highQuality; // UI can pass this to force gpt-4o

    if (!title) {
      return NextResponse.json({ error: "タイトルが指定されていません。" }, { status: 400 });
    }

    const fridgeText = fridgeItems.length ? fridgeItems.join(", ") : "なし";
    const mustUseText = itemsToUse.length ? itemsToUse.join(", ") : "なし";
    const modeInstruction = allowAny
      ? `おまかせ: 登録済み食材（${fridgeText}）を優先して使用してください。必要な不足は grocery_additions に列挙してください。`
      : `指定: 以下の必須食材（${mustUseText}）を必ず使用してください。`;

    // Compact, targeted prompt to minimize token cost
    const prompt = `
あなたは家庭料理のプロです。次の条件に従って、"${title}" の**再現性のある最小限のJSONレシピ**を1つ返してください。
- ${modeInstruction}
- 人数: ${servings}人
- 各食材は 1人分あたり quantity_per_serving を数値で、unit を g/ml/個/tbsp/tsp 等で示してください。
- 必要なら grocery_additions（不足食材）を配列で返してください。
- steps は配列。ステップ内に所要時間が分かれば括弧で示してください（例: "炒める（約5分）"）。
- 出力は余分なテキストなしで **JSONオブジェクト** のみを返してください。

出力例（参考）:
{
  "title":"文字列",
  "servings": 2,
  "time_minutes": 30,
  "difficulty":"低",
  "ingredients":[{"name":"玉ねぎ","quantity_per_serving":50,"unit":"g","total_quantity":100,"optional":false}],
  "steps":["切る（約5分）","炒める（約10分）"],
  "timers":[{"step":1,"seconds":600,"label":"炒める"}],
  "tips":["短いコツ"],
  "grocery_additions":["牛乳"],
  "nutrition_estimate": {}
}
`;

    try {
      const resp = await callOpenAIOnce(
        {
          input: prompt,
          preferHighQuality: preferHighQuality,
          max_output_tokens: 1000,
          temperature: 0.12,
        },
        15_000
      );

      const raw = extractTextFromResponse(resp) ?? "";
      console.log("[getRecipeDetail] raw preview:", raw?.slice?.(0, 800) ?? "");

      // Extract JSON object robustly
      let parsed: any = null;
      const jsonText = extractJsonFromText(raw);
      if (jsonText) {
        try {
          parsed = JSON.parse(jsonText);
        } catch (e) {
          parsed = null;
        }
      } else {
        // quick parse attempt
        try {
          parsed = JSON.parse(raw);
        } catch {}
      }

      if (!parsed) {
        // cannot parse model output -> deterministic fallback (one-shot)
        const fallback = makeFallbackRecipe(title, servings, itemsToUse, fridgeItems);
        return NextResponse.json({ recipe: fallback, raw, fallback: true });
      }

      const recipe = normalizeParsedRecipe(parsed, title, servings, raw);
      return NextResponse.json({ recipe, raw, fallback: false });
    } catch (err: any) {
      console.warn("getRecipeDetail: OpenAI call failed:", err?.status ?? err?.message ?? err);
      // immediate fallback — do not retry
      const fallback = makeFallbackRecipe(title, servings, itemsToUse, fridgeItems);
      // If OpenAI gave explicit quota error, surface that for UI to show a polite message
      const details = err?.raw ?? err?.message ?? String(err);
      return NextResponse.json({ recipe: fallback, fallback: true, details }, { status: 200 });
    }
  } catch (err: any) {
    console.error("getRecipeDetail fatal:", err);
    return NextResponse.json({ error: "レシピ生成に失敗しました", details: err?.message ?? String(err) }, { status: 500 });
  }
}

/** Helpers — keep deterministic and robust **/

function makeFallbackRecipe(title: string, servings: number, mustUse: string[], fridgeItems: string[]) {
  const main = mustUse.length ? mustUse.slice(0, 4) : fridgeItems.length ? fridgeItems.slice(0, 4) : ["卵", "野菜"];
  return {
    title: title || "簡易レシピ",
    description: "AIが利用できないため簡易レシピを生成しました。",
    servings,
    time_minutes: 25,
    difficulty: "低",
    ingredients: main.map((n: string) => ({
      name: n,
      quantity_per_serving: 1,
      unit: "個",
      total_quantity: 1 * servings,
      optional: false,
      substitutes: [],
      notes: "",
    })),
    steps: ["材料を揃える（約5分）", "炒める（約10分）", "味付けして完成（約10分）"],
    timers: [{ step: 1, seconds: 600, label: "炒める" }],
    tips: ["まずは少量の塩で味をみて調整すること"],
    pitfalls: [],
    storage: "当日中に食べてください",
    allergy_warnings: [],
    grocery_additions: [], // user can add manually if needed
    nutrition_estimate: {},
  };
}

function toNumberOrUndefined(v: any): number | undefined {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return undefined;
}

function deriveTimersFromSteps(steps: any): any[] {
  try {
    if (!Array.isArray(steps)) return [];
    const timers: any[] = [];
    for (let i = 0; i < steps.length; i++) {
      const s = String(steps[i] ?? "");
      const m = s.match(/約?(\d+)\s*分/);
      if (m) {
        const minutes = Number(m[1]);
        timers.push({ step: i, seconds: minutes * 60, label: s.replace(/（.*?）/g, "").slice(0, 60) });
      }
    }
    return timers;
  } catch {
    return [];
  }
}

function normalizeParsedRecipe(parsed: any, fallbackTitle: string, fallbackServings: number, raw: string) {
  const title = typeof parsed.title === "string" ? parsed.title : fallbackTitle;
  const servings = Number(parsed.servings ?? fallbackServings ?? 1);
  const time_minutes = Number(parsed.time_minutes ?? parsed.time ?? 30) || 30;
  const difficulty = ["低", "中", "高"].includes(parsed.difficulty) ? parsed.difficulty : parsed.difficulty ?? "中";

  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map((ing: any) => {
        const name = String(ing?.name ?? ing ?? "").trim();
        const qps = toNumberOrUndefined(ing?.quantity_per_serving ?? ing?.qps ?? ing?.quantityPerServing);
        const unit = String(ing?.unit ?? "個");
        const total = toNumberOrUndefined(ing?.total_quantity ?? ing?.totalQuantity ?? (qps !== undefined ? qps * servings : undefined));
        return {
          name,
          quantity_per_serving: qps ?? 0,
          unit,
          total_quantity: total ?? (qps ? qps * servings : 0),
          optional: !!ing?.optional,
          substitutes: Array.isArray(ing?.substitutes) ? ing.substitutes.map(String) : [],
          notes: ing?.notes ?? "",
        };
      })
    : [];

  const steps = Array.isArray(parsed.steps) ? parsed.steps.map(String) : [];
  const timers = Array.isArray(parsed.timers) ? parsed.timers : deriveTimersFromSteps(steps);

  const tips = Array.isArray(parsed.tips) ? parsed.tips : parsed.tips ? [String(parsed.tips)] : [];
  const pitfalls = Array.isArray(parsed.pitfalls) ? parsed.pitfalls : parsed.pitfalls ? [String(parsed.pitfalls)] : [];
  const storage = parsed.storage ?? "";
  const allergy_warnings = Array.isArray(parsed.allergy_warnings) ? parsed.allergy_warnings : parsed.allergy_warnings ? [String(parsed.allergy_warnings)] : [];
  const grocery_additions = Array.isArray(parsed.grocery_additions) ? parsed.grocery_additions : parsed.grocery_additions ? [String(parsed.grocery_additions)] : [];
  const nutrition_estimate = parsed.nutrition_estimate ?? {};

  return {
    title,
    description: parsed.description ?? "",
    servings,
    time_minutes,
    difficulty,
    ingredients,
    steps,
    timers,
    tips,
    pitfalls,
    storage,
    allergy_warnings,
    grocery_additions,
    nutrition_estimate,
    raw,
  };
}
