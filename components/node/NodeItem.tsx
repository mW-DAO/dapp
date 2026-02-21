import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Share2 } from "lucide-react";
import { NodeData } from "@/types/node";
import UserAvatar from "@/components/ui/UserAvatar";
import { useAuthAction } from "@/hooks/useAuthAction";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import axios from "axios";
import { parseAndHighlightHashtags } from "@/lib/utils/text";

interface NodeItemProps {
  data: NodeData;
}

export default function NodeItem({ data }: NodeItemProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { runWithAuth } = useAuthAction();
  const { user } = useUser();
  const [isJoined, setIsJoined] = useState(!!data.isJoined);
  const [memberCount, setMemberCount] = useState(data.stats.members);
  const [loadingJoin, setLoadingJoin] = useState(false);

  // Check if current user is the creator
  const isOwner = user?.id === data.creatorId;

  useEffect(() => {
    if (data.isJoined !== undefined && data.isJoined !== isJoined) {
      setIsJoined(!!data.isJoined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.isJoined]);

  const handleJoinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    runWithAuth(async () => {
      const action = isJoined ? "leave" : "join";
      try {
        await axios.post("/api/node/join", {
          nodeId: data.id,
          action,
        });

        setIsJoined(!isJoined);
        setMemberCount((prev) => (isJoined ? prev - 1 : prev + 1));

        // Invalidate queries to refresh list data across the app
        queryClient.invalidateQueries({ queryKey: ["nodes"] });
        queryClient.invalidateQueries({ queryKey: ["user-nodes"] });
        queryClient.invalidateQueries({ queryKey: ["node", data.id] });
      } catch (error) {
        console.error("Failed to toggle node join", error);
      }
    });
  };

  return (
    <div
      className="mb-3 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
      onClick={() => router.push(`/node/${data.id}`)}
    >
      {/* Cover Image */}
      <div className="relative h-24 w-full bg-gray-900">
        <Image src={data.coverImage} alt={data.name} fill className="object-cover opacity-80" />
        <div className="absolute inset-0 flex items-end px-2 pb-1">
          <h2 className="text-2xl font-black tracking-wide text-white shadow-black drop-shadow-lg">
            {data.name}
          </h2>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              router.push(user?.id === data.author.id ? "/mine" : `/user/${data.author.id}`);
            }}
          >
            <UserAvatar
              src={data.author.avatar}
              name={data.author.name}
              seed={data.author.name}
              size={40}
            />
            <div>
              <div className="font-bold text-gray-900">{data.author.name}</div>
              <div className="text-xs text-gray-400">{data.author.description}</div>
            </div>
          </div>
          {!isOwner && (
            <button
              onClick={handleJoinToggle}
              disabled={loadingJoin}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                isJoined
                  ? "bg-gray-100 text-gray-500"
                  : "bg-blue-100 text-blue-600 hover:bg-blue-200"
              }`}
            >
              {loadingJoin ? "..." : isJoined ? "已加入" : "+ 加入"}
            </button>
          )}
        </div>

        {/* Description */}
        <p className="mb-2 line-clamp-3 text-sm leading-relaxed text-gray-600">
          {parseAndHighlightHashtags(data.description, (tag) => {
            console.log("Clicked tag:", tag);
            // router.push(`/search?q=${encodeURIComponent(tag)}`);
          })}
        </p>

        {/* Stats */}
        <div className="mb-2 flex items-center gap-4 text-xs text-gray-400">
          <span>
            人数: <span className="font-medium text-gray-900">{memberCount.toLocaleString()}</span>
          </span>
          <span>{data.stats.contentCount}条内容</span>
          <span>
            已产出 <span className="font-medium text-blue-600">{data.stats.outputValue}</span>
          </span>
        </div>

        {/* Footer: Tags & Share */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {data.tags.map((tag) => (
              <span
                key={tag.name}
                className="rounded-sm px-2 py-1 text-[10px]"
                style={{
                  color: tag.color,
                  backgroundColor: `color-mix(in srgb, ${tag.color}, transparent 90%)`,
                }}
              >
                #{tag.name}
              </span>
            ))}
          </div>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Share logic
            }}
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
