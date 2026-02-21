"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Atom, Users, Inbox, TrendingUp, Share2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import Image from "next/image";
import { toast } from "sonner";

import ArticleItem from "@/components/article/ArticleItem";
import { NodeData } from "@/types/node";
import { Article } from "@/types/article";
import UserAvatar from "@/components/ui/UserAvatar";
import { useAuthAction } from "@/hooks/useAuthAction";

import { parseAndHighlightHashtags } from "@/lib/utils/text";

export default function NodeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { runWithAuth } = useAuthAction();

  const [scrollProgress, setScrollProgress] = useState(0);

  // 1. Fetch Node Info
  const { data: nodeData, isLoading: nodeLoading } = useQuery({
    queryKey: ["node", id],
    queryFn: async () => {
      const res = await axios.get(`/api/node/${id}`);
      return res.data.data.node as NodeData;
    },
  });

  // 2. Fetch Paginated Articles
  const {
    data: articleData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: articlesLoading,
  } = useInfiniteQuery({
    queryKey: ["node-articles", id],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axios.get(`/api/node/${id}?page=${pageParam}&pageSize=10`);
      return res.data.data.articles;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
  });

  const articles = useMemo(() => {
    return articleData?.pages.flatMap((page) => page.list) || [];
  }, [articleData]);

  // Handle Scroll
  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(window.scrollY / 120, 1);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleJoin = () => {
    runWithAuth(async () => {
      toast.info("加入节点流程正在开发中...");
    });
  };

  if (nodeLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="text-sm font-medium text-gray-400">正在进入超级节点...</span>
        </div>
      </div>
    );
  }

  if (!nodeData) return <div className="p-20 text-center">节点不存在</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky Header */}
      <div
        className="fixed top-0 right-0 left-0 z-50 flex h-14 items-center justify-between px-4 transition-all duration-300"
        style={{
          backgroundColor: `rgba(255, 255, 255, ${scrollProgress})`,
          backdropFilter: scrollProgress > 0.5 ? "blur(8px)" : "none",
          borderBottom: scrollProgress > 0.8 ? "1px solid rgba(0,0,0,0.05)" : "none",
        }}
      >
        <button
          onClick={() => router.back()}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            scrollProgress > 0.5 ? "bg-gray-100 text-gray-900" : "bg-black/20 text-white"
          }`}
        >
          <ChevronLeft size={22} />
        </button>

        <AnimatePresence>
          {scrollProgress > 0.6 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2"
            >
              <div className="relative h-7 w-7 overflow-hidden rounded-lg">
                <Image
                  src={nodeData.coverImage || "/placeholder-node.png"}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-sm font-bold text-gray-900">{nodeData.name}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            scrollProgress > 0.5 ? "bg-gray-100 text-gray-900" : "bg-black/20 text-white"
          }`}
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Hero Banner Section */}
      <div className="relative h-56 w-full overflow-hidden">
        {/* Background Layer with Image */}
        {nodeData.coverImage ? (
          <>
            <Image
              src={nodeData.coverImage}
              alt={nodeData.name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/30 bg-gradient-to-b from-transparent to-gray-50/20" />
            <div className="absolute inset-0 backdrop-blur-[2px]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600" />
        )}
      </div>

      {/* Main Info Card */}
      <div className="relative z-10 -mt-25 px-5">
        <div className="rounded-3xl bg-white p-4 shadow-xl shadow-blue-900/10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl leading-tight font-black tracking-tight text-gray-900">
                {nodeData.name}
              </h1>
              <div className="flex flex-wrap gap-1.5">
                {nodeData.tags.map((tag) => (
                  <span
                    key={tag.name}
                    className="rounded-sm px-2 py-1 text-[10px] font-medium"
                    style={{
                      color: tag.color,
                      backgroundColor: `color-mix(in srgb, ${tag.color}, transparent 90%)`,
                    }}
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleJoin}
              className={`rounded-full px-5 py-2 text-xs font-bold transition-all active:scale-95 ${
                nodeData.isJoined
                  ? "bg-gray-100 text-gray-400"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-200"
              }`}
            >
              {nodeData.isJoined ? "已加入" : "+ 加入"}
            </button>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {nodeData.description
              ? parseAndHighlightHashtags(nodeData.description, (tag) => {
                  router.push(`/search?q=${encodeURIComponent(tag)}`);
                })
              : "该超级节点主理人很懒，暂时没有写简介..."}
          </p>

          {/* Stats Row */}
          <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-5">
            <div className="flex flex-col items-center">
              <span className="text-lg font-extrabold text-gray-900">{nodeData.stats.members}</span>
              <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase">
                成员
              </span>
            </div>
            <div className="h-6 w-[1px] bg-gray-100" />
            <div className="flex flex-col items-center">
              <span className="text-lg font-extrabold text-gray-900">
                {nodeData.stats.contentCount}
              </span>
              <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase">
                内容
              </span>
            </div>
            <div className="h-6 w-[1px] bg-gray-100" />
            <div className="flex flex-col items-center">
              <span className="text-lg font-extrabold text-blue-600">
                {nodeData.stats.outputValue}
              </span>
              <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase">
                周期产值
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Section & Article List */}
      <div className="mt-4 px-4 pb-10">
        <div className="sticky top-14 z-20 -mx-4 bg-gray-50/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-blue-600" />
              <span className="text-base font-bold text-gray-900">文章列表</span>
            </div>
            <span className="text-xs text-gray-400">最新发布排序</span>
          </div>
        </div>

        {/* Article List */}
        <div className="mt-2 space-y-4">
          {articles.map((article: any) => (
            <ArticleItem key={article.id} article={article as any} />
          ))}

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full rounded-2xl bg-white py-4 text-sm font-medium text-gray-400 active:bg-gray-50"
            >
              {isFetchingNextPage ? "正在加载..." : "加载更多"}
            </button>
          )}

          {!hasNextPage && articles.length > 0 && (
            <div className="py-8 text-center text-xs text-gray-300">—— 已经看到最底部了 ——</div>
          )}

          {articles.length === 0 && !articlesLoading && (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
                <Inbox className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-sm">该节点暂时还没有发布内容</p>
            </div>
          )}
        </div>
      </div>

      {/* Post Action Button - Floating */}
      <div className="fixed right-6 bottom-6 z-40">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.push(`/publish?nodeId=${id}`)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-300 transition-colors hover:bg-blue-700"
        >
          <Plus size={28} />
        </motion.button>
      </div>
    </div>
  );
}
