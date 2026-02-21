"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  BookOpen,
  BookOpenCheck,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  Atom,
  X,
} from "lucide-react";
import { Drawer } from "vaul";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import UserAvatar from "@/components/ui/UserAvatar";
import { Article } from "@/types/article";
import { CommentDrawer } from "@/components/comment/CommentDrawer";
import { useUser } from "@/hooks/useUser";

interface ArticleDetailProps {
  id: string;
}

export default function ArticleDetail({ id }: ArticleDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();

  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article>({
    queryKey: ["article", id],
    queryFn: async () => {
      const res = await axios.get(`/api/article/${id}`);
      return res.data.data;
    },
  });

  const [stats, setStats] = useState(
    article?.stats || { upVotes: 0, downVotes: 0, comments: 0, viewCount: 0 }
  );
  const [userVote, setUserVote] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showConvertDrawer, setShowConvertDrawer] = useState(false);
  const [isReaderModeActive, setIsReaderModeActive] = useState(false);

  // Sync state when data loads
  useEffect(() => {
    if (article) {
      setStats(article.stats);
      setUserVote(article.userVote || null);
      if (article.parsedContent) {
        setIsReaderModeActive(true);
      } else {
        setIsReaderModeActive(false);
      }
    }
  }, [article]);

  const extendedContent = React.useMemo(() => {
    if (!article?.extendedContent) return null;
    try {
      return JSON.parse(article.extendedContent);
    } catch {
      return null;
    }
  }, [article?.extendedContent]);

  const hasRichContent = !!extendedContent?.title;

  // Check if URL is likely to block iframe embedding
  const isIframeBlocked = React.useMemo(() => {
    if (!article?.url) return false;
    try {
      const hostname = new URL(article.url).hostname;
      const blockedHosts = ["x.com", "twitter.com", "medium.com", "mirror.xyz", "github.com"];
      return blockedHosts.some((host) => hostname.includes(host));
    } catch {
      return false;
    }
  }, [article?.url]);

  const handleVote = async (type: "LIKE" | "DISLIKE") => {
    if (isVoting || !article) return;
    if (!currentUser) {
      toast.error("请先登录");
      return;
    }

    const previousVote = userVote;
    const previousStats = { ...stats };
    const newStats = { ...stats };
    const newVote = userVote === type ? null : type;

    if (previousVote === type) {
      if (type === "LIKE") newStats.upVotes = Math.max(0, (newStats.upVotes || 0) - 1);
      if (type === "DISLIKE") newStats.downVotes = Math.max(0, (newStats.downVotes || 0) - 1);
    } else {
      if (type === "LIKE") {
        newStats.upVotes = (newStats.upVotes || 0) + 1;
        if (previousVote === "DISLIKE")
          newStats.downVotes = Math.max(0, (newStats.downVotes || 0) - 1);
      } else {
        newStats.downVotes = (newStats.downVotes || 0) + 1;
        if (previousVote === "LIKE") newStats.upVotes = Math.max(0, (newStats.upVotes || 0) - 1);
      }
    }

    setUserVote(newVote);
    setStats(newStats);
    setIsVoting(true);

    try {
      const res = await axios.post("/api/article/action", { articleId: id, action: type });
      if (res.data.code === 200 && res.data.data) {
        setStats((prev) => ({
          ...prev,
          upVotes: res.data.data.upVotes,
          downVotes: res.data.data.downVotes,
        }));
      }
    } catch (err) {
      setUserVote(previousVote);
      setStats(previousStats);
      toast.error("操作失败");
    } finally {
      setIsVoting(false);
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  // 1. Click Handler (Triggered by UI)
  const handleConvertClick = () => {
    if (!article) return;

    // If already has parsed content, toggle the view mode
    if (article.parsedContent) {
      setIsReaderModeActive(!isReaderModeActive);
      return;
    }

    // If no parsed content, check login and show drawer to extract
    if (!currentUser) {
      toast.error("请先登录后体验阅读模式");
      return;
    }

    setShowConvertDrawer(true);
  };

  // 2. Execution Logic (Triggered by Drawer)
  const executeConvert = async () => {
    setShowConvertDrawer(false);
    const toastId = toast.loading("正在提取正文...");

    try {
      // Single call to handle both conversion and saving
      await axios.patch(`/api/article/${id}`, { action: "convert" });

      toast.success("阅读模式已就绪", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["article", id] });
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || "提取失败，请重试";
      toast.error(msg, { id: toastId });
    }
  };

  if (isLoading)
    return <div className="flex h-screen items-center justify-center text-gray-400">加载中...</div>;
  if (error || !article)
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">文章加载失败</div>
    );

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div className="fixed top-0 right-0 left-0 z-50 flex h-14 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 text-gray-600 transition-all hover:bg-gray-100 active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>

        {article.node && (
          <div
            className="flex cursor-pointer items-center gap-1 font-bold text-gray-900 active:opacity-70"
            onClick={() => router.push(`/node/${article.node.id}`)}
          >
            <span>{article.node.name}</span>
            <span className="text-gray-400">&gt;</span>
          </div>
        )}

        <motion.button
          className={`-mr-2 rounded-full p-2 transition-colors hover:bg-gray-100 ${isReaderModeActive ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`}
          animate={!article?.parsedContent ? { rotate: [0, -15, 15, -15, 15, 0] } : {}}
          transition={{ duration: 1, repeat: Infinity, repeatDelay: 5 }}
          onClick={handleConvertClick}
        >
          {isReaderModeActive ? <BookOpenCheck size={24} /> : <BookOpen size={24} />}
        </motion.button>
      </div>

      {/* Main Content */}
      <div className="px-5 pt-20 pb-24">
        {/* Author Info */}
        <div className="mb-6 flex items-center gap-3">
          <div
            onClick={() =>
              router.push(
                currentUser?.id === article.author.id ? "/mine" : `/user/${article.author.id}`
              )
            }
          >
            <UserAvatar
              src={article.author.avatar}
              name={article.author.name}
              seed={article.author.userId}
              size={44}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-900">{article.author.name}</span>
            <span className="text-xs text-gray-400">{formatDate(article.createdAt)}</span>
          </div>
        </div>

        {/* Featured Quote/Summary */}
        {hasRichContent && (
          <div
            className="mb-4 flex cursor-pointer overflow-hidden rounded-xl bg-gray-50 transition-colors active:bg-gray-100"
            onClick={() => setIsDescExpanded(!isDescExpanded)}
          >
            <div className="w-1.5 shrink-0 bg-blue-500" />
            <div className="flex flex-1 items-start justify-between gap-2 p-2">
              <p
                className={`text-[15px] leading-relaxed text-gray-600 italic ${isDescExpanded ? "" : "line-clamp-1"}`}
              >
                “{article.description}”
              </p>
              <ChevronDown
                size={16}
                className={`mt-1.5 shrink-0 text-gray-400 transition-transform duration-300 ${isDescExpanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        )}

        {/* Title */}
        <h1 className="mb-2 text-[26px] leading-[1.3] font-bold text-gray-900">
          {extendedContent?.title || extendedContent?.description || article.description}
        </h1>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag.name}
                className="rounded-md px-3 py-1 text-xs font-semibold"
                style={{
                  color: tag.color,
                  backgroundColor: `color-mix(in srgb, ${tag.color}, transparent 92%)`,
                }}
              >
                # {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-6">
          {/* Hero Image */}
          {article.images && article.images.length > 0 && (
            <div className="relative aspect-[5/2] w-full overflow-hidden rounded-2xl shadow-sm">
              <Image src={article.images[0]} alt="Article Cover" fill className="object-cover" />
            </div>
          )}

          {/* Article Text Rendering */}
          <article className="prose prose-slate prose-lg prose-headings:font-bold prose-p:text-gray-600 prose-p:leading-relaxed prose-img:rounded-xl max-w-none">
            {isReaderModeActive && article.parsedContent ? (
              <div className="relative">
                <div dangerouslySetInnerHTML={{ __html: article.parsedContent }} />
              </div>
            ) : extendedContent?.html ? (
              <div dangerouslySetInnerHTML={{ __html: extendedContent.html }} />
            ) : article.url ? (
              <div className="w-full overflow-hidden rounded-xl bg-gray-50">
                {isIframeBlocked ? (
                  <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
                    <div className="rounded-full bg-blue-100 p-4">
                      <Share2 size={32} className="text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="mb-2 text-base font-semibold text-gray-900">
                        该网页不支持内嵌预览
                      </p>
                      <p className="mb-6 text-sm text-gray-500">
                        {new URL(article.url).hostname} 已限制第三方嵌入，请跳转原网页阅读
                      </p>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
                      >
                        跳转原网页阅读
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <iframe
                      src={article.url}
                      className="h-[calc(100vh-140px)] min-h-[500px] w-full border-0 bg-white"
                      title="Article Content"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                    />
                    <div className="flex justify-center border-t border-gray-100 bg-white py-3">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        无法预览？点击跳转原网页
                      </a>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-[17px] leading-8 font-normal whitespace-pre-line text-gray-700">
                {article.description}
              </p>
            )}
          </article>
        </div>
      </div>

      {/* Footer Actions - Always Visible */}
      <div className="pb-safe fixed right-0 bottom-0 left-0 z-50 border-t border-gray-100 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.button
              whileTap={{ scale: 0.9 }}
            onClick={() => handleVote("LIKE")}
            className={`flex items-center gap-1.5 ${userVote === "LIKE" ? "text-blue-600" : "text-gray-400"}`}
          >
            <ThumbsUp size={22} className={userVote === "LIKE" ? "fill-current" : ""} />
            <span className="text-sm font-bold">{formatNumber(stats.upVotes)}</span>
          </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleVote("DISLIKE")}
              className={`flex items-center gap-1.5 ${userVote === "DISLIKE" ? "text-red-500" : "text-gray-400"}`}
            >
              <ThumbsDown size={22} className={userVote === "DISLIKE" ? "fill-current" : ""} />
              <span className="text-sm font-bold">{formatNumber(stats.downVotes)}</span>
            </motion.button>

            <CommentDrawer
              articleId={id}
              trigger={
                <button className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600">
                  <MessageSquare size={22} />
                  <span className="text-sm font-bold">{formatNumber(stats.comments)}</span>
                </button>
              }
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-blue-600">
              {formatNumber(stats.cmwValue || stats.upVotes * 10)} CMW
            </span>
            <button className="text-gray-400 hover:text-gray-600">
              <Share2 size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Convert Confirmation Drawer */}
      <Drawer.Root open={showConvertDrawer} onOpenChange={setShowConvertDrawer}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 transition-opacity" />
          <Drawer.Content className="fixed right-0 bottom-0 left-0 z-[60] flex flex-col rounded-t-[20px] bg-white outline-none">
            <div className="mx-auto mt-4 mb-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />

            <div className="flex items-center justify-between border-b border-gray-100 px-6 pb-4">
              <Drawer.Title className="text-lg font-bold text-gray-900">
                开启纯净阅读模式
              </Drawer.Title>
              <button
                onClick={() => setShowConvertDrawer(false)}
                className="-mr-2 rounded-full p-2 text-gray-400 transition-colors hover:text-gray-600 active:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-8 space-y-3">
                <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                  <BookOpenCheck className="mt-0.5 shrink-0 text-blue-600" size={20} />
                  <p className="text-sm leading-relaxed text-blue-900">
                    系统将自动提取当前网页的<strong>正文内容</strong>
                    ，去除广告和干扰元素，生成适合阅读的纯净版本。
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  * 提取的内容将永久保存，替换当前的预览显示。
                  <br />* 如提取效果不佳，文章链接依然保留，用户仍可跳转原网页。
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConvertDrawer(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-3.5 text-sm font-bold text-gray-600 transition-colors active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={executeConvert}
                  className="flex-1 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  立即提取
                </button>
              </div>
            </div>
            <div className="pb-safe" />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
