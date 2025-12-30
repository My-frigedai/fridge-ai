// app/components/WizardModal.tsx
"use client";

import React, { useEffect, useState, KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { useFridge } from "./FridgeProvider";

type WizardModalProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (menus: any[]) => void;
  fridgeItems: string[]; // 食材名のみ配列
  selectedTypes?: string[];
  servings?: number | string;
  appetite?: string;
};

export default function WizardModal({
  open,
  onClose,
  onComplete,
  fridgeItems,
  selectedTypes,
  servings,
  appetite,
}: WizardModalProps) {
  const { setShopping } = useFridge();

  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [lastGenerateAt, setLastGenerateAt] = useState<number>(0);
  const [mode, setMode] = useState<"selected" | "omakase">("selected");

  // 初期化（全選択）
  useEffect(() => {
    if (open) {
      const init: Record<string, boolean> = {};
      fridgeItems.forEach((f) => (init[f] = true));
      setSelectedMap(init);
      setLoading(false);
      setMode("selected");
    }
  }, [open, fridgeItems]);

  const selectedNames = Object.keys(selectedMap).filter((k) => selectedMap[k]);
  const selectedCount = selectedNames.length;
  const allSelected =
    fridgeItems.length > 0 && selectedCount === fridgeItems.length;

  const toggleItem = (name: string) => {
    setSelectedMap((s) => ({ ...s, [name]: !s[name] }));
  };

  const selectAll = () => {
    const m: Record<string, boolean> = {};
    fridgeItems.forEach((f) => (m[f] = true));
    setSelectedMap(m);
  };

  const clearAll = () => {
    const m: Record<string, boolean> = {};
    fridgeItems.forEach((f) => (m[f] = false));
    setSelectedMap(m);
  };

  const handleKeyToggle =
    (name: string) => (e: KeyboardEvent<HTMLElement> | React.KeyboardEvent) => {
      if ("key" in e && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        toggleItem(name);
      }
    };

  // 生成（1回呼び出しで完了するように）
  const generateMenus = async () => {
    const now = Date.now();
    if (now - lastGenerateAt < 1500) return;
    setLastGenerateAt(now);

    // if in selected mode, require at least 1 selected
    if (mode === "selected" && selectedCount === 0) {
      toast.error(
        "最低1つの食材を選択してください（使用する食材を選んでください）",
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        mealTypes:
          Array.isArray(selectedTypes) && selectedTypes.length
            ? selectedTypes
            : ["主菜"],
        servings: Number(servings ?? 1),
        appetite: appetite ?? "普通",
        usedFridgeItems: mode === "selected" ? selectedNames : fridgeItems,
        mode: mode === "omakase" ? "omakase" : "selected",
        // highQuality not set by default to save tokens
      };

      const res = await fetch("/api/menu/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.error ??
          (res.status === 429
            ? "AIの利用制限に達しています。時間を空けるか、生成回数を減らしてください。"
            : `献立生成に失敗しました（${res.status}）。`);
        toast.error(msg);
        setLoading(false);
        return;
      }

      const menus = Array.isArray(data.menus) ? data.menus : [];
      onComplete(menus);
      onClose();
      toast.success(
        menus.length ? "献立を取得しました" : "献立が見つかりませんでした",
      );
    } catch (err: any) {
      console.error("WizardModal.generateMenus error", err);
      toast.error("献立生成中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // UI styles
  const itemBaseStyle = {
    background: "var(--surface-bg)",
    color: "var(--color-text-primary)",
    borderColor: "var(--surface-border)",
  } as React.CSSProperties;

  const itemSelectedStyle = {
    background: "var(--accent)",
    color: "white",
    borderColor:
      "color-mix(in srgb, var(--accent) 40%, transparent)" as unknown as string,
  } as React.CSSProperties;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl modal-card">
        <DialogHeader>
          <DialogTitle
            className="text-xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            献立ウィザード — 食材選択
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                冷蔵庫から使う食材を選択してください
              </div>
              <div
                className="text-xs wizard-note"
                style={{ color: "var(--color-text-muted)" }}
              >
                選択した食材のみを使って献立を生成します（選択外の食材は使用しません）。おまかせにすると登録食材から優先して使用します。
              </div>
            </div>

            <div
              style={{ color: "var(--color-text-secondary)" }}
              className="text-sm"
            >
              選択:{" "}
              <strong style={{ color: "var(--color-text-primary)" }}>
                {selectedCount}
              </strong>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              onClick={selectAll}
              aria-label="全選択"
              className="text-sm"
            >
              全選択
            </Button>
            <Button
              variant="outline"
              onClick={clearAll}
              aria-label="全解除"
              className="text-sm"
            >
              全解除
            </Button>

            <div
              className="ml-2 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              {allSelected
                ? "すべて選択済み"
                : `${fridgeItems.length} 件中 ${selectedCount} 件選択`}
            </div>

            <div
              style={{ marginLeft: "auto" }}
              className="flex items-center gap-2"
            >
              <div
                className="text-sm"
                style={{ color: "var(--color-text-primary)" }}
              >
                モード
              </div>
              <Button
                variant={mode === "selected" ? "default" : "outline"}
                onClick={() => setMode("selected")}
                className="text-sm"
                aria-pressed={mode === "selected"}
              >
                選択で生成
              </Button>
              <Button
                variant={mode === "omakase" ? "default" : "outline"}
                onClick={() => setMode("omakase")}
                className="text-sm"
                aria-pressed={mode === "omakase"}
              >
                おまかせ
              </Button>
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-2 max-h-72 overflow-auto p-1"
            role="list"
            aria-label="冷蔵庫の食材リスト"
          >
            {fridgeItems.length === 0 && (
              <div
                className="col-span-2 text-sm"
                style={{ color: "var(--color-text-muted)", padding: 12 }}
              >
                冷蔵庫に食材が登録されていません
              </div>
            )}

            {fridgeItems.map((name) => {
              const sel = !!selectedMap[name];
              return (
                <div
                  key={name}
                  role="listitem"
                  tabIndex={0}
                  aria-pressed={sel}
                  onKeyDown={handleKeyToggle(name)}
                  onClick={() => toggleItem(name)}
                  className="ingredient-row rounded-lg border p-3 cursor-pointer focus:outline-none"
                  style={sel ? itemSelectedStyle : itemBaseStyle}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggleItem(name)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4"
                      aria-label={`使用: ${name}`}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        className="ingredient-name"
                        style={{
                          color: sel ? "white" : "var(--color-text-primary)",
                        }}
                      >
                        {name}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="text-xs wizard-note"
            style={{ color: "var(--color-text-muted)" }}
          >
            ※「選択で生成」は選択した食材のみを使用します。「おまかせ」は登録食材を優先します。指定していない食材は絶対に使いません。
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <DialogFooter>
            <div>
              <Button
                onClick={generateMenus}
                disabled={loading}
                aria-disabled={loading}
                aria-label="この食材で献立を作る"
              >
                {loading
                  ? mode === "omakase"
                    ? "おまかせ中…"
                    : "生成中…"
                  : mode === "omakase"
                    ? "おまかせで生成"
                    : "この食材で献立を作る"}
              </Button>
            </div>

            <div>
              <Button variant="outline" onClick={() => onClose()}>
                閉じる
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
