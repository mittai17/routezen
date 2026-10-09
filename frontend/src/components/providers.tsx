"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isApiError } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => (isApiError(e) && e.kind === "http" ? false : n < 2) } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
