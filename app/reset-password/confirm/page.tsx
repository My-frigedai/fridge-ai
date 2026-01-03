// app/reset-password/confirm/page.tsx
import { Suspense } from "react";
import ResetConfirmClient from "./ResetConfirmClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetConfirmClient />
    </Suspense>
  );
}
