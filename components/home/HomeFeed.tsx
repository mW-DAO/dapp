"use client";

import React, { useState } from "react";
import ArticleList from "@/components/article/ArticleList";

type TabType = "hot" | "latest" | "following";

const TAB_CONFIG: Record<TabType, string> = {
  hot: "热榜",
  latest: "最新",
  following: "关注",
};

export default function HomeFeed() {
  const [activeTab, setActiveTab] = useState<TabType>("hot");
  const tabs: TabType[] = ["hot", "latest", "following"];

  return (
    <>
      {/* Sub Tabs */}
      <div className="sticky top-[60px] z-30 border-b border-gray-100 bg-white/95 pt-2 backdrop-blur-sm">
        <div className="flex gap-6 px-4 text-sm font-medium">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-2 transition-colors ${
                activeTab === tab ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {TAB_CONFIG[tab]}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-blue-600"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4 pb-20">
        <ArticleList activeTab={activeTab} />
      </div>
    </>
  );
}
