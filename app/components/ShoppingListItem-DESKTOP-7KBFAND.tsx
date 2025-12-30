// app/components/ShoppingListItem.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, CheckCircle } from "lucide-react";

type ShoppingItem = {
  name: string;
  done?: boolean;
  quantity?: string | number;
  unit?: string;
  note?: string;
  tags?: string[];
};

interface ShoppingListItemProps {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate?: (updated: ShoppingItem) => void; // 新: 編集反映用
  onRequestAdd?: (item: ShoppingItem) => void; // 新: “追加UI”呼び出し用
}

export default function ShoppingListItem({
  item,
  onToggle,
  onDelete,
  onUpdate,
  onRequestAdd,
}: ShoppingListItemProps) {
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<ShoppingItem>(item);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // SSR時ズレ防止
    return null;
  }

  const handleSave = () => {
    if (onUpdate) onUpdate(editData);
    setEditing(false);
  };

  const handleCheck = () => {
    onToggle();
    if (!item.done && onRequestAdd) {
      // チェック時に数量入力UIを呼び出す
      onRequestAdd(item);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-4 transition-all
        ${
          item.done
            ? "bg-gray-100 dark:bg-gray-800 line-through text-gray-400"
            : "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
        } hover:shadow-md`}
      role="listitem"
      aria-checked={!!item.done}
    >
      {/* 左側: チェック + 内容 */}
      <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
        <button
          onClick={handleCheck}
          className={`rounded-full p-1 transition-all ${
            item.done ? "text-green-500" : "text-gray-400 hover:text-green-600"
          }`}
          aria-label="完了"
        >
          <CheckCircle size={22} />
        </button>

        {!editing ? (
          <div className="flex flex-col">
            <span className="font-semibold text-base">{item.name}</span>
            {(item.quantity || item.unit || item.note) && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.quantity && `${item.quantity}${item.unit ?? ""}`}{" "}
                {item.note ?? ""}
              </span>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {item.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-100 px-2 py-0.5 rounded-full text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <input
              className="border rounded-md px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
              value={editData.name}
              onChange={(e) =>
                setEditData((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="名前"
            />
            <div className="flex gap-2">
              <input
                type="number"
                className="w-20 border rounded-md px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
                value={editData.quantity ?? ""}
                onChange={(e) =>
                  setEditData((p) => ({ ...p, quantity: e.target.value }))
                }
                placeholder="量"
              />
              <input
                className="w-20 border rounded-md px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
                value={editData.unit ?? ""}
                onChange={(e) =>
                  setEditData((p) => ({ ...p, unit: e.target.value }))
                }
                placeholder="単位"
              />
              <input
                className="flex-1 border rounded-md px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
                value={editData.note ?? ""}
                onChange={(e) =>
                  setEditData((p) => ({ ...p, note: e.target.value }))
                }
                placeholder="メモ"
              />
            </div>
          </div>
        )}
      </div>

      {/* 右側: 操作ボタン */}
      <div className="flex gap-2 mt-3 sm:mt-0 sm:ml-4">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:hover:bg-yellow-700 dark:text-yellow-100 transition-all"
            aria-label="編集"
          >
            <Pencil size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all"
            aria-label="保存"
          >
            保存
          </button>
        )}

        <button
          onClick={onDelete}
          className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all"
          aria-label="削除"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}
