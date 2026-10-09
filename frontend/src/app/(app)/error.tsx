"use client";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[routezen] route error", error); }, [error]);
  return <ErrorState title="This page hit an error" message={error.message || "Unexpected error."} onRetry={reset} />;
}
