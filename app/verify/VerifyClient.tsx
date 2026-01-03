// app/verify/VerifyClient.tsx
"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyClient() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token");
  const email = search.get("email");
  const [msg, setMsg] = useState<string | null>("検証中…");

  useEffect(() => {
    if (!token) {
      setMsg("無効なリンクです（token missing）");
      return;
    }

    (async () => {
      try {
        const res: any = await signIn("credentials", {
          redirect: false,
          token,
        });

        if (res?.ok) {
          router.replace("/");
        } else {
          setMsg("検証に失敗しました。リンクが期限切れか、無効です。");
        }
      } catch (err: any) {
        console.error("verify signIn error:", err);
        setMsg("検証処理中にエラーが発生しました。");
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-lg font-semibold mb-4">メール検証中</h1>
        <p className="text-sm text-muted">{msg}</p>
      </div>
    </div>
  );
}
