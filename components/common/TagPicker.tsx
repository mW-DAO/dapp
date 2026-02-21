"use client";

import React, { useState } from "react";
import { Hash, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export default function TagPicker({ value = [], onChange, maxTags = 5 }: TagPickerProps) {
  const [showSelector, setShowSelector] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Fetch Hot Tags
  const { data: hotTags = [] } = useQuery({
    queryKey: ["tags", "hot"],
    queryFn: async () => {
      const res = await fetch("/api/tag/hot");
      const json = await res.json();
      return (json.data?.list || []) as string[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const displayTags = hotTags;

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#+/, "");
    if (!trimmed) return;
    if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("标签已存在");
      return;
    }
    if (value.length >= maxTags) {
      toast.error(`最多添加 ${maxTags} 个标签`);
      return;
    }
    onChange([...value, trimmed]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((t) => t !== tagToRemove));
  };

  return (
    <>
      <button
        onClick={() => setShowSelector(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-gray-50 p-4 transition-colors hover:bg-gray-100"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <Hash size={20} className="flex-shrink-0 text-gray-500/50" />
          {value.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {value.map((tag) => (
                <span key={tag} className="text-sm font-medium text-blue-600">
                  #{tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-400/50">添加标签（选填）</span>
          )}
        </div>
        <ChevronRight size={20} className="flex-shrink-0 text-gray-300" />
      </button>

      <AnimatePresence>
        {showSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSelector(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full flex-col rounded-t-3xl bg-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 className="text-base font-bold text-gray-900">选择话题标签</h2>
                <button
                  onClick={() => setShowSelector(false)}
                  className="rounded-full p-1 transition-colors hover:bg-gray-100"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Input */}
                <div className="mb-6 flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag(tagInput);
                    }}
                    maxLength={6}
                    placeholder="自定义标签（最多6个字）"
                    className="flex-1 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                  <button
                    onClick={() => handleAddTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>

                {/* Selected Tags */}
                {value.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 text-xs font-medium text-gray-400">已选标签</div>
                    <div className="flex flex-wrap gap-2">
                      {value.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600"
                        >
                          #{tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 opacity-60 hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Tags */}
                {displayTags.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs font-medium text-gray-400">推荐标签</div>
                    <div className="flex flex-wrap gap-2">
                      {displayTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleAddTag(tag)}
                          disabled={value.includes(tag)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                            value.includes(tag)
                              ? "border-blue-100 bg-blue-50 text-blue-400 opacity-50"
                              : "border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-600"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 p-4">
                <button
                  onClick={() => setShowSelector(false)}
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white active:scale-95"
                >
                  确定 ({value.length})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
