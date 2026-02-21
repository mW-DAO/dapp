"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Atom, Compass } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/useUser";
import NodeList from "@/components/node/NodeList";

export default function UserNodePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = React.use(params);
  const router = useRouter();
  const { user: currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<"created" | "joined">("created");
  const [scrollProgress, setScrollProgress] = useState(0);

  // 判断是否是当前用户自己
  const isMe = !!(currentUser && currentUser.id === userId);

  // 获取目标用户的资料 (用于显示名字、真实收益等)
  const { data: targetUser, isLoading: isUserLoading } = useQuery({
    queryKey: ["user", "profile", userId],
    queryFn: async () => {
      const res = await fetch(`/api/auth/user?id=${userId}`);
      const json = await res.json();
      return json.data;
    },
    staleTime: 1000 * 60,
  });

  const apiType = activeTab === "created" ? "created" : "joined";

  // 获取动态空状态文案
  const emptyMessage = (
    <div>
      <div className="mb-1">
        {activeTab === "created"
          ? isMe ? "还没有建立节点" : "TA 还没有建立节点"
          : isMe ? "还没有关注节点" : "TA 还没有关注节点"}
      </div>
      <div className="text-xs font-normal text-gray-400">
        {isMe && activeTab === "created" && "点击下方按钮建立你的第一个超级节点"}
        {isMe && activeTab === "joined" && "去探索页面关注感兴趣的超级节点"}
      </div>
    </div>
  );

  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(window.scrollY / 100, 1);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Dynamic Styles
  const headerBgOpacity = scrollProgress;
  const headerTextColor = scrollProgress > 0.6 ? "text-gray-900" : "text-white";
  const containerRadius = Math.max(0, 24 * (1 - scrollProgress));

  return (
    <div className="relative min-h-screen bg-gray-50 pb-24">
      {/* Fixed Header */}
      <div
        className="fixed top-0 right-0 left-0 z-50 flex items-center px-4 pt-5 pb-3 transition-colors duration-200"
        style={{ backgroundColor: `rgba(255, 255, 255, ${headerBgOpacity})` }}
      >
        <button
          onClick={() => router.back()}
          className={`${headerTextColor} -ml-1 rounded-full p-1 transition-colors hover:bg-gray-100/10`}
        >
          <ChevronLeft size={28} />
        </button>
        <div className={`ml-2 text-lg font-bold ${headerTextColor} transition-colors`}>
          {isUserLoading ? (
            <div
              className={`h-6 w-32 animate-pulse rounded ${scrollProgress > 0.6 ? "bg-gray-200" : "bg-white/20"}`}
            />
          ) : isMe ? (
            "我的超级节点"
          ) : (
            "TA 的超级节点"
          )}
        </div>
      </div>

      {/* Banner Area (Revenue/Title) */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 pt-32 pb-32 text-center text-white">
        <div className="mb-2 text-sm text-blue-100 opacity-80">已获得收益</div>
        <div className="flex justify-center text-4xl font-black tracking-tight drop-shadow-sm">
          {isUserLoading ? (
            <div className="mx-auto h-10 w-48 animate-pulse rounded bg-white/20" />
          ) : (
            `${parseFloat(targetUser?.minerRevenue || "0").toLocaleString()} CMW`
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="relative z-20 -mt-24 min-h-[500px] bg-gray-50 transition-all duration-200"
        style={{
          borderTopLeftRadius: `${containerRadius}px`,
          borderTopRightRadius: `${containerRadius}px`,
        }}
      >
        {/* Tabs - Sticky */}
        <div className="sticky top-[60px] z-30 bg-gray-50 pt-4 pb-2">
          <div className="mx-4 flex rounded-xl border-b border-gray-100 bg-white px-2 shadow-sm">
            {[
              { key: "created", label: isMe ? "我建立的" : "TA 建立的" },
              { key: "joined", label: isMe ? "我关注的" : "TA 关注的" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`relative flex-1 py-3 text-center text-sm font-medium ${
                  activeTab === tab.key ? "font-bold text-blue-600" : "text-gray-400"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="px-4 py-4">
          <NodeList type={apiType} userId={userId} emptyMessage={emptyMessage} />
        </div>
      </div>

      {/* Bottom Action Bar - 仅自己查看时显示 */}
      {isMe && (
        <div className="fixed right-0 bottom-0 left-0 z-40 flex gap-4 border-t border-gray-100 bg-white p-4 pb-8">
          <Link href="/node/create" className="flex-1">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-95">
              <Atom size={20} />
              建立超级节点
            </button>
          </Link>
          <button
            onClick={() => router.back()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-white py-3.5 text-sm font-bold text-blue-600 transition-all active:scale-95"
          >
            <Compass size={20} />
            探索超级节点
          </button>
        </div>
      )}
    </div>
  );
}
