"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageCircle } from "lucide-react";
import UserProfile from "@/components/user/UserProfile";
import { User } from "@/types/user";
import { useUser } from "@/hooks/useUser";
import { useQuery } from "@tanstack/react-query";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const [scrollProgress, setScrollProgress] = useState(0);

  const { user: currentUser } = useUser();

  const { data: user = null, isLoading: loading } = useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const res = await fetch(`/api/auth/user?id=${id}`);
      const json = await res.json();
      if (json.code === 200) return json.data as User;
      return null;
    },
    staleTime: 1000 * 60,
  });

  // 判断是否是当前用户自己的主页
  const isMe = !!(currentUser && user && currentUser.id === user.id);

  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(window.scrollY / 100, 1);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMessage = () => {
    router.push(`/notification/${id}`);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  // Dynamic Styles
  const headerBgOpacity = scrollProgress;
  const headerTextColor = scrollProgress > 0.6 ? "text-gray-900" : "text-white";

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Fixed Header - 动态悬浮效果 */}
      <div
        className="fixed top-0 right-0 left-0 z-50 flex items-center px-5 py-4 transition-colors duration-200"
        style={{
          backgroundColor:
            scrollProgress > 0 ? `rgba(255, 255, 255, ${headerBgOpacity})` : "transparent",
        }}
      >
        <button
          onClick={() => router.back()}
          className={`flex items-center gap-2 ${headerTextColor} transition-all hover:opacity-80 active:scale-95`}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          <span className="text-base font-medium">返回</span>
        </button>
      </div>

      {/* 用户信息 - 根据 isMe 自动切换 关注/编辑 状态 */}
      <UserProfile user={user} isOwnProfile={isMe} />

      {/* 底部按钮 - 私聊 (仅查看别人时显示) */}
      {!isMe && (
        <div className="pb-safe-area-inset-bottom fixed right-0 bottom-0 left-0 z-20 border-t border-gray-100 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-md gap-3">
            <button
              onClick={handleMessage}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 active:scale-95"
            >
              <MessageCircle size={20} />
              发起私聊
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
