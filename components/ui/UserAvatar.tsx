"use client";

import React, { useMemo } from "react";
import { generateIdenticon } from "@/lib/utils/avatar";

interface UserAvatarProps {
  src?: string;
  name?: string;
  seed: string; // 用于生成头像的种子，通常是 address 或 userId
  size?: number;
  className?: string;
  borderRadius?: string;
}

export default function UserAvatar({
  src,
  name,
  seed,
  size = 40,
  className = "",
  borderRadius = "rounded-full",
}: UserAvatarProps) {
  // 1. 检查是否应该显示回退像素头像
  const isInvalidSrc =
    !src ||
    src === "" ||
    src.includes("placeholder") ||
    src.includes("avataaars") ||
    src.includes("example.com");

  // 2. 本地生成像素头像，全随机对称模式
  const fallbackUrl = useMemo(() => generateIdenticon(seed), [seed]);

  const avatarUrl = isInvalidSrc ? fallbackUrl : src!;

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden bg-gray-100 ${borderRadius} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={avatarUrl}
        alt={name || "User Avatar"}
        className="h-full w-full object-cover"
        style={{ width: "100%", height: "100%" }}
        onError={(e) => {
          // 如果原图加载失败，回退到像素头像
          if (avatarUrl !== fallbackUrl) {
            e.currentTarget.src = fallbackUrl;
          }
        }}
      />
    </div>
  );
}
