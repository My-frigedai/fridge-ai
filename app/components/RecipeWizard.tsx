// app/components/RecipeWizard.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useFridge } from "./FridgeProvider";
import WizardModal from "./WizardModal";

type MenuCandidate = {
  title: string;
  time?: string;
  difficulty?: string;
  tips?: string;
  ingredients?: any[];
  steps?: string[];
  usedItems?: string[];
  [k: string]: any;
};

export default function RecipeWizard() {
  const { items = [], setShopping, setToast } = useFridge();

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [servings, setServings] = useState<number>(2);
  const [appetite, setAppetite] = useState<string>("普通");
  const [loading, setLoading] = useState(false);
  const [menus, setMenus] = useState<MenuCandidate[] | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<MenuCandidate | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<any | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Timer states
  const [activeTimers, setActiveTimers] = useState<Record<number, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<number, boolean>>({});
  const timerRefs = useRef<Record<number, number>>({}); // window.setInterval ids

  // Step expand / collapse & completion
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});

  // persist / restore
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("fridgeapp:menus") : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMenus(parsed);
      }
      const recipeRaw = typeof window !== "undefined" ? localStorage.getItem("fridgeapp:recipeDetail") : null;
      if (recipeRaw) setRecipeDetail(JSON.parse(recipeRaw));
    } catch (e) {
      console.warn("localStorage restore failed", e);
    }
  }, []);

  useEffect(() => {
    try {
      if (menus) localStorage.setItem("fridgeapp:menus", JSON.stringify(menus));
      else localStorage.removeItem("fridgeapp:menus");
      if (recipeDetail) localStorage.setItem("fridgeapp:recipeDetail", JSON.stringify(recipeDetail));
      else localStorage.removeItem("fridgeapp:recipeDetail");
    } catch (e) {
      console.warn("localStorage save failed", e);
    }
  }, [menus, recipeDetail]);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      if (prev.length > 0 && prev[0] === t) return [];
      return [t];
    });
  };

  const onWizardComplete = (generated: any[]) => {
    const top = Array.isArray(generated) ? generated.slice(0, 6) : [];
    setMenus(top);
    if (top.length > 0) {
      setSelectedMenu(top[0]);
      setToast?.("献立案を取得しました！");
    } else {
      setToast?.("献立は生成されませんでした。");
    }
  };

  // fetchWithRetry: keep reasonable retries but server-side routes are optimized already
  async function fetchWithRetry(
    url: string,
    opts: RequestInit = {},
    retries = 2,
    baseBackoffMs = 800
  ): Promise<Response> {
    let lastErr: any = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, opts);
        if (res.ok) return res;
        if (res.status === 429) {
          const ra = res.headers.get("Retry-After");
          const raSec = ra ? Number(ra) : NaN;
          const waitMs = !Number.isNaN(raSec) ? raSec * 1000 : baseBackoffMs * Math.pow(2, attempt);
          if (attempt === 0) setToast?.("サーバが混雑しています。自動で再試行します…");
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        if (res.status >= 500 && res.status < 600 && attempt < retries) {
          const waitMs = baseBackoffMs * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return res;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          const waitMs = baseBackoffMs * Math.pow(2, attempt);
          if (attempt === 0) setToast?.("ネットワークエラー。自動で再試行します…");
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }
    if (lastErr) throw lastErr;
    throw new Error("fetchWithRetry failed");
  }

  // helper: robust compare names (normalize)
  const normalizeName = (s: any) => String(s ?? "").trim().toLowerCase();

  // determine if step should have timer by keywords or explicit minutes
  const stepNeedsTimer = (s: string, timers?: any[]) => {
    if (!s) return false;
    const text = String(s);
    // explicit minutes: "5分" etc.
    if (/\d+\s*分/.test(text)) return true;

    // cooking verbs
    const verbs = ["煮", "焼", "炒", "茹", "揚", "蒸", "煮込", "グリル", "ロースト"];
    for (const v of verbs) {
      if (text.includes(v)) return true;
    }
    // fallback: if timers provided for step index, use it
    if (Array.isArray(timers) && timers.length > 0) {
      try {
        // timers might be objects with step field - check presence
        return timers.some((t: any) => typeof t.step === "number" && text.includes(String(t.step)));
      } catch {}
    }
    return false;
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.floor(Math.max(0, sec) % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // start a timer for stepIndex with given seconds
  const startTimer = (stepIndex: number, seconds: number) => {
    if (!seconds || seconds <= 0) return;
    // don't start another interval for same index
    if (timerRefs.current[stepIndex]) return;

    setActiveTimers((prev) => ({ ...prev, [stepIndex]: seconds }));
    setRunningTimers((prev) => ({ ...prev, [stepIndex]: true }));

    timerRefs.current[stepIndex] = window.setInterval(() => {
      setActiveTimers((prev) => {
        const left = (prev[stepIndex] ?? 0) - 1;
        if (left <= 0) {
          // clear interval
          if (timerRefs.current[stepIndex]) {
            clearInterval(timerRefs.current[stepIndex]);
            delete timerRefs.current[stepIndex];
          }
          setRunningTimers((r) => ({ ...r, [stepIndex]: false }));
          setToast?.("タイマーが終了しました");
          return { ...prev, [stepIndex]: 0 };
        }
        return { ...prev, [stepIndex]: left };
      });
    }, 1000);
  };

  const pauseTimer = (stepIndex: number) => {
    if (timerRefs.current[stepIndex]) {
      clearInterval(timerRefs.current[stepIndex]);
      delete timerRefs.current[stepIndex];
    }
    setRunningTimers((prev) => ({ ...prev, [stepIndex]: false }));
  };

  const resetTimer = (stepIndex: number, initialSeconds: number) => {
    if (timerRefs.current[stepIndex]) {
      clearInterval(timerRefs.current[stepIndex]);
      delete timerRefs.current[stepIndex];
    }
    setActiveTimers((prev) => ({ ...prev, [stepIndex]: initialSeconds }));
    setRunningTimers((prev) => ({ ...prev, [stepIndex]: false }));
  };

  useEffect(() => {
    // cleanup
    return () => {
      Object.keys(timerRefs.current).forEach((k) => {
        const id = timerRefs.current[Number(k)];
        if (id) clearInterval(id);
      });
      timerRefs.current = {};
    };
  }, []);

  // fetch detail (menu card tapped)
  const fetchDetail = async (menu: MenuCandidate) => {
    if (!menu) return;
    setSelectedMenu(menu);
    setRecipeDetail(null);
    setLoading(true);
    setOpenSteps({});
    setDoneSteps({});
    setActiveTimers({});
    setRunningTimers({});

    try {
      const body: any = {
        title: menu.title,
        fridgeItems: (items ?? []).map((i) => i.name),
        itemsToUse: Array.isArray(menu.usedItems) && menu.usedItems.length ? menu.usedItems : [],
        allowAny: false,
      };

      const res = await fetchWithRetry("/api/getRecipeDetail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      }, 2, 900);

      let j: any = {};
      try { j = await res.json(); } catch (e) { j = {}; console.warn("fetchDetail: non-json response", e); }

      if (!res.ok) {
        const message = j?.error ?? `レシピの取得に失敗しました（ステータス:${res.status}）`;
        setToast?.(message);
        setLoading(false);
        return;
      }

      const recipe = j.recipe ?? j;

      // ingredients normalization and presence detection
      const haveList = (items ?? []).map((i) => normalizeName(i.name));
      // try read explicit grocery_additions / missingIngredients
      const explicitMissing: string[] = Array.isArray(recipe.grocery_additions) && recipe.grocery_additions.length
        ? recipe.grocery_additions.map(normalizeName)
        : Array.isArray(recipe.missingIngredients) && recipe.missingIngredients.length
        ? recipe.missingIngredients.map(normalizeName)
        : [];

      const ing = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((it: any) => {
            // ingredient might be object or string
            if (typeof it === "string") {
              const name = it;
              const norm = normalizeName(name);
              const present = haveList.some((h) => norm.includes(h) || h.includes(norm));
              const missing = explicitMissing.length ? explicitMissing.includes(norm) : !present;
              return { name, amount: "", present: present && !missing, missing };
            }
            const name = it.name ?? String(it);
            const qps = it.quantity_per_serving ?? it.quantityPerServing ?? it.qps ?? null;
            const unit = it.unit ?? it.unit_of ?? "";
            const amount = qps ? `${qps}${unit}` : (it.total_quantity ? `${it.total_quantity}${unit}` : "");
            const norm = normalizeName(name);
            const present = haveList.some((h) => norm.includes(h) || h.includes(norm));
            const missing = explicitMissing.length ? explicitMissing.includes(norm) : !present;
            return { name, amount, present: present && !missing, missing };
          })
        : [];

      const steps: string[] = Array.isArray(recipe.steps) ? recipe.steps : [];
      // derive timers: prefer recipe.timers else extract from steps string (only for cooking verbs)
      const timersFromResp: any[] = Array.isArray(recipe.timers) ? recipe.timers : [];

      const timersSeconds: Record<number, number> = {};
      for (let i = 0; i < steps.length; i++) {
        // if recipe.timers has step entries
        const tObj = timersFromResp.find((t: any) => Number(t.step) === i);
        if (tObj && Number.isFinite(Number(tObj.seconds))) {
          timersSeconds[i] = Number(tObj.seconds);
          continue;
        }
        // try to parse "約5分" in step
        const s = String(steps[i] ?? "");
        const m = s.match(/約?(\d+)\s*分/);
        if (m) {
          timersSeconds[i] = Number(m[1]) * 60;
          continue;
        }
        // if the step includes cooking verbs but no explicit minutes, set a reasonable default (configurable)
        if (stepNeedsTimer(s, timersFromResp)) {
          // default mapping heuristics
          if (s.includes("炒")) timersSeconds[i] = 5 * 60;
          else if (s.includes("煮") || s.includes("煮込")) timersSeconds[i] = 15 * 60;
          else if (s.includes("茹") || s.includes("揚") || s.includes("蒸")) timersSeconds[i] = 8 * 60;
        }
      }

      // initialize timers state but do not auto-start
      const initialTimers: Record<number, number> = {};
      for (const idx of Object.keys(timersSeconds)) {
        const k = Number(idx);
        initialTimers[k] = timersSeconds[k];
      }

      setActiveTimers(initialTimers);
      setRecipeDetail({ ...recipe, ingredients: ing, steps, timers: timersFromResp });

      // set toast & persist
      setToast?.("レシピを取得しました！");
      try { localStorage.setItem("fridgeapp:recipeDetail", JSON.stringify({ ...recipe, ingredients: ing, steps, timers: timersFromResp })); } catch {}
    } catch (err: any) {
      console.error("fetchDetail err:", err);
      setToast?.("レシピ取得中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // --- safe setter helper for shopping list updates ---
  const safeSetShopping = (updater: (prev: any[]) => any[]) => {
    if (typeof setShopping === "function") {
      (setShopping as React.Dispatch<React.SetStateAction<any[]>>)((prev) => {
        const prevArr = Array.isArray(prev) ? prev : [];
        const next = [...prevArr];
        const result = updater(next);
        return Array.isArray(result) ? result : next;
      });
    } else {
      console.warn("setShopping is not available or not a function");
    }
  };

  const addMissingToShopping = (recipe: any) => {
    if (!recipe) return;
    const have = (items ?? []).map((i) => normalizeName(i.name));
    const candidatesRaw: any[] = Array.isArray(recipe.grocery_additions) && recipe.grocery_additions.length
      ? recipe.grocery_additions
      : (Array.isArray(recipe.missingIngredients) && recipe.missingIngredients.length ? recipe.missingIngredients : []);
    // fallback: find ingredients marked missing
    let missing: string[] = candidatesRaw.length
      ? candidatesRaw.map((x) => String(x))
      : (Array.isArray(recipe.ingredients) ? recipe.ingredients.filter((it: any) => it.missing).map((it: any) => String(it.name)) : []);

    // normalize and filter duplicates
    missing = Array.from(new Set(missing.map((m) => String(m).trim()))).filter(m => m);

    if (missing.length === 0) {
      setToast?.("不足している食材はありません");
      return;
    }

    // Use safeSetShopping to avoid type errors at build-time
    safeSetShopping((next) => {
      missing.forEach((m: string) => {
        if (!next.find((x: any) => normalizeName(x.name) === normalizeName(m))) next.push({ name: m, done: false });
      });
      return next;
    });

    setToast?.(`${missing.length} 個の食材を買い物リストに追加しました`);
  };

  const normalizeStepDuration = (s: string) => {
    const m = String(s).match(/約?(\d+)\s*分/);
    if (m) return Number(m[1]) * 60;
    return null;
  };

  const toggleStepOpen = (idx: number) => {
    setOpenSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleStepDone = (idx: number) => {
    setDoneSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const btnTap = { whileTap: { scale: 0.985, y: 0.5 } };

  const cardBase = "rounded-2xl border p-4 modal-card";
  const titleClass = "text-[var(--color-text-primary)]";
  const metaClass = "text-[var(--color-text-muted)] text-sm";

  return (
    <div className="space-y-4">
      <motion.div
        layout
        className={`${cardBase} bg-[var(--surface-bg)] border-[var(--surface-border)]`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`text-lg font-semibold mb-2 wizard-title ${titleClass}`}>
          ウィザードで献立を作成
        </div>
        <div className={`text-sm mb-3 wizard-subtitle ${metaClass}`}>作りたい料理タイプを選択し、人数を指定してください。</div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {["主食", "主菜", "副菜", "汁物", "デザート"].map((t: string) => {
            const selected = selectedTypes.includes(t);
            return (
              <motion.button
                key={t}
                onClick={() => toggleType(t)}
                {...btnTap}
                aria-pressed={selected}
                className={`rounded-full px-3 py-2 text-sm focus:outline-none transition ${selected ? "bg-[color:var(--accent)] text-white shadow" : "bg-[var(--surface-bg)] border-[var(--surface-border)] text-[var(--color-text-primary)]"}`}
              >
                <span className={`${selected ? "font-semibold" : ""}`}>{t}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className={`text-sm block wizard-label ${titleClass}`}>人数</label>
            <input aria-label="人数" type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value || 1))} className="rounded-xl border px-3 py-2 w-24 wizard-input" />
          </div>
          <div>
            <label className={`text-sm block wizard-label ${titleClass}`}>食欲</label>
            <select aria-label="食欲" value={appetite} onChange={(e) => setAppetite(e.target.value)} className="rounded-xl border px-3 py-2 wizard-input">
              <option>小食</option>
              <option>普通</option>
              <option>大食い</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <motion.button {...btnTap} onClick={() => setWizardOpen(true)} disabled={loading} className={`rounded-full px-4 py-2 text-white ${loading ? "bg-blue-400" : "bg-blue-600"}`} aria-label="献立を生成">献立を生成</motion.button>

          <motion.button {...btnTap} onClick={() => { setMenus(null); setSelectedMenu(null); setRecipeDetail(null); try { localStorage.removeItem("fridgeapp:menus"); localStorage.removeItem("fridgeapp:selectedMenuIndex"); localStorage.removeItem("fridgeapp:recipeDetail"); } catch (e) { } }} className="rounded-full px-4 py-2 bg-[var(--surface-bg)] border-[var(--surface-border)] text-[var(--color-text-primary)]">リセット</motion.button>
        </div>
      </motion.div>

      <div>
        {menus === null ? (
          <div className={`${metaClass}`}>献立候補はまだありません。ウィザードで生成してください。</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {menus.map((m: MenuCandidate, i: number) => (
              <motion.div key={i} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-xl shadow cursor-pointer bg-[var(--surface-bg)] border-[var(--surface-border)]" onClick={() => fetchDetail(m)} role="button" tabIndex={0}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-semibold ${titleClass}`}>{m.title}</div>
                    <div className={`${metaClass}`}>⏱ {m.time ?? "約30分"} • 難易度: {m.difficulty ?? "不明"}</div>
                    {m.tips && <div className={`${metaClass} mt-2`}>💡 {m.tips}</div>}
                    {Array.isArray(m.usedItems) && m.usedItems.length > 0 && <div className={`${metaClass} mt-1`}>使用指定: {m.usedItems.join(", ")}</div>}
                  </div>
                </div>
              </motion.div>
            ))}
            <div className={`${metaClass} mt-2`}>※カードをタップして詳細を取得します。</div>
          </div>
        )}
      </div>

      {selectedMenu && (
        <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`${cardBase} bg-[var(--surface-bg)] border-[var(--surface-border)]`}>
          <div className="flex items-start justify-between">
            <div>
              <div className={`text-xl font-bold ${titleClass}`}>{selectedMenu.title}</div>
              <div className={`${metaClass}`}>⏱ {recipeDetail?.time_minutes ?? selectedMenu.time ?? "約30分"} • 難易度: {recipeDetail?.difficulty ?? selectedMenu.difficulty ?? "不明"}</div>
            </div>
          </div>

          <div className="mt-3">
            {loading ? <div className={`${metaClass}`}>レシピを取得中…</div> : recipeDetail ? (
              <>
                <div className={`font-semibold mt-2 ${titleClass}`}>材料</div>
                <ul className="pl-5 mt-1 text-[var(--color-text-primary)]">
                  {Array.isArray(recipeDetail.ingredients) && recipeDetail.ingredients.length > 0 ? recipeDetail.ingredients.map((it: any, idx: number) => (
                    <li key={idx} className="mb-2 flex items-start justify-between">
                      <div>
                        <span className="font-medium">{it.name}</span>
                        {it.notes ? <span className="text-xs text-[var(--color-text-muted)] ml-2">({it.notes})</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {it.missing ? (
                          <span className="badge bg-red-600 text-white" aria-hidden>欠品</span>
                        ) : it.present ? (
                          <span className="badge" aria-hidden>在庫あり</span>
                        ) : (
                          <span className="badge" style={{ background: "transparent", border: "1px solid var(--surface-border)" }}>不明</span>
                        )}
                        <div className="text-sm text-[var(--color-text-muted)]">{it.amount ?? (it.quantity_per_serving ? `${it.quantity_per_serving}${it.unit}` : "")}</div>
                      </div>
                    </li>
                  )) : <li className={`${metaClass}`}>材料情報がありません</li>}
                </ul>

                <div className="mt-3 flex gap-2">
                  <motion.button {...btnTap} onClick={() => addMissingToShopping(recipeDetail)} className="rounded-full px-3 py-2 text-sm bg-yellow-500 text-white">不足を買い物リストへ追加</motion.button>
                  <motion.button {...btnTap} onClick={() => { try { const list = (recipeDetail.ingredients ?? []).map((it: any) => `${it.name} ${it.amount ?? ""}`).join("\n"); navigator.clipboard?.writeText(list); setToast?.("材料一覧をコピーしました"); } catch { setToast?.("コピーに失敗しました"); } }} className="rounded-full px-3 py-2 text-sm bg-[var(--surface-bg)] border-[var(--surface-border)] text-[var(--color-text-primary)]">材料をコピー</motion.button>
                </div>

                <div className={`font-semibold mt-3 ${titleClass}`}>手順</div>

                <ol className="list-decimal pl-5 mt-1 text-[var(--color-text-primary)]">
                  {Array.isArray(recipeDetail.steps) && recipeDetail.steps.length > 0 ? recipeDetail.steps.map((s: string, i: number) => {
                    // prefer explicit timer seconds from recipeDetail.timers array if available
                    const timerObj = Array.isArray(recipeDetail.timers) ? recipeDetail.timers.find((t: any) => Number(t.step) === i) : null;
                    const initialSeconds = timerObj?.seconds ?? normalizeStepDuration(s) ?? activeTimers[i] ?? null;
                    const needsTimerFlag = stepNeedsTimer(s, recipeDetail.timers) && initialSeconds;
                    const left = activeTimers[i] ?? (initialSeconds ?? 0);
                    const running = !!runningTimers[i];

                    return (
                      <li key={i} className="mb-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-3">
                            <button onClick={() => toggleStepOpen(i)} className="text-sm" aria-expanded={!!openSteps[i]}>
                              {openSteps[i] ? "▾" : "▸"}
                            </button>
                            <div className={`${doneSteps[i] ? "line-through text-[var(--color-text-muted)]" : ""}`}>
                              {`Step ${i + 1}: `}{s}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {needsTimerFlag ? (
                              <>
                                <div className="text-sm text-[var(--color-text-muted)]">{formatTime(left)}</div>
                                <button onClick={() => {
                                  if (!running) {
                                    // start with left if exists else initialSeconds
                                    const sec = activeTimers[i] ?? (initialSeconds ?? 0);
                                    startTimer(i, sec);
                                  } else {
                                    pauseTimer(i);
                                  }
                                }} className="rounded px-2 py-1 text-xs bg-blue-600 text-white" aria-label="開始/一時停止">
                                  {running ? "⏸" : "▸"}
                                </button>
                                <button onClick={() => resetTimer(i, initialSeconds ?? 0)} className="rounded px-2 py-1 text-xs bg-gray-200" aria-label="リセット">□</button>
                              </>
                            ) : null}

                            <button onClick={() => toggleStepDone(i)} className={`rounded px-2 py-1 text-xs ${doneSteps[i] ? "bg-green-600 text-white" : "bg-[var(--surface-bg)] border-[var(--surface-border)] text-[var(--color-text-primary)]"}`} aria-label="完了切替">
                              {doneSteps[i] ? "✔" : "完了"}
                            </button>
                          </div>
                        </div>

                        {openSteps[i] ? (
                          <div className="mt-2 text-sm text-[var(--color-text-muted)]">
                            {/* 展開したときに補足を表示（もしあれば） */}
                            {recipeDetail.timers && Array.isArray(recipeDetail.timers) && recipeDetail.timers.find((t: any) => t.step === i) ? (
                              <div>推定時間: {Math.floor((recipeDetail.timers.find((t: any) => t.step === i).seconds) / 60)}分</div>
                            ) : initialSeconds ? (
                              <div>推定時間: {Math.floor(initialSeconds / 60)}分</div>
                            ) : (
                              <div>時間の目安は設定されていません</div>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  }) : <li className={`${metaClass}`}>手順情報がありません</li>}
                </ol>

                {recipeDetail.tips && <div className={`font-semibold mt-3 ${titleClass}`}>コツ</div>}
                {Array.isArray(recipeDetail.tips) && recipeDetail.tips.length > 0 && recipeDetail.tips.map((t: string, i: number) => <div key={i} className={`${metaClass} mt-1`}>💡 {t}</div>)}

                {recipeDetail.pitfalls && Array.isArray(recipeDetail.pitfalls) && recipeDetail.pitfalls.length > 0 && (
                  <>
                    <div className={`font-semibold mt-3 ${titleClass}`}>失敗しやすいポイント</div>
                    <ul className="pl-5 mt-1 text-[var(--color-text-primary)]">
                      {recipeDetail.pitfalls.map((p: string, i: number) => <li key={i} className="mb-1 text-sm text-[var(--color-text-muted)]">⚠️ {p}</li>)}
                    </ul>
                  </>
                )}
              </>
            ) : <div className={`${metaClass}`}>詳細が読み込まれていません。候補をタップして詳細取得してください。</div>}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <motion.button {...btnTap} onClick={() => { setToast?.("このデモでは在庫差し引きは省略"); }} className="rounded-2xl px-4 py-2 text-sm font-medium bg-green-600 text-white">完成（在庫差し引き）</motion.button>
          </div>
        </motion.div>
      )}

      <WizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(menus) => { onWizardComplete(menus); setWizardOpen(false); }}
        fridgeItems={(items ?? []).map((i: any) => i.name)}
        selectedTypes={selectedTypes}
        servings={servings}
        appetite={appetite}
      />
    </div>
  );
}
