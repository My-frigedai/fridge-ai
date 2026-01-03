// app/verify/page.tsx
import { Suspense } from "react";
import VerifyClient from "./VerifyClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyClient />
    </Suspense>
  );
}
