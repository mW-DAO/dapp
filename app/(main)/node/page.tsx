"use client";

import React, { useState, useEffect, useRef } from "react";
import NodeItem from "@/components/node/NodeItem";
import { useRouter } from "next/navigation";
import CreateNodeBanner from "@/components/node/CreateNodeBanner";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/useUser";
import { Inbox } from "lucide-react";

type TabType = "hot" | "latest";

const TAB_CONFIG: Record<TabType, string> = {
  hot: "最热",
  latest: "最新",
};

const NodeList = ({ type }: { type: TabType }) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["nodes", type],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await fetch(`/api/node?type=${type}&page=${pageParam}&pageSize=10`);
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.code === 200 && lastPage.data.hasMore) {
          return allPages.length + 1;
        }
        return undefined;
      },
      staleTime: 1000 * 60, // 1 minute
    });

  // Flatten the pages into a single array of nodes
  const nodes = data?.pages.flatMap((page) => page.data?.list || []) || [];

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (status === "pending") {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="h-32 bg-gray-200" />
            <div className="space-y-3 p-4">
              <div className="flex justify-between">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="h-3 w-32 rounded bg-gray-200" />
                  </div>
                </div>
                <div className="h-6 w-16 rounded-full bg-gray-200" />
              </div>
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-2/3 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (nodes.length === 0 && !isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 mb-4">
          <Inbox className="h-10 w-10 text-gray-400" />
        </div>
        <p>暂无超级节点</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {nodes.map((node) => (
        <NodeItem key={node.id} data={node} />
      ))}

      {/* Loading More Trigger */}
      {(hasNextPage || isFetchingNextPage) && (
        <div ref={loadMoreRef} className="py-4 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
        </div>
      )}

      {!hasNextPage && nodes.length > 0 && (
        <div className="py-8 text-center text-sm text-gray-400">没有更多节点了</div>
      )}
    </div>
  );
};

export default function NodePage() {
  const router = useRouter();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>("hot");
  const tabs: TabType[] = ["hot", "latest"];

  const handleMyNodeClick = () => {
    if (user?.id) {
      router.push(`/node/user/${user.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Tabs */}
      <div className="sticky top-[60px] z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
        <div className="flex rounded-lg bg-white">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-8 py-1.5 text-sm font-medium transition-all ${
                activeTab === tab ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-400"
              }`}
            >
              {TAB_CONFIG[tab]}
            </button>
          ))}
        </div>

        <AuthGuard onClick={handleMyNodeClick}>
          <button className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-700">
            我的超级节点
          </button>
        </AuthGuard>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <NodeList type={activeTab} />
      </div>

      {/* Floating Call to Action */}
      <CreateNodeBanner />
    </div>
  );
}
