"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, HelpCircle, LogOut, Zap, Pickaxe, Crown } from "lucide-react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { useDisconnect } from "wagmi";
import { User } from "@/types/user";

import UserAvatar from "@/components/ui/UserAvatar";
import { InfoDrawer } from "@/components/ui/InfoDrawer";
import { useAuthAction } from "@/hooks/useAuthAction";
import { useUser } from "@/hooks/useUser";
import axios from "axios";

import { type Address, formatEther } from "viem";
import { useMWNFTBalance } from "@/hooks/contracts/useMWNFT";
import { useCMWTokenBalance } from "@/hooks/contracts/useCMWToken";
import { useUserRewardInfo } from "@/hooks/contracts/useMediaReward";

import { useQueryClient } from "@tanstack/react-query";

interface UserProfileProps {
  user: User;
  isOwnProfile: boolean;
}

export default function UserProfile({ user: initialUser, isOwnProfile }: UserProfileProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isConnected, runWithAuth } = useAuthAction();
  const { mutate: disconnect } = useDisconnect();
  const { user: currentUser } = useUser();

  // 内部判定：如果传入的 initialUser 的 ID 与当前登录用户的 ID 一致，即视为自己的主页
  const isMe =
    isOwnProfile || (!!currentUser && !!initialUser && currentUser.id === initialUser.id);

  // 渲染使用的数据：是自己就用最新的全局状态，否则用传入的数据
  const user = isMe ? currentUser || initialUser : initialUser;

  // READ CONTRACT: Get real-time NFT balance
  const { data: nftBalance } = useMWNFTBalance(user.address as Address);
  const displayNftCount = nftBalance !== undefined ? nftBalance.toString() : "0";

  // READ CONTRACT: Get CMW Token balance
  const { data: cmwBalanceRaw } = useCMWTokenBalance(user.address as Address);
  const displayCmwBalance = cmwBalanceRaw
    ? Number(formatEther(cmwBalanceRaw)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0";

  // READ CONTRACT: Get User Reward Info (Miner Revenue)
  const { data: rewardData } = useUserRewardInfo(user.address as Address);
  const displayMinerRevenue = rewardData?.totalEarned
    ? parseFloat(rewardData.totalEarned).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : "0";

  const [isFollowed, setIsFollowed] = React.useState(false);
  const [followerCount, setFollowerCount] = React.useState(user.followersCount);
  const [loadingFollow, setLoadingFollow] = React.useState(true);

  // 获取关注状态
  React.useEffect(() => {
    if (isMe) {
      setLoadingFollow(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const { data } = await axios.get(`/api/user/follow-status?followingId=${user.id}`);
        setIsFollowed(data.data.isFollowing);
      } catch (error) {
        console.error("Failed to check follow status", error);
      } finally {
        setLoadingFollow(false);
      }
    };
    checkStatus();
  }, [user.id, isMe, isOwnProfile]);

  const [showUnfollowConfirm, setShowUnfollowConfirm] = React.useState(false);

  const handleFollowClick = () => {
    if (isFollowed) {
      setShowUnfollowConfirm(true);
    } else {
      executeFollow("follow");
    }
  };

  const executeFollow = async (action: "follow" | "unfollow") => {
    runWithAuth(async () => {
      try {
        setLoadingFollow(true);

        // Add artificial delay for better UX (at least 500ms)
        const [response] = await Promise.all([
          axios.post("/api/user/follow", {
            followingId: user.id,
            action,
          }),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);

        if (action === "unfollow") setShowUnfollowConfirm(false);

        setIsFollowed(action === "follow");
        setFollowerCount((prev) => (action === "follow" ? prev + 1 : prev - 1));
        toast.success(action === "follow" ? "关注成功" : "已取消关注");
      } catch (error) {
        console.error("Failed to toggle follow", error);
        toast.error("操作失败，请重试");
      } finally {
        setLoadingFollow(false);
      }
    });
  };

  const handleLogout = async () => {
    try {
      // 1. Call API to clear cookie
      await axios.post("/api/auth/logout");

      // 2. Clear React Query Cache immediately
      queryClient.setQueryData(["user", "me"], null);

      // 3. Disconnect Wallet
      disconnect();

      // 4. Redirect
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
      // Force disconnect anyway
      disconnect();
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* 顶部蓝色背景区域 - 渐变色 */}
      <div className="relative h-40 bg-gradient-to-br from-[#2979FF] to-[#651FFF]">
        {/* 头像 - 部分在蓝色区域，部分在白色区域 */}
        <div className="absolute -bottom-16 left-6">
          <div className="rounded-[2rem] bg-white p-1.5 shadow-sm">
            <UserAvatar
              src={user.avatar}
              name={user.username}
              seed={user.address || user.userId}
              size={96}
              borderRadius="rounded-[1.5rem]"
            />
          </div>
        </div>
      </div>

      {/* 用户信息区域 - 白色背景 */}
      <div className="px-6 pt-8 pb-2">
        {/* 用户名/ID (Avatar right side) */}
        <div className="-mt-8 mb-6 flex flex-col pl-[115px]">
          <h1 className="text-2xl leading-tight font-bold text-gray-900">{user.username}</h1>
          <p className="mt-1 text-sm font-medium text-blue-400">ID: {user.userId}</p>
        </div>

        {/* 统计数据和编辑按钮 - 卡片容器 */}
        <div className="-mx-2 flex items-center justify-between rounded-2xl bg-gray-100/60 p-5">
          {/* 统计数据区域 - 占据剩余空间并居中分布 */}
          <div className="flex flex-1 items-center justify-around pr-6">
            <div className="flex flex-col items-center">
              <div className="text-xl font-extrabold text-gray-900">{user.followingCount}</div>
              <div className="mt-1 text-xs font-medium text-gray-400">关注</div>
            </div>

            {/* Divider */}
            <div className="h-8 w-[1px] bg-gray-200"></div>

            <div className="flex flex-col items-center">
              <div className="text-xl font-extrabold text-gray-900">
                {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}k` : followerCount}
              </div>
              <div className="mt-1 text-xs font-medium text-gray-400">粉丝</div>
            </div>
          </div>

          {/* 编辑资料按钮 - 仅"我的"页面显示 */}
          {isMe ? (
            <Link
              href="/mine/edit"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
            >
              编辑资料
            </Link>
          ) : (
            <button
              onClick={handleFollowClick}
              disabled={loadingFollow}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
                isFollowed
                  ? "bg-gray-200 text-gray-600"
                  : "bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700"
              }`}
            >
              {loadingFollow ? "..." : isFollowed ? "取消关注" : "+ 关注"}
            </button>
          )}
        </div>
      </div>

      {/* 资产卡片 - 仅"我的"页面显示 */}
      {isMe && (
        <div className="mt-2 px-4">
          <div className="relative rounded-2xl bg-gray-800">
            {/* 装饰性飞机图案 (Clipped Layer) */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute right-0 bottom-0 h-48 w-48 opacity-20">
                <svg viewBox="0 0 200 200" fill="none">
                  <path
                    d="M150 50 L180 80 L120 140 L100 120 L150 50Z M100 120 L80 140 L60 120 L80 100 L100 120Z"
                    stroke="white"
                    strokeWidth="3"
                    fill="white"
                    fillOpacity="0.3"
                  />
                </svg>
              </div>
            </div>

            {/* Content Layer (Unclipped for Drawer) */}
            <div className="pointer-events-none relative z-10 p-6">
              {/* Help Icon positioned top-right relative to card - Interactivity Restored */}
              <div className="pointer-events-auto absolute top-1 right-1">
                <InfoDrawer
                  title="CMW 是 m&W DAO 生态的 Token"
                  trigger={
                    <div className="cursor-pointer p-1 transition-transform active:scale-95">
                      <HelpCircle
                        fill="rgba(255, 255, 255, 0.2)"
                        className="h-5 w-5 text-white/60 transition-colors hover:text-white"
                      />
                    </div>
                  }
                >
                  <div className="space-y-3 text-sm leading-relaxed text-gray-700">
                    <div>
                      <p className="mt-1">
                        总量 <span className="font-bold text-blue-600">10 亿枚</span>，10% 预留为生态基金，30% 预留为项目融资与早期核心成员激励，
                        60% 由 m&W DAO Builder 与 m&W 用户共同组成 CMW 代币生态挖矿产出。
                      </p>
                    </div>

                    <div className="h-px bg-gray-200" />

                    <div>
                      <p className="font-semibold text-gray-900">生态挖矿总则</p>
                      <p className="mt-1">
                        6 亿枚 CMW 20 年释放，其中用于 <span className="font-bold">m&W DAO Builder 挖矿比例占三分之一</span>；
                        <span className="font-bold">m&W 用户挖矿比例占三分之二</span>，即每年用户挖矿总量 1800 万枚。
                      </p>
                    </div>

                    <div className="h-px bg-gray-200" />

                    <div>
                      <p className="font-semibold text-gray-900 mb-2">CMW 变现概览</p>
                      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                        <li className="flex gap-2">
                          <span className="mt-0.5 text-gray-400">◆</span>
                          <span>m&W 1.0（Web3 内容社区）时期，CMW 作为社区流量变现的支付工具，节点用户打赏、超级节点创业众筹、上币交易；</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-0.5 text-gray-400">◆</span>
                          <span>m&W 2.0（EcoFi）发布任务与接收任务者的通证抵押、OG 决策与社区治理参与者也都需要抵押 CMW；</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-0.5 text-gray-400">◆</span>
                          <span>为生态资源在 DEX 建 CMW 交易对；</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-0.5 text-gray-400">◆</span>
                          <span>基于已经被激活了的 EcoFi（m&W 2.0 阶段）的生态孵化行为（高成功率、高回报率）生态合作的通证支付行为。</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </InfoDrawer>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-white/60">我的 CMW 余额</span>
              </div>
              <div className="mb-5 text-4xl font-bold text-white">{displayCmwBalance}</div>
              <div className="pointer-events-auto flex gap-4">
                <button className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                  链上提现
                </button>
                <button className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                  链接钱包
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 功能卡片区域 - 两列布局 */}
      <div className="mt-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          {/* 权益 NFT */}
          <div className="group relative block rounded-2xl bg-blue-50 p-4 transition-all hover:bg-blue-100">
            <Link href={`/nft?address=${user.address || ""}`} className="absolute inset-0 z-0" />
            <div className="pointer-events-none relative z-10 flex h-full items-center justify-between">
              <div className="flex flex-col gap-2">
                <Crown size={22} className="text-blue-600" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm leading-none font-bold text-gray-900">
                      {isMe ? "我的" : "Ta的"}权益NFT
                    </h3>
                    <div className="pointer-events-auto">
                      <InfoDrawer
                        title="EcoFi m&W NFT 权益凭证"
                        trigger={
                          <div className="cursor-pointer p-1 text-blue-400/60 transition-colors hover:text-blue-500">
                            <HelpCircle size={18} />
                          </div>
                        }
                      >
                        <div className="space-y-2">
                          {/* 标题区域 */}
                          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 p-2">
                            <div className="space-y-1.5 text-sm">
                              <p className="font-semibold text-blue-600">
                                mint m&W NFT 市场价格 0.01BNB 起线性上涨
                              </p>
                              <p className="text-gray-600">
                                总量 <span className="font-bold text-gray-900">20000</span> 枚
                              </p>
                            </div>
                          </div>

                          {/* 权益列表 */}
                          <div className="mt-4 space-y-3">
                            {/* 权益 1 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                                1
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">持有 m&W NFT</span>{" "}
                                成为 m&W 第一批用户，拥有原居民独享的权益，首先是用户在社区的挖矿权重系数翻倍，同样的用户行为可以获得实现收益加速翻倍；
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />

                            {/* 权益 2 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                                2
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">凭借 NFT 链上 ID 作为邀请码</span>，建立用户链上关系体系——持有者凭借 NFT 链上 ID 作为邀请码，推荐朋友购买 NFT 或者注册 m&W 社区用户，可以获取总挖矿池给予该链上关系挖矿额度总数的{" "}
                                <span className="font-bold text-blue-600">10% 奖励</span>；
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />

                            {/* 权益 3 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                                3
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">空投 CMW 奖</span>——持有 NFT 即可获得空投{" "}
                                <span className="font-bold text-blue-600">500 枚 CMW</span>；邀请返利——持有者凭借 NFT 链上 ID 作为邀请码推荐朋友购买 NFT 时，推荐者和购买者均可再获得{" "}
                                <span className="font-bold text-blue-600">500 枚 CMW</span>；
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />

                            {/* 权益 4 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                                4
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">长效权益机制</span>：m&W NFT 持有者具有优先参与「无需信任」的 EcoFi 建设权限，且可优先获得以 EcoFi 推进孵化「AI+区块链」赛道的投资变现机会。
                              </div>
                            </div>
                          </div>
                        </div>
                      </InfoDrawer>
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-blue-600">
                    已获得 {displayNftCount} 个
                  </p>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 flex-shrink-0 text-blue-400" />
            </div>
          </div>

          {/* 我的超级节点 */}
          <div className="group relative block rounded-2xl bg-green-50 p-4 transition-all hover:bg-green-100">
            <Link href={`/node/user/${user.id}`} className="absolute inset-0 z-0" />
            <div className="pointer-events-none relative z-10 flex h-full items-center justify-between">
              <div className="flex flex-col gap-2">
                <Zap size={24} className="text-green-600" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm leading-none font-bold text-gray-900">
                      {isMe ? "我的" : "Ta的"}超级节点
                    </h3>
                    <div className="pointer-events-auto">
                      <InfoDrawer
                        title="超级节点"
                        trigger={
                          <div className="cursor-pointer p-1 text-green-400/60 transition-colors hover:text-green-500">
                            <HelpCircle size={18} />
                          </div>
                        }
                      >
                        <div className="space-y-2">
                          <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-2">
                            <div className="space-y-1.5 text-sm">
                              <p className="font-semibold text-green-700">
                                m&W DAO 希望加密生态优秀从业者成为 m&W 1.0（Web3内容社区）超级节点
                              </p>
                            </div>
                          </div>

                          {/* 核心理念列表 */}
                          <div className="mt-4 space-y-4">
                            {/* 理念 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-600">
                                ✓
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">m&W DAO 理念</span>：聚合加密生态优秀从业者，让加密生态的合作可以「去信任化」、「无需信任」
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />

                            {/* 机制 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-600">
                                ⚙
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">m&W DAO 机制</span>：去中心化架构与 TOKEN 经济模型相结合，建立 EcoFi 节点间「去信任关系」
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />

                            {/* 使命 */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-600">
                                ★
                              </div>
                              <div className="flex-1 text-sm leading-relaxed text-gray-700">
                                <span className="font-semibold text-gray-900">m&W DAO 使命</span>：在 EcoFi 基础上推动「AI+区块链」的实践，促进区块链为 AI 网络建立秩序
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />

                            {/* 超级节点功能 */}
                            <div className="rounded-lg bg-green-50/50 p-3">
                              <p className="mb-2 text-sm font-bold text-gray-900">超级节点核心功能</p>
                              <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                                <p>
                                  超级节点是 m&W 1.0（Web3内容社区）运营的核心目标资源，是 m&W 2.0（EcoFi）实现加密生态协作「去信任化」、「无需信任」的基础资源。
                                </p>
                                <p>
                                  超级节点会成为社区领袖，通过分享符合自己理念的、高价值又量资讯，来吸引自己的追随者。我们会设置 Token 激励机制助力超级节点突破熟人关系圈子扩新，我们未来也会开发社区管理工具便于超级节点管理节点粉丝；超级节点也会因为自己发布到社区的好文章而挖矿——被浏览、被点赞、被分享、被评论。
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </InfoDrawer>
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-green-600">
                    建立 {user.nodeCount} / 加入 {user.joinedNodeCount || 0}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 flex-shrink-0 text-green-400" />
            </div>
          </div>
        </div>

        {/* 我的矿机 - 全宽 */}
        <div className="group relative mt-3 block min-h-[72px] rounded-2xl bg-purple-50 p-4 transition-all hover:bg-purple-100">
          <Link href="/miner" className="absolute inset-0 z-0" />
          <div className="pointer-events-none relative z-10 flex items-center justify-between pt-4 pb-4">
            <div className="flex items-center gap-4">
              <Pickaxe size={28} className="text-purple-600" />
              <div className="flex flex-col">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <h3 className="font-bold text-gray-900">{isMe ? "我的" : "Ta的"}矿机</h3>
                  <div className="pointer-events-auto">
                    <InfoDrawer
                      title="矿机收益说明"
                      trigger={
                        <div
                          className="cursor-pointer p-1 text-purple-400/60 transition-colors hover:text-purple-500"
                          aria-label="查看矿机收益说明"
                        >
                          <HelpCircle size={18} />
                        </div>
                      }
                    >
                      <div className="space-y-3">
                        {/* 挖矿权重对比表格 */}
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border-b border-gray-200 px-3 py-2 text-left font-normal text-gray-900">
                                  行为
                                </th>
                                <th className="border-b border-l border-gray-200 px-3 py-2 text-center font-normal text-gray-900">
                                  普通用户
                                </th>
                                <th className="border-b border-l border-gray-200 px-3 py-2 text-center font-semibold text-purple-600">
                                  节点成员
                                </th>
                                <th className="border-b border-l border-gray-200 px-3 py-2 text-center font-semibold text-gray-900">
                                  超级节点
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-normal text-gray-900">浏览</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center font-normal text-gray-900">1</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-purple-600">2</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-gray-900">1 (被浏览)</td>
                              </tr>
                              <tr className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-normal text-gray-900">点赞</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center font-normal text-gray-900">2</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-purple-600">4</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-gray-900">3 (被点赞)</td>
                              </tr>
                              <tr className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-normal text-gray-900">评论</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center font-normal text-gray-900">4</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-purple-600">8</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-gray-900">5 (被评论)</td>
                              </tr>
                              <tr className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-normal text-gray-900">分享</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center font-normal text-gray-900">5</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-purple-600">10</td>
                                <td className="border-l border-gray-200 px-3 py-2 text-center text-gray-900">2 (被分享)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* 说明文字 */}
                        <div className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                          <p className="mb-1">
                            💡 说明：表格中的数字代表获得的<span className="font-bold text-gray-900">挖矿单位数量</span>，由于用户挖矿活跃度的不断变化，<span className="font-bold text-gray-900">相同的挖矿行为在不同时间周期的挖矿收益并不相同</span>。另外，<span className="font-bold text-purple-600">持有权益 NFT 的用户挖矿收益在此基础上再次翻倍</span>。
                          </p>
                          <p>
                            ⏰ 结算周期：每 <span className="font-bold text-gray-900">12 小时</span> 结算一次（12:00 / 00:00 UTC+8）。
                          </p>
                        </div>
                      </div>
                    </InfoDrawer>
                  </div>
                </div>
                <p className="text-xs font-medium text-purple-600">
                  已获收益 {displayMinerRevenue} CMW
                </p>
              </div>
            </div>
            <ChevronRight className="h-6 w-6 flex-shrink-0 text-purple-400" />
          </div>
        </div>
      </div>

      {isMe && isConnected && (
        <div className="mt-16 px-6">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white py-3.5 text-base font-medium text-red-500 shadow-sm transition-colors duration-200 hover:border-transparent hover:bg-red-500 hover:text-white active:scale-95"
          >
            <LogOut size={20} />
            <span>退出登录</span>
          </button>
        </div>
      )}

      {/* Confirmation Drawer for Unfollow */}
      <Drawer.Root open={showUnfollowConfirm} onOpenChange={setShowUnfollowConfirm}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 transition-opacity" />
          <Drawer.Content className="fixed right-0 bottom-0 left-0 z-[60] flex flex-col rounded-t-[20px] bg-white px-6 pb-8 outline-none">
            {/* Handle Bar */}
            <div className="mx-auto mt-4 mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />

            <Drawer.Title className="mb-2 text-center text-lg font-bold text-gray-900">
              确定不再关注 @{user.username} 吗？
            </Drawer.Title>
            <Drawer.Description className="mb-8 text-center text-sm text-gray-500">
              取消关注后，您将不再收到对方的动态推送
            </Drawer.Description>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => executeFollow("unfollow")}
                disabled={loadingFollow}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3.5 text-base font-bold text-white transition-transform active:scale-95 disabled:opacity-70 disabled:active:scale-100"
              >
                {loadingFollow ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    正在取消...
                  </>
                ) : (
                  "确定取消关注"
                )}
              </button>
              <button
                onClick={() => setShowUnfollowConfirm(false)}
                className="w-full rounded-xl bg-gray-100 py-3.5 text-base font-bold text-gray-600 transition-colors hover:bg-gray-200 active:scale-95"
              >
                取消
              </button>
            </div>

            <div className="pb-safe" />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
