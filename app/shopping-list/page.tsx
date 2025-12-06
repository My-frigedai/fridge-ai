// app/shopping-list/page.tsx
"use client";
import React from "react";
import NavBar from "@/app/components/NavBar";
import ShoppingListItem from "@/app/components/ShoppingListItem";
import { useFridge } from "@/app/components/FridgeProvider";
import Toast from "@/app/components/Toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ShoppingListPage() {
  const {
    shopping = [],
    setShopping,
    toast,
    setToast,
    openAddModal,
  } = useFridge();

  const toggleDone = (index: number) => {
    const next = [...(shopping || [])];
    next[index] = { ...next[index], done: !next[index].done };
    setShopping(next);

    // when user checks an item (marks done), open add modal prefilled so they can set grams / quantity
    const nowDone = !!next[index].done;
    if (nowDone) {
      const it = next[index];
      // send detail to the add modal (home's + modal should listen to fridge_open_add)
      openAddModal?.({
        mode: "prefill-from-shopping",
        item: {
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          note: it.note,
        },
      });
    }
  };

  const remove = (index: number) => {
    if (!confirm("このアイテムを削除しますか？")) return;
    const next = [...(shopping || [])];
    next.splice(index, 1);
    setShopping(next);
    setToast("買い物リストから削除しました");
  };

  return (
    <motion.div
      className="mx-auto min-h-screen w-full max-w-md text-[var(--color-text-primary)] pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.header
        className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--surface-border)] backdrop-blur-lg bg-[var(--background)]/70 px-4 py-3"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div />
        <div className="text-lg font-semibold">買い物リスト</div>
        <div />
      </motion.header>

      <motion.main
        className="p-4 pb-28"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          layout
          className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-bg)] shadow-sm backdrop-blur-md p-4"
        >
          {/* ALWAYS render <ul> to keep SSR/CSR DOM shape stable (prevents hydration mismatch) */}
          <ul className="space-y-2">
            {!shopping || shopping.length === 0 ? (
              <li
                className="text-[var(--color-text-muted)] text-center py-8"
                aria-live="polite"
                style={{ opacity: 0.85 }}
              >
                買い物リストは空です。
                <br />
                献立から自動生成するか、＋ ボタンで追加してください。
              </li>
            ) : (
              <AnimatePresence>
                {shopping.map((it: any, i: number) => (
                  <motion.li
                    key={it?.id ?? `${String(it?.name ?? "item")}-${i}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <ShoppingListItem
                      item={it}
                      onToggle={() => toggleDone(i)}
                      onDelete={() => remove(i)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            )}
          </ul>
        </motion.div>
      </motion.main>

      <NavBar />
      <Toast msg={toast} onClose={() => setToast(null)} />
    </motion.div>
  );
}
