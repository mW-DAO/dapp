"use client";

import React from "react";
import Image from "next/image";
import { Share2, ThumbsUp, ThumbsDown, MessageSquare, Atom } from "lucide-react";
import { Article } from "@/types/article";
import UserAvatar from "@/components/ui/UserAvatar";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { CommentDrawer } from "@/components/comment/CommentDrawer";
import { useRouter, useParams } from "next/navigation";

import { useUser } from "@/hooks/useUser";
import { useSecureAction } from "@/hooks/useSecureAction";
import { TurnstileWidget } from "@/components/common/TurnstileWidget";
import { useRef } from "react";
import { TurnstileInstance } from "@marsidev/react-turnstile";

interface ArticleItemProps {
  article: Article;
}

export default function ArticleItem({ article }: ArticleItemProps) {
  const router = useRouter();
  const params = useParams();
  const currentNodeId = params?.id as string;
  const { user: currentUser } = useUser();
  const [stats, setStats] = useState(article.stats);
  const [userVote, setUserVote] = useState<"LIKE" | "DISLIKE" | null>(article.userVote || null);
  const [isVoting, setIsVoting] = useState(false);
  
  const { performSecureAction } = useSecureAction();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const extendedContent = React.useMemo(() => {
    if (!article.extendedContent) return null;
    try {
      return JSON.parse(article.extendedContent);
    } catch {
      return null;
    }
  }, [article.extendedContent]);

  const hasRichContent = !!extendedContent?.title;

  const handleVote = async (type: "LIKE" | "DISLIKE") => {
    if (isVoting) return;

    // Optimistic Update
    const previousVote = userVote;
    const previousStats = { ...stats };

    const newStats = { ...stats };
    const newVote = userVote === type ? null : type;

    // Adjust counts
    if (previousVote === type) {
      // Cancel vote
      if (type === "LIKE") newStats.upVotes = Math.max(0, (newStats.upVotes || 0) - 1);
      if (type === "DISLIKE") newStats.downVotes = Math.max(0, (newStats.downVotes || 0) - 1);
    } else {
      // Change vote or new vote
      if (type === "LIKE") {
        newStats.upVotes = (newStats.upVotes || 0) + 1;
        if (previousVote === "DISLIKE")
          newStats.downVotes = Math.max(0, (newStats.downVotes || 0) - 1);
      } else {
        // Downvote logic
        newStats.downVotes = (newStats.downVotes || 0) + 1;
        if (previousVote === "LIKE") newStats.upVotes = Math.max(0, (newStats.upVotes || 0) - 1);
      }
    }

    setUserVote(newVote);
    setStats(newStats);
    setIsVoting(true);

    try {
      // 1. 获取 Turnstile Token (人机验证)
      const token = turnstileRef.current?.getResponse();
      if (!token) {
        // 如果没有 token，尝试重新触发验证
        turnstileRef.current?.execute();
        toast.error("验证失败，请重试~");
        // 这里可以直接 return，让用户因为 execute() 再次点击或自动重试
        // 但更好的体验是等待 execute() 完成，不过 turnstile 库通常是异步回调模式
        // 这里简化处理：让用户再点一次，或等待 invisible 模式自动完成
        setUserVote(previousVote);
        setStats(previousStats);
        setIsVoting(false);
        return; 
      }

      // 2. 进行安全签名 (获取 Nonce -> 钱包签名)
      // 这会触发钱包弹窗
      const { signature, nonce } = await performSecureAction(type, article.id, token);

      // 3. 提交请求
      const res = await fetch("/api/article/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          articleId: article.id, 
          action: type,
          signature,
          nonce 
        }),
      });

      const json = await res.json();
      if (json.code === 200) {
        // 验证成功后重置 Turnstile，防止 Token 复用
        turnstileRef.current?.reset();

        // 提示成功
        if (newVote === "LIKE") {
          toast.success("点赞成功！");
        } else if (newVote === "DISLIKE") {
          toast.success("踩了一下...");
        } else {
          toast.success("已取消操作");
        }
        
        // Update with server actuals if provided
        if (json.data) {
          setStats((prev) => ({
            ...prev,
            upVotes: json.data.upVotes,
            downVotes: json.data.downVotes,
          }));
        }
      } else {
        throw new Error(json.message);
      }
    } catch (error: any) {
      console.error(error);
      // Revert
      setUserVote(previousVote);
      setStats(previousStats);
      
      // 处理特定错误
      if (error.message?.includes("User rejected")) {
        toast.error("已取消签名");
      } else {
        toast.error(`操作失败: ${error.message || "未知错误"}`);
      }
      
      // 失败也要重置 Turnstile
      turnstileRef.current?.reset();
    } finally {
      setIsVoting(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num?.toString() || "0";
  };

  const formatDate = (date: Date | string) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return "刚刚";
  };

  return (
    <div
      className="mb-4 cursor-pointer rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => router.push(`/article/${article.id}`)}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div
          className="flex cursor-pointer gap-3 transition-opacity hover:opacity-80"
          onClick={(e) => {
            e.stopPropagation();
            router.push(
              currentUser?.id === article.author.id ? "/mine" : `/user/${article.author.id}`
            );
          }}
        >
          <UserAvatar
            src={article.author.avatar}
            name={article.author.name}
            seed={article.author.userId}
            size={40}
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{article.author.name}</span>
            <span className="text-xs text-gray-400">{formatDate(article.createdAt)}</span>
          </div>
        </div>

        {article.node && (
          <div
            className="flex items-center gap-1 text-blue-600/60 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              if (currentNodeId === article.node.id) return;
              router.push(`/node/${article.node.id}`);
            }}
          >
            <Atom size={18} className="text-blue-500/80" />
            <span className="text-xs font-medium">{article.node.name}</span>
          </div>
        )}
      </div>

      {/* Quote Block (Visible only if rich content exists) */}
      {hasRichContent && (
        <div className="mb-2">
          <div className="flex overflow-hidden rounded-xl bg-gray-50">
            <div className="w-1.5 shrink-0 bg-blue-500" />
            <div className="p-2">
              <p className="line-clamp-1 text-[12px] leading-relaxed text-gray-400 italic">
                “{article.description}”
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <div className="mb-2">
        {extendedContent?.title ? (
          <h3 className="line-clamp-3 text-[17px] leading-tight font-bold text-gray-900">
            {extendedContent.title}
          </h3>
        ) : extendedContent?.description ? (
          <p className="line-clamp-3 text-[16px] leading-snug font-bold text-gray-900">
            {extendedContent.description}
          </p>
        ) : !hasRichContent ? (
          <p className="line-clamp-3 text-[16px] leading-snug font-bold text-gray-900">
            {article.description}
          </p>
        ) : null}
      </div>

      {/* Image */}
      {article.images && article.images.length > 0 && (
        <div className="relative mb-2 aspect-[5/2] w-full overflow-hidden rounded-2xl bg-gray-100">
          <Image src={article.images[0]} alt="article image" fill className="object-cover" />
        </div>
      )}

      {/* Tags */}
      <div className="mb-1 flex flex-wrap gap-2">
        {article.tags.map((tag) => (
          <span
            key={tag.name}
            className="rounded-lg px-2.5 py-1 text-[11px] transition-opacity hover:opacity-80"
            style={{
              color: tag.color,
              backgroundColor: `color-mix(in srgb, ${tag.color}, transparent 90%)`,
            }}
          >
            # {tag.name.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between text-[13px] font-medium text-gray-400">
        <div className="flex items-center gap-5">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              handleVote("LIKE");
            }}
            className={`flex items-center gap-1.5 transition-colors ${userVote === "LIKE" ? "text-blue-600" : "hover:text-blue-500"}`}
          >
            <ThumbsUp size={18} className={userVote === "LIKE" ? "fill-current" : ""} />
            <span>{formatNumber(stats.upVotes)}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              handleVote("DISLIKE");
            }}
            className={`flex items-center gap-1.5 transition-colors ${userVote === "DISLIKE" ? "text-red-500" : "hover:text-red-400"}`}
          >
            <ThumbsDown size={18} className={userVote === "DISLIKE" ? "fill-current" : ""} />
            <span>{formatNumber(stats.downVotes || 0)}</span>
          </motion.button>

          <div onClick={(e) => e.stopPropagation()}>
            <CommentDrawer
              articleId={article.id}
              trigger={
                <button className="flex items-center gap-1.5 transition-colors hover:text-gray-600">
                  <MessageSquare size={18} />
                  <span>{stats.comments}</span>
                </button>
              }
            />
          </div>

          <span className="ml-1 font-bold text-blue-500">
            {formatNumber(stats.cmwValue || 0)} CMW
          </span>
        </div>

        <button
          className="p-1 hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Share logic
          }}
        >
          <Share2 size={18} />
        </button>
      </div>
      
      {/* Turnstile Widget (Invisible) */}
      <TurnstileWidget ref={turnstileRef} />
    </div>
  );
}
