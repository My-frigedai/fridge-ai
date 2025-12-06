// app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata = {
  title: "ログイン - My-FridgeAI",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          読み込み中…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
