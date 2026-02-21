"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Atom, ChevronRight } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function CreateNodeBanner() {
  const router = useRouter();

  return (
    <div className="fixed right-4 bottom-[88px] left-4 z-20">
      <AuthGuard onClick={() => router.push("/node/create")}>
        <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-blue-50 bg-white p-2 shadow-lg shadow-blue-900/10 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-900/15 active:scale-[0.98]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Atom size={24} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">建立超级节点</h3>
              <p className="text-xs text-gray-400">开启属于你的数字社区</p>
            </div>
          </div>
          <div className="rounded-full bg-gray-50 p-2 text-gray-400">
            <ChevronRight size={16} />
          </div>
        </div>
      </AuthGuard>
    </div>
  );
}
