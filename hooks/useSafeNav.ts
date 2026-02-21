"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useSafeNav() {
  const router = useRouter();

  const safeBack = useCallback(
    (fallback: string = "/") => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push(fallback);
      }
    },
    [router]
  );

  return {
    ...router,
    safeBack,
  };
}
