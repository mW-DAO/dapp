"use client";

import { Drawer } from "vaul";
import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface CommentDrawerProps {
  articleId: string;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommentDrawer({ articleId, trigger, open, onOpenChange }: CommentDrawerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  // Use internal state if props not provided
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  const handleSubmit = async () => {
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/comment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, content }),
      });

      const json = await res.json();
      if (json.code === 200) {
        toast.success("评论已发布");
        setContent("");
        setIsOpen(false);
      } else {
        toast.error(json.message || "评论失败");
      }
    } catch (e) {
      toast.error("网络错误");
    } finally {
      setSending(false);
    }
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 transition-opacity" />
        <Drawer.Content className="fixed right-0 bottom-0 left-0 z-50 flex h-[85vh] flex-col rounded-t-[20px] bg-white">
          <div className="flex-1 overflow-y-auto rounded-t-[20px] bg-white p-4">
            <Drawer.Title className="sr-only">评论</Drawer.Title>
            <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />

            <div className="mx-auto max-w-md">
              {/* Comment List Placeholder */}
              <div className="py-20 text-center text-sm text-gray-400">
                <div className="mb-2 text-4xl">💬</div>
                <p>抢沙发...</p>
                <p className="mt-1 text-xs text-gray-300">
                  虽然还没展示评论列表，但你的评论会直接入库哦
                </p>
              </div>
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="pb-safe border-t border-gray-100 bg-white p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-2xl bg-gray-50 p-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="写下你的想法..."
                  className="max-h-[100px] min-h-[40px] w-full resize-none bg-transparent text-sm outline-none"
                  rows={1}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || sending}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold text-white transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-50"
              >
                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
