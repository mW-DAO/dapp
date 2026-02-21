"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppKitAccount, useAppKitState } from "@reown/appkit/react";
import { isPublicRoute } from "@/config/auth";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { isConnected } = useAppKitAccount();
  const { initialized } = useAppKitState();
  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    if (mounted && initialized && !isPublic && !isConnected) {
      router.push("/login");
    }
  }, [mounted, initialized, isPublic, isConnected, router]);

  // 显示加载骨架屏,而不是黑屏
  if (!mounted || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isPublic && !isConnected) {
    return null; // 这里保持 null,因为会立即重定向到 /login
  }

  return <>{children}</>;
}
