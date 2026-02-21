"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Camera, Loader2, Check } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { User } from "@/types/user";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";

export default function EditProfilePage() {
  const router = useRouter();
  // 设置 staleTime 为 0，确保进页面时 React Query 自动触发一次且仅一次刷新
  const { user, isLoading: userLoading } = useUser({ staleTime: 0 });
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    username: "",
    bio: "",
    avatar: "",
  });

  // 当全局用户数据准备好后，初始化表单
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        bio: user.bio || "",
        avatar: user.avatar || "",
      });
    }
  }, [user]);

  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (json.code === 200) {
        // 关键：立即刷新全局用户缓存
        await queryClient.invalidateQueries({ queryKey: ["user", "me"] });

        toast.success("个人资料更新成功！");
        setTimeout(() => {
          router.back();
        }, 1200);
      } else {
        toast.error(json.message || "更新失败，请稍后重试");
      }
    } catch (error) {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    const toastId = toast.loading("正在上传头像...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");

      const res = await fetch("/api/common/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.code === 200) {
        setFormData((prev) => ({ ...prev, avatar: json.data.url }));
        toast.success("头像上传成功", { id: toastId });
      } else {
        toast.error(json.message || "上传失败", { id: toastId });
      }
    } catch (error) {
      toast.error("上传出错，请稍后重试", { id: toastId });
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header - 全平左对齐 */}
      <header className="sticky top-0 z-40 flex h-[60px] flex-none items-center border-b border-gray-100/80 bg-white px-4">
        <button
          onClick={() => router.back()}
          className="-ml-2 p-2 text-gray-800 transition-all active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="ml-1 text-lg font-bold text-gray-900">编辑个人资料</h1>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Avatar Section - 平面化处理 */}
          <div className="flex flex-col items-center">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-1">
                <UserAvatar
                  src={formData.avatar}
                  seed={user.address}
                  size={100}
                  borderRadius="rounded-3xl"
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/5 opacity-0 transition-opacity hover:opacity-100">
                <Camera className="h-8 w-8 text-white/60" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, avatar: "" })}
              className="mt-4 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              删除头像
            </button>
          </div>

          {/* Form Fields - 极简平面化 */}
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="ml-1 text-[13px] font-bold tracking-wider text-gray-500 uppercase">
                用户名
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="h-12 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 font-medium text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="起个好听的名字吧"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[13px] font-bold tracking-wider text-gray-500 uppercase">
                个人简介
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="min-h-[140px] w-full resize-none rounded-xl border border-gray-100 bg-gray-50 p-4 font-medium text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="介绍一下你自己..."
              />
              <div className="mr-2 text-right text-[11px] text-gray-400">
                {formData.bio.length} / 200
              </div>
            </div>
          </div>

          {/* Feedback Message removed as we use global toasts */}

          {/* Submit Button - 全平设计 */}
          <button
            type="submit"
            disabled={saving}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 text-[17px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在保存...
              </>
            ) : (
              "保存修改"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
