"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import ArticleItem from "./ArticleItem";
import { Article } from "@/types/article";
import { Inbox } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { AuthGuard } from "@/components/auth/AuthGuard";

interface ArticleListProps {
  activeTab: string;
}

interface ArticleFeedResponse {
  code: number;
  message: string;
  data: {
    list: Article[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export default function ArticleList({ activeTab }: ArticleListProps) {
  const { isLoggedIn } = useUser();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载数据
  const fetchArticles = useCallback(
    async (pageNum: number, isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `/api/article?type=${encodeURIComponent(activeTab)}&page=${pageNum}&pageSize=20`
        );

        if (response.ok) {
          const result: ArticleFeedResponse = await response.json();

          if (result.code === 200) {
            if (isLoadMore) {
              setArticles((prev) => [...prev, ...result.data.list]);
            } else {
              setArticles(result.data.list);
            }
            setHasMore(result.data.hasMore);
          }
        }
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  // Tab 切换 或 登录状态变化时重置 (Following 需要登录)
  useEffect(() => {
    // 如果是 following 且未登录，不请求
    if (activeTab === "following" && !isLoggedIn) {
      setArticles([]);
      setHasMore(false); // 避免无限滚动触发
      setLoading(false);
      return;
    }

    setArticles([]);
    setPage(1);
    setHasMore(true);
    fetchArticles(1, false);
  }, [activeTab, fetchArticles, isLoggedIn]);

  // 无限滚动
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchArticles(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, page, fetchArticles]);

  // 加载骨架屏
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-3xl border border-gray-100 bg-white p-4">
            <div className="mb-4 flex gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200"></div>
                <div className="h-3 w-16 rounded bg-gray-200"></div>
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <div className="h-4 w-full rounded bg-gray-200"></div>
              <div className="h-4 w-2/3 rounded bg-gray-200"></div>
            </div>
            <div className="h-40 rounded-2xl bg-gray-200"></div>
          </div>
        ))}
      </div>
    );
  }

  // 空状态
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
          <Inbox className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-400">暂无内容</h3>
        <p className="text-sm text-gray-400">
          {activeTab === "following"
            ? isLoggedIn
              ? "关注一些用户后，这里会显示他们的文章"
              : "登录后查看关注内容"
            : "还没有文章，快来发布第一篇吧"}
        </p>
        
        {activeTab === "following" && !isLoggedIn && (
          <AuthGuard>
            <button className="mt-4 rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-blue-300 active:scale-95">
              立即登录
            </button>
          </AuthGuard>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {articles.map((article) => (
          <ArticleItem key={article.id} article={article} />
        ))}
      </div>

      {/* 加载更多触发器 */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-8 text-center">
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              <span>加载中...</span>
            </div>
          )}
        </div>
      )}

      {/* 没有更多了 */}
      {!hasMore && articles.length > 0 && (
        <div className="py-8 text-center text-sm text-gray-400">没有更多了</div>
      )}
    </>
  );
}
