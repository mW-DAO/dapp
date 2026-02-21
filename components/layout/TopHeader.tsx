"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { useUser } from "@/hooks/useUser";
import { useQuery } from "@tanstack/react-query";

export default function TopHeader() {
  const { user, isLoggedIn, isLoading, isWalletConnected, walletAddress } = useUser();

  // 调试日志：帮助排查交互逻辑
  React.useEffect(() => {
    if (isLoggedIn) console.log("[TopHeader] Active Session:", user?.userId);
    if (isWalletConnected) console.log("[TopHeader] Wallet Connected:", walletAddress);
  }, [isLoggedIn, isWalletConnected, user, walletAddress]);

  const { data: unreadStats } = useQuery({
    queryKey: ["unread-notifications", user?.userId],
    queryFn: async () => {
      const res = await fetch("/api/notification/unread");
      const json = await res.json();
      return { count: json.data?.count || 0 };
    },
    enabled: !!isLoggedIn,
    refetchOnWindowFocus: true, // Optional: ensure it refetches when user comes back
  });

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100/50 bg-white/80 backdrop-blur-md">
      <div className="flex h-[60px] items-center px-4">
        {/* Left Slot: Avatar / Logo / Loading */}
        <div className="flex w-[80px] items-center">
          {isLoggedIn && user ? (
            <Link href="/mine" className="transition-transform active:scale-95">
              <UserAvatar
                src={user.avatar}
                seed={user.address || walletAddress || user.userId || "guest"}
                size={34}
                className="shadow-sm ring-2 ring-white"
              />
            </Link>
          ) : isWalletConnected || isLoading ? (
            <div className="h-8 w-8 animate-pulse rounded-full border border-blue-100 bg-blue-50" />
          ) : (
            <Link href="/" className="relative h-[48px] w-[120px]">
              <Image
                src="/images/home_logo.webp"
                alt="EcoFi m&w"
                fill
                className="object-contain"
                priority
              />
            </Link>
          )}
        </div>

        {/* Center Slot: Main Logo (Visible when logged in or wallet connected) */}
        <div className="flex flex-1 items-center justify-center">
          {(isLoggedIn || isWalletConnected) && (
            <Link href="/" className="relative h-[36px] w-[90px]">
              <Image
                src="/images/home_logo.webp"
                alt="EcoFi m&w"
                fill
                className="object-contain"
                priority
              />
            </Link>
          )}
        </div>

        {/* Right Slot: Icons */}
        <div className="flex w-[80px] items-center justify-end gap-3 text-gray-600">
          <button className="p-1 transition-colors hover:text-gray-900">
            <Search size={22} />
          </button>
          {isLoggedIn && (
            <Link
              href="/notification"
              className="relative p-1 transition-colors hover:text-gray-900"
            >
              <Bell size={22} />
              {unreadStats?.count > 0 && (
                <span className="absolute top-1 right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
