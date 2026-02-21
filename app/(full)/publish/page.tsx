"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeNav } from "@/hooks/useSafeNav";
import { Link2, Atom, Plus, X, Loader2, Camera, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import TagPicker from "@/components/common/TagPicker";

export default function PublishPage() {
  const router = useSafeNav();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const initialNodeId = searchParams.get("nodeId");

  // Image State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaUrlRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Node State
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Link Preview State
  const [linkPreviewData, setLinkPreviewData] = useState<{
    title: string;
    description: string;
    image: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fetchedUrlRef = useRef("");

  // Use Link Image State
  const [useLinkImage, setUseLinkImage] = useState(false);

  // Reset useLinkImage when preview changes
  useEffect(() => {
    setUseLinkImage(false);
  }, [linkPreviewData]);

  // Tag State
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mainstream Approach: Use React Query for data fetching
  const { data: userNodes = [], isLoading: loading } = useQuery({
    queryKey: ["user", "nodes"],
    queryFn: async () => {
      const res = await fetch("/api/user/nodes");
      if (!res.ok) throw new Error("Failed to fetch nodes");
      const json = await res.json();
      return (json.data || []) as Array<{ id: string; name: string; avatar: string }>;
    },
    staleTime: 1000 * 60,
  });

  // Auto-show node selector if user has no nodes
  useEffect(() => {
    if (!loading && userNodes.length === 0) {
      setShowNodeSelector(true);
    }
  }, [loading, userNodes.length]);

  const handlePublishClick = () => {
    if (!mediaUrl) {
      toast.error("请验证您的媒体链接");
      return;
    }
    if (!content.trim()) {
      toast.error("请输入分享内容");
      return;
    }
    // Always open node selector to confirm/select node before publishing
    setShowNodeSelector(true);
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  const handleConfirmPublish = async () => {
    if (!selectedNodeId || isSubmitting) return;

    setIsSubmitting(true);
    let uploadedImageUrl = "";

    try {
      if (selectedImage) {
        const formData = new FormData();
        formData.append("file", selectedImage);
        formData.append("type", "article");

        const uploadRes = await fetch("/api/common/upload", {
          method: "POST",
          body: formData,
        });
        const uploadJson = await uploadRes.json();

        if (uploadJson.code !== 200) {
          toast.error(uploadJson.message || "图片上传失败，请重试");
          setIsSubmitting(false);
          return;
        }
        uploadedImageUrl = uploadJson.data.url;
      }

      const res = await fetch("/api/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          mediaUrl,
          nodeId: selectedNodeId,
          images:
            useLinkImage && linkPreviewData?.image
              ? [linkPreviewData.image]
              : uploadedImageUrl
                ? [uploadedImageUrl]
                : [],
          tags,
          extendedContent: linkPreviewData ? JSON.stringify(linkPreviewData) : undefined, // Save preview data
        }),
      });

      const result = await res.json();
      if (result.code === 200) {
        toast.success("内容发布成功！");
        await queryClient.invalidateQueries({ queryKey: ["nodes"] });
        // Redirect to the node detail page after successful publish
        router.replace(`/node/${selectedNodeId}`);
      } else {
        toast.error(result.message || "发布失败");
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast.error("网络错误，发布失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    setSelectedImage(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    e.target.value = "";
  };

  // Auto-clear preview when URL is cleared
  useEffect(() => {
    if (!mediaUrl) {
      setLinkPreviewData(null);
      fetchedUrlRef.current = "";
    }
  }, [mediaUrl]);

  const removeImage = () => {
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleContentFocus = async () => {
    if (!mediaUrl || !mediaUrl.startsWith("http")) return;
    if (mediaUrl === fetchedUrlRef.current) return; // Prevent duplicate fetch

    setLoadingPreview(true);
    fetchedUrlRef.current = mediaUrl;

    try {
      const res = await fetch(`/api/common/preview?url=${encodeURIComponent(mediaUrl)}`);
      const json = await res.json();
      if (json.code === 200) {
        setLinkPreviewData(json.data);
      }
    } catch (error) {
      console.error("Preview fetch failed:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const removeLinkPreview = () => {
    setLinkPreviewData(null);
    fetchedUrlRef.current = ""; // Allow re-fetch if needed
  };

  const selectedNodeName = userNodes.find((n) => n.id === selectedNodeId)?.name;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageSelect}
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-50 bg-white px-4 py-3">
        <button onClick={() => router.back()} className="text-sm font-medium text-gray-600">
          取消
        </button>
        <h1 className="text-lg font-bold text-gray-900">发布信息</h1>
        <div className="w-8" />
      </header>

      {/* Main Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-32">
        {/* Media Upload Area */}
        <div className="rounded-2xl bg-gray-50 p-4 transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-600">
          <div className="flex items-center gap-3">
            <Link2 size={20} className="flex-shrink-0 text-gray-400" />
            <div className="relative flex-1">
              {!mediaUrl && (
                <span className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-sm text-gray-400/50">
                  粘贴主要媒体链接<span className="text-blue-600/55">（必填）</span>
                </span>
              )}
              <input
                ref={mediaUrlRef}
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 focus:outline-none"
              />
            </div>
            {mediaUrl && (
              <button
                onClick={() => {
                  setMediaUrl("");
                  mediaUrlRef.current?.focus();
                }}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Text Input Area */}
        <div className="relative rounded-2xl bg-gray-50 p-4 transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-600">
          {!content && (
            <span className="loading-relaxed pointer-events-none absolute top-4 left-4 text-sm text-gray-400/50">
              分享更多的内容<span className="text-blue-600/55">（必填）</span>
            </span>
          )}
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={handleContentFocus}
            className="min-h-[120px] w-full resize-none bg-transparent text-sm text-gray-900 focus:outline-none"
          />
          {content && (
            <button
              onClick={() => {
                setContent("");
                contentRef.current?.focus();
              }}
              className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Link Preview Card */}
        {linkPreviewData && (
          <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <button
              onClick={removeLinkPreview}
              className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-1 text-white backdrop-blur-sm transition-transform active:scale-95"
            >
              <X size={12} />
            </button>
            {linkPreviewData.image && (
              <div className="h-32 w-full overflow-hidden">
                <img
                  src={linkPreviewData.image}
                  alt={linkPreviewData.title}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback to proxy if direct load fails (optional enhancement)
                    // e.currentTarget.src = `/api/common/image-proxy?url=${encodeURIComponent(linkPreviewData.image)}`;
                    // For now, just keep no-referrer which solves 90%
                    e.currentTarget.style.display = "none"; // Hide broken images
                  }}
                />
              </div>
            )}
            <div className="p-3">
              <h3 className="line-clamp-1 text-sm font-bold text-gray-900">
                {linkPreviewData.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                {linkPreviewData.description}
              </p>
            </div>

            {/* Use Original Cover Option */}
            {linkPreviewData.image && (
              <div
                className="border-t border-gray-100 bg-gray-50/50 p-3"
                onClick={() => setUseLinkImage(!useLinkImage)}
              >
                <div className="flex cursor-pointer items-center gap-2">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${useLinkImage ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}
                  >
                    {useLinkImage && <Check size={14} strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-medium text-gray-600 select-none">
                    使用链接预览图作为封面
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading Indicator for Preview */}
        {loadingPreview && (
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            正在解析链接...
          </div>
        )}

        {/* Image Preview / Upload (Create Node Style) */}
        {!useLinkImage &&
          (previewUrl ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-gray-100">
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white backdrop-blur-sm transition-transform active:scale-95"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-2xl bg-gray-50 transition-colors hover:bg-gray-100"
            >
              <div className="flex h-8 w-8 items-center justify-center text-gray-400/50">
                <Camera size={28} />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400/50">添加图片</span>
                <span className="text-xs text-gray-400/55">（选填）</span>
              </div>
            </button>
          ))}

        {/* Tags Selection */}
        <TagPicker value={tags} onChange={setTags} />
      </div>

      {/* Bottom Action Buttons */}
      <div className="fixed right-0 bottom-0 left-0 flex gap-3 border-t border-gray-100 bg-white p-4 pb-8">
        <button
          onClick={handlePublishClick}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-95"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              发布中...
            </>
          ) : (
            <>
              <Atom size={20} />
              发布到超级节点
            </>
          )}
        </button>
        <button
          onClick={() => router.push("/node/create?callbackUrl=/publish")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-blue-600 bg-white py-3.5 text-sm font-bold text-blue-600 transition-all active:scale-95"
        >
          <Plus size={20} />
          新建超级节点
        </button>
      </div>

      {/* Node Selector Modal */}
      <AnimatePresence>
        {showNodeSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (userNodes.length === 0) {
                router.safeBack();
              } else {
                setShowNodeSelector(false);
              }
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[70vh] w-full flex-col rounded-t-3xl bg-white"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 className="text-base font-bold text-gray-900">选择你要发布的超级节点</h2>
                <button
                  onClick={() => {
                    if (userNodes.length === 0) {
                      router.safeBack();
                    } else {
                      setShowNodeSelector(false);
                    }
                  }}
                  className="rounded-full p-1 transition-colors hover:bg-gray-100"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {userNodes.length > 0 ? (
                  <div className="space-y-3">
                    {userNodes.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                          <img
                            src={node.avatar}
                            alt={node.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="flex-1 text-left font-medium text-gray-900">
                          {node.name}
                        </span>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selectedNodeId === node.id ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}
                        >
                          {selectedNodeId === node.id && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="mb-8 text-base text-gray-400">你还没有超级节点</p>
                    <button
                      onClick={() => router.push("/node/create?callbackUrl=/publish")}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                      <Atom size={20} />
                      建立你的第一个超级节点
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer with Publish Button */}
              {userNodes.length > 0 && (
                <div className="border-t border-gray-100 p-4">
                  <button
                    onClick={handleConfirmPublish}
                    disabled={!selectedNodeId || isSubmitting}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all active:scale-95 ${
                      !selectedNodeId || isSubmitting
                        ? "cursor-not-allowed bg-blue-300"
                        : "bg-blue-600 shadow-lg shadow-blue-200"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        发布中...
                      </>
                    ) : (
                      <>
                        <Atom size={20} />
                        发布到超级节点
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
