"use client";
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function AddEditModal({
  item,
  onSave,
  onCancel,
}: {
  item: any | null;
  onSave: (it: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState<number | "">(item?.quantity ?? 1);
  const [unit, setUnit] = useState(item?.unit ?? "個");
  const [expiry, setExpiry] = useState<Date | null>(
    item?.expiry ? new Date(item.expiry) : null
  );
  const [noExpiry, setNoExpiry] = useState<boolean>(!item?.expiry);
  const [category, setCategory] = useState(item?.category ?? "その他");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setName(item?.name ?? "");
    setQuantity(item?.quantity ?? 1);
    setUnit(item?.unit ?? "個");
    setExpiry(item?.expiry ? new Date(item.expiry) : null);
    setNoExpiry(!item?.expiry);
    setCategory(item?.category ?? "その他");
  }, [item]);

  return (
    <div className="space-y-3 text-[var(--color-text-primary)]">
      <div className="text-lg font-semibold">
        {item ? "編集" : "追加"} - 食材
      </div>

      {/* 食材名 */}
      <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
        食材名
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例：鶏むね肉"
        className="input-field w-full"
      />

      {/* 数量・単位・カテゴリ */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            数量
          </label>
          <input
            type="number"
            value={quantity as any}
            onChange={(e) =>
              setQuantity(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            単位
          </label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            カテゴリ
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field w-full"
          >
            <option>すべて</option>
            <option>冷蔵</option>
            <option>冷凍</option>
            <option>野菜</option>
            <option>調味料</option>
            <option>その他</option>
          </select>
        </div>
      </div>

      {/* 期限 */}
      <div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={noExpiry}
            onChange={(e) => setNoExpiry(e.target.checked)}
          />
          期限なし
        </label>

        {!noExpiry && (
          <div className="mt-2">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="w-full rounded-xl border px-3 py-2 text-[var(--color-text-primary)] border-[var(--surface-border)] bg-[var(--surface-bg)] hover:brightness-105 transition"
            >
              {expiry ? expiry.toLocaleDateString("ja-JP") : "日付を選択"}
            </button>

            {pickerOpen && (
              <div className="relative mt-2 z-50">
                <DatePicker
                  selected={expiry || new Date()}
                  onChange={(date) => {
                    setExpiry(date);
                    setPickerOpen(false);
                  }}
                  inline
                  dateFormat="yyyy/MM/dd"
                  locale="ja"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ボタン */}
      <div className="flex justify-between mt-5">
        <button
          onClick={onCancel}
          className="flex-1 mr-2 border border-[var(--surface-border)] bg-[var(--surface-bg)] hover:brightness-105 text-[var(--color-text-secondary)] rounded-full py-2 text-sm font-normal whitespace-nowrap transition-all duration-150"
        >
          キャンセル
        </button>

        <button
          onClick={() => {
            if (!name.trim()) return;
            const payload: any = {
              name: name.trim(),
              quantity: Number(quantity || 1),
              unit,
              expiry: noExpiry
                ? null
                : expiry
                ? expiry.toISOString()
                : null,
              category,
            };
            if (item?.id) payload.id = item.id;
            onSave(payload);
          }}
          className="flex-1 ml-2 bg-[var(--accent)] hover:brightness-110 text-white rounded-full py-2 text-sm font-normal whitespace-nowrap transition-all duration-150"
        >
          {item ? "更新" : "保存"}
        </button>
      </div>
    </div>
  );
}
