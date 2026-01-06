// app/verify-email/page.tsx
"use client";

import { Suspense } from "react";
import VerifyEmailInner from "./verify-email-inner";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
