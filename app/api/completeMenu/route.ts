// app/api/completeMenu/route.ts
import { NextResponse } from "next/server";
import { parseQuantityText, normalizeName } from "@/lib/quantity";

type Item = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  expiry?: string | null;
  category?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawItems: Item[] = Array.isArray(body.items) ? body.items : [];
    const usedRaw: any[] = Array.isArray(body.usedIngredients)
      ? body.usedIngredients
      : [];

    // Defensive copy
    const items = rawItems.map((it) => ({ ...it }));

    // Parse used ingredients: accept either {name, quantity, unit} or plain strings
    const usedParsed = usedRaw
      .map((u) => {
        if (!u) return null;
        if (typeof u === "string") {
          const q = parseQuantityText(u);
          // Remove trailing numeric/units to extract probable name
          const name = String(u)
            .replace(
              /[\d.,\/\s\-〜~]*(ml|l|g|kg|個|枚|本|カップ|cup|cups|tsp|tbsp)?\s*$/i,
              "",
            )
            .trim();
          return { name: name || q.raw || u, parsed: q, raw: u };
        } else if (typeof u === "object") {
          // Structured: {name, quantity, unit}
          if (u.quantity && u.unit) {
            const combined = `${u.name ?? ""} ${u.quantity}${u.unit}`;
            const q = parseQuantityText(combined);
            return {
              name: u.name ?? u.label ?? combined,
              parsed: q,
              raw: combined,
            };
          }
          if (u.quantity && !u.unit) {
            // assume count
            return {
              name: u.name ?? u.label ?? "",
              parsed: { amount: Number(u.quantity) || 0, unit: "count" },
              raw: JSON.stringify(u),
            };
          }
          return {
            name: u.name || u.label || JSON.stringify(u),
            parsed: { amount: 1, unit: "count" },
            raw: JSON.stringify(u),
          };
        }
        return null;
      })
      .filter(Boolean) as {
      name: string;
      parsed: { amount: number; unit: string; raw?: string };
      raw: string;
    }[];

    // Helper: find best matching item index for a used ingredient name
    function findMatchIndex(useName: string) {
      const target = normalizeName(useName);
      // 1) direct include (item name includes target)
      for (let i = 0; i < items.length; i++) {
        const iname = normalizeName(items[i].name || "");
        if (!iname) continue;
        if (iname.includes(target) || target.includes(iname)) return i;
      }
      // 2) token match (split words)
      const tokens = target.split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const iname = normalizeName(items[i].name || "");
          for (const t of tokens) {
            if (iname.includes(t)) return i;
          }
        }
      }
      // 3) fallback: startsWith/includes
      for (let i = 0; i < items.length; i++) {
        const iname = normalizeName(items[i].name || "");
        if (iname && (iname.startsWith(target) || target.startsWith(iname)))
          return i;
      }
      return -1;
    }

    // Iterate usedParsed and subtract quantities
    for (const u of usedParsed) {
      const idx = findMatchIndex(u.name);
      if (idx < 0) {
        // No match found — skip
        continue;
      }
      const targetItem = items[idx];
      const itemQty = Number(targetItem.quantity) || 0;
      const itemUnit = (targetItem.unit || "").toLowerCase();

      const usedAmount = Number(u.parsed.amount || 0);
      const usedUnit = (u.parsed.unit || "").toLowerCase();

      let newQty = itemQty;

      if (usedUnit === "ml" && (itemUnit === "ml" || /l|ml/.test(itemUnit))) {
        newQty = Math.max(0, itemQty - usedAmount);
      } else if (
        usedUnit === "g" &&
        (itemUnit === "g" || /kg|g/.test(itemUnit))
      ) {
        newQty = Math.max(0, itemQty - usedAmount);
      } else if (
        usedUnit === "count" &&
        (itemUnit === "" || /個|枚|本|count/.test(itemUnit))
      ) {
        newQty = Math.max(0, itemQty - usedAmount);
      } else {
        const iname = (targetItem.name || "").toLowerCase();
        if (
          iname.includes("牛乳") ||
          iname.includes("ミルク") ||
          iname.includes("milk") ||
          iname.includes("ジュース") ||
          iname.includes("水")
        ) {
          if (usedUnit === "ml") newQty = Math.max(0, itemQty - usedAmount);
          else if (usedUnit === "g") newQty = Math.max(0, itemQty - usedAmount);
          else if (usedUnit === "count")
            newQty = Math.max(0, itemQty - usedAmount);
          else newQty = Math.max(0, itemQty - (usedAmount || 0));
        } else {
          // Fallback: subtract as count if unknown
          newQty = Math.max(0, itemQty - (usedAmount || 1));
        }
      }

      items[idx].quantity = Number(Number(newQty).toFixed(3));
    }

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("completeMenu error:", err);
    return NextResponse.json(
      { error: "在庫の更新中に問題が発生しました。" },
      { status: 500 },
    );
  }
}
