"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, BellOff, Loader2 } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Notification, NotificationType } from "@prisma/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useInView } from "react-intersection-observer";

// Define response type roughly
type NotificationWithRelations = Notification & {
  triggerUser: { id: string; userName: string; avatarUrl: string | null };
  article?: { id: string; title: string | null; description: string };
  comment?: { id: string; content: string };
};

export default function NotificationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`/api/notification?page=${pageParam}&pageSize=20`);
      const json = await res.json();
      return json.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) return lastPage.page + 1;
      return undefined;
    },
  });

  // Auto-fetch next page when scrolling to bottom
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/notification", { method: "PATCH" });
    },
    onSuccess: () => {
      toast.success("已全部标记为已读");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Also invalidate unread badge
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const formatContent = (item: NotificationWithRelations) => {
    switch (item.type) {
      case NotificationType.ARTICLE_LIKE:
        return `赞了你的文章 "${item.title || item.article?.description?.slice(0, 10)}..."`;
      case NotificationType.ARTICLE_DISLIKE:
        return `踩了你的文章 "${item.title || item.article?.description?.slice(0, 10)}..."`;
      case NotificationType.COMMENT_REPLY:
        return `评论了: "${item.content || item.comment?.content}"`;
      case NotificationType.FOLLOW:
        return "关注了你";
      case NotificationType.SYSTEM:
        return item.content;
      default:
        return item.content;
    }
  };

  const formatTitle = (item: NotificationWithRelations) => {
    if (item.type === NotificationType.SYSTEM) return item.title || "系统通知";
    return item.triggerUser?.userName || "有人";
  };

  // Flatten pages
  const notifications = data?.pages.flatMap((page: any) => page.list) || [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* Custom Header */}
      <header className="z-50 flex-none border-b border-gray-50 bg-white">
        <div className="flex h-[50px] items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="-ml-2 rounded-full p-1 text-gray-800 transition-colors hover:bg-gray-100"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">消息通知</h1>
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="text-sm font-medium text-blue-500 disabled:opacity-50"
          >
            清除未读
          </button>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-gray-300" />
          </div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {notifications.map((item: NotificationWithRelations) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-4 transition-colors ${!item.isRead ? "bg-blue-50/30" : "hover:bg-gray-50"}`}
              >
                <div className="relative flex-shrink-0">
                  <UserAvatar
                    src={item.triggerUser?.avatarUrl || ""}
                    name={item.triggerUser?.userName || "System"}
                    seed={item.triggerUser?.id || "sys"}
                    size={40}
                  />
                  {!item.isRead && (
                    <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"></div>
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="mb-1 flex items-baseline justify-between">
                    <h4 className="text-sm font-bold text-gray-900">{formatTitle(item)}</h4>
                    <span className="text-xs font-light text-gray-400">
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">
                    {formatContent(item)}
                  </p>
                </div>
              </div>
            ))}

            {/* Load More Trigger */}
            <div ref={ref} className="flex justify-center py-4 text-xs text-gray-400">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={14} />
                  加载更多...
                </div>
              ) : hasNextPage ? (
                <span>上拉加载更多</span>
              ) : (
                <span className="opacity-50">没有更多消息了</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300">
            <BellOff size={48} strokeWidth={1} />
            <p className="text-sm">暂无新消息</p>
          </div>
        )}
      </div>
    </div>
  );
}
