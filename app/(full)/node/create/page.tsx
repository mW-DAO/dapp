"use client";

import React, { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Camera, Hash, ChevronRight, Atom, X, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import TagPicker from "@/components/common/TagPicker";
import { useUser } from "@/hooks/useUser";

export default function CreateNodePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // UI States
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Image State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

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

  const removeImage = () => {
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      toast.error("标签已存在");
      return;
    }
    if (tags.length >= 5) {
      toast.error("最多添加 5 个标签");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("请输入超级节点名称");
      return;
    }
    if (!description.trim()) {
      toast.error("请输入节点介绍");
      return;
    }
    if (!selectedImage) {
      toast.error("请上传超级节点封面图");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Upload Image
      let uploadedAvatarUrl = "";
      const formData = new FormData();
      formData.append("file", selectedImage);
      formData.append("type", "node");

      const uploadRes = await fetch("/api/common/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();

      if (uploadJson.code !== 200) {
        toast.error(uploadJson.message || "图片上传失败");
        setIsSubmitting(false);
        return;
      }
      uploadedAvatarUrl = uploadJson.data.url;

      // 2. Create Node
      const createRes = await fetch("/api/node/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          desc: description,
          avatar: uploadedAvatarUrl,
          tags,
        }),
      });

      const createJson = await createRes.json();

      if (createJson.code === 200) {
        toast.success("超级节点创建成功！");
        await queryClient.invalidateQueries({ queryKey: ["user", "nodes"] });
        await queryClient.invalidateQueries({ queryKey: ["my-nodes"] });

        // Redirect
        const redirectPath = callbackUrl || (user?.id ? `/node/user/${user.id}` : "/node");
        router.replace(redirectPath);
      } else {
        toast.error(createJson.message || "创建失败，请稍后重试");
      }
    } catch (error) {
      console.error("Create node error:", error);
      toast.error("网络错误，创建失败");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-3">
        <button onClick={() => router.back()} className="text-sm font-medium text-gray-400">
          取消
        </button>
        <h1 className="text-lg font-bold text-gray-900">建立超级节点</h1>
        <div className="w-8" />
      </header>

      {/* Main Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4 pb-32">
        {/* Node Name */}
        <div className="relative rounded-2xl bg-gray-50 p-4 transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-600">
          {!name && (
            <span className="pointer-events-none absolute top-4 left-4 text-sm text-gray-400/50">
              超级节点名称<span className="text-blue-600/55">（必填）</span>
            </span>
          )}
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
          />
          {name && (
            <button
              onClick={() => {
                setName("");
                nameInputRef.current?.focus();
              }}
              className="absolute top-1/2 right-4 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Description */}
        <div className="relative h-40 rounded-2xl bg-gray-50 p-4 transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-600">
          {!description && (
            <span className="pointer-events-none absolute top-4 left-4 text-sm leading-relaxed text-gray-400/50">
              介绍你的超级节点<span className="text-blue-600/55">（必填）</span>
            </span>
          )}
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-gray-900 focus:outline-none"
          />
          {description && (
            <button
              onClick={() => {
                setDescription("");
                descRef.current?.focus();
              }}
              className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition-colors hover:bg-gray-300 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Image Upload */}
        {previewUrl ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-gray-100">
            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white backdrop-blur-sm"
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
              <span className="text-xs text-blue-600/55">（必填）</span>
            </div>
          </button>
        )}

        {/* Tags Selection */}
        <TagPicker value={tags} onChange={setTags} />
      </div>

      {/* Create Button */}
      <div className="fixed right-0 bottom-0 left-0 border-t border-gray-50 bg-white p-4 pb-8">
        <button
          onClick={handleCreate}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              创建中...
            </>
          ) : (
            <>
              <Atom size={20} />
              建立超级节点
            </>
          )}
        </button>
      </div>
    </div>
  );
}
