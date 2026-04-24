"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ConditionalChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/propositions")) return null;
  return <>{children}</>;
}
