// app/hooks/useIngredients.ts
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export function useIngredients() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch("/api/ingredients", { credentials: "include" });
      const j = await res.json();
      setItems(j.items || []);
    })();
  }, [session]);

  async function addItem(payload: any) {
    const res = await fetch("/api/ingredients", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    // refetch simple approach
    const newlist = await (
      await fetch("/api/ingredients", { credentials: "include" })
    ).json();
    setItems(newlist.items || []);
    return j;
  }

  return { items, setItems, addItem };
}
