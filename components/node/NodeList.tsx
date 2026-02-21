"use client";

import React, { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import NodeItem from "./NodeItem";

interface NodeListProps {
  type: "hot" | "latest" | "created" | "joined";
  userId?: string;
  emptyMessage?: React.ReactNode;
}

export default function NodeList({ type, userId, emptyMessage }: NodeListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["nodes", type, userId],
      queryFn: async ({ pageParam = 1 }) => {
        let url = `/api/node?type=${type}&page=${pageParam}&pageSize=10`;
        if (userId) {
          url += `&userId=${userId}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch nodes");
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

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
          <Inbox className="h-10 w-10 text-gray-400" />
        </div>
        <div className="text-sm font-medium">{emptyMessage || "暂无超级节点"}</div>
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
}
