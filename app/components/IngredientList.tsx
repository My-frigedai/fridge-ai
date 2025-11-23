"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Trash2, Edit3 } from "lucide-react";
import { useFridge } from "./FridgeProvider";
import AddEditModal from "./AddEditModal";
import { createPortal } from "react-dom";

/**
 * IngredientList (theme-aware)
 * - テキストは CSS 変数 (--color-text-*) を参照してライト/ダーク両対応
 * - 編集モーダルは Portal で最前面に表示
 * - 編集/削除ボタンはテーマ別カラー（ダーク: 青/赤、ライト: 薄だいだい/赤寄り）に調整
 * - 見やすさ重視で余白・丸みを微調整（既存の UX を保持）
 */

export default function IngredientList() {
  const { items, addOrUpdateItem, deleteItem } = useFridge();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const openAddHandler = () => setEditingItem(null);
    window.addEventListener("fridge_open_add", openAddHandler as any);
    return () => window.removeEventListener("fridge_open_add", openAddHandler as any);
  }, []);

  const handleDelete = (id: string) => {
    if (!confirm("この食材を削除しますか？")) return;
    deleteItem(id);
    setExpandedId(null);
  };

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="divide-y divide-gray-300 dark:divide-gray-700">
      {(!items || items.length === 0) ? (
        <div className="text-gray-400 p-4">まだ食材がありません。追加してください。</div>
      ) : (
        items.map(it => (
          <div key={it.id} className="relative ingredient-row">
            {/* 食材行 */}
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex-1 min-w-0">
                <div
                  className="font-medium truncate ingredient-name"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {it.name}
                </div>
                <div
                  className="text-sm ingredient-expiry"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {it.expiry
                    ? `期限: ${new Date(it.expiry).toLocaleDateString()}`
                    : "期限なし"}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-3">
                <div
                  className="text-sm ingredient-qty"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {it.quantity}{it.unit}
                </div>

                <button
                  onClick={() => handleToggle(it.id)}
                  className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition ingredient-more-btn"
                  aria-expanded={expandedId === it.id}
                >
                  <MoreHorizontal />
                </button>
              </div>
            </div>

            {/* 編集・削除ボタン（横並び、アニメーション付き） */}
            <AnimatePresence>
              {expandedId === it.id && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.18 }}
                  className="flex justify-end gap-3 px-3 pb-2 action-menu"
                >
                  <button
                    onClick={() => { setEditingItem(it); setExpandedId(null); }}
                    className="flex items-center gap-1 px-3 py-1 rounded-full action-btn action-edit"
                    aria-label={`編集 ${it.name}`}
                  >
                    <Edit3 size={16} /> <span className="action-label">編集</span>
                  </button>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded-full action-btn action-delete"
                    aria-label={`削除 ${it.name}`}
                  >
                    <Trash2 size={16} /> <span className="action-label">削除</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))
      )}

      {/* 編集モーダル（Portalで最前面に） */}
      {mounted && createPortal(
        <AnimatePresence>
          {editingItem !== null && (
            <motion.div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-md rounded-2xl shadow-2xl modal-card"
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <AddEditModal
                  item={editingItem}
                  onSave={(it: any) => {
                    if (it.__deleteId) deleteItem(it.__deleteId);
                    else addOrUpdateItem(it);
                    setEditingItem(null);
                  }}
                  onCancel={() => setEditingItem(null)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}
