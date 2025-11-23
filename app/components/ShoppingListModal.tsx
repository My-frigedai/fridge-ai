"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";

type ShoppingListModalProps = {
  open: boolean;
  onClose: () => void;
  shoppingList: string[];
  removeItem: (item: string) => void;
};

export default function ShoppingListModal({ open, onClose, shoppingList, removeItem }: ShoppingListModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">買い物リスト</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {shoppingList.length === 0 ? (
            <p>買い物リストは空です。</p>
          ) : (
            shoppingList.map(item => (
              <div key={item} className="flex justify-between items-center p-2 border rounded">
                <span>{item}</span>
                <Button size="sm" variant="outline" onClick={() => removeItem(item)}>削除</Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={onClose} variant="outline">閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
