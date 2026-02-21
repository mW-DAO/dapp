"use client";

import React, { useEffect } from "react";
import UserProfile from "@/components/user/UserProfile";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

export default function MinePage() {
  const { user, isLoading, isLoggedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen animate-pulse bg-gray-50 pb-24">
        <div className="h-44 bg-gray-200"></div>
        <div className="bg-white px-6 pt-16 pb-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div className="space-y-3">
              <div className="h-8 w-48 rounded bg-gray-200"></div>
              <div className="h-4 w-32 rounded bg-gray-200"></div>
            </div>
          </div>
          <div className="flex items-center gap-12">
            <div className="space-y-2">
              <div className="h-8 w-12 rounded bg-gray-200"></div>
              <div className="h-3 w-8 rounded bg-gray-200"></div>
            </div>
            <div className="space-y-2">
              <div className="h-8 w-12 rounded bg-gray-200"></div>
              <div className="h-3 w-8 rounded bg-gray-200"></div>
            </div>
          </div>
        </div>
        <div className="mt-4 px-4">
          <div className="h-32 rounded-3xl bg-gray-200"></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          <div className="h-24 rounded-2xl bg-gray-200"></div>
          <div className="h-24 rounded-2xl bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <UserProfile user={user} isOwnProfile={true} />;
}
