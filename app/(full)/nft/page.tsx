"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSafeNav } from "@/hooks/useSafeNav";
import { ChevronLeft, HelpCircle, Hammer, QrCode, Copy, Check, Clipboard, X, Inbox } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import {
  useMWNFTState,
  useMWNFTCostCalculator,
  useMintMWNFT,
  useWatchMWNFTMint,
  useUserNFTs,
} from "@/hooks/contracts/useMWNFT";
import { type Address } from "viem";
import { toast } from "sonner";
import { InfoDrawer } from "@/components/ui/InfoDrawer";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer } from "vaul";

export default function NFTPage() {
  const { safeBack } = useSafeNav();
  const searchParams = useSearchParams();
  const targetAddress = searchParams.get("address");

  const { user: currentUser } = useUser();
  const [scrollProgress, setScrollProgress] = useState(0);

  // 1. Context
  const isMe =
    !targetAddress || currentUser?.address?.toLowerCase() === targetAddress?.toLowerCase();

  // 2. State & Hooks
  const {
    global: myGlobal,
    user: myUser,
    isLoading: myLoading,
  } = useMWNFTState(currentUser?.address as Address);
  // 获取 NFT 列表（查看自己时用 currentUser.address，查看别人时用 targetAddress）
  const displayAddress = isMe ? currentUser?.address : targetAddress;
  
  // 用于强制刷新 NFT 列表的 key
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { balance: targetBalance, nfts: targetNFTs, isLoading: targetLoading } = useUserNFTs(
    displayAddress as Address | undefined,
    refreshKey
  );
  const targetBalanceRaw = BigInt(targetBalance || 0);

  const { calculate } = useMWNFTCostCalculator();
  const { mint, isPending: isMinting } = useMintMWNFT();
  const queryClient = useQueryClient();

  // 防抖计时器，用于批量 Mint 时减少刷新次数
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasMintedRef = useRef(false);

  // Watch for mint events and refresh data
  // 只监听当前登录用户的 Mint 事件
  useWatchMWNFTMint(() => {
    // 第一次 Mint 时立即显示 Toast
    if (!hasMintedRef.current) {
      toast.success("🎉 NFT Mint 成功上链！");
      hasMintedRef.current = true;
    }

    // 清除之前的计时器
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // 1 秒后刷新数据（如果 1 秒内有新的 Mint 事件，会重新计时）
    refreshTimerRef.current = setTimeout(() => {
      // Invalidate queries to refresh NFT balance and state
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      // 强制刷新 NFT 列表
      setRefreshKey(prev => prev + 1);
      hasMintedRef.current = false; // 重置标志
      refreshTimerRef.current = null;
    }, 1000); // 1 秒防抖
  });

  // 组件卸载时清除计时器
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // 3. Derived Data
  const displayBalance = isMe
    ? myUser?.balance || 0
    : targetBalanceRaw
      ? Number(targetBalanceRaw)
      : 0;
  const isLoading = isMe ? myLoading : targetLoading;

  // 4. Price & Action
  const [mintAmount, setMintAmount] = useState(1);
  const [inputValue, setInputValue] = useState("1"); // 临时输入值
  const cost = calculate(mintAmount); // { wei, bnb }
  
  // 计算最大配额（useMemo 优化）
  const maxQuota = useMemo(() => myUser?.remainingMintQuota ?? 1, [myUser?.remainingMintQuota]);
  
  // 邀请码弹框
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const inviteCodeNum = parseInt(inviteCode);
  const isValidInviteCode = !isNaN(inviteCodeNum) && inviteCodeNum >= 1 && inviteCodeNum <= 20000;

  const handleMint = async () => {
    if (!currentUser?.address) {
      toast.error("请先登录");
      return;
    }

    if (!myGlobal || !myUser) {
      toast.error("合约数据加载中，请稍后再试");
      return;
    }

    // 显示邀请码弹框
    setShowInviteDialog(true);
  };
  
  // 实际执行 Mint
  const executeMint = async (inviterTokenId: number) => {

    // Safety check: ensure wallet matches account
    // (Optional: if you want to enforce strict account matching)

    // 确保 mintAmount 和 inputValue 有效（防止输入框为空时点击 Mint）
    let validMintAmount = mintAmount;
    
    // 如果 inputValue 为空或 mintAmount 无效，立即修正
    if (inputValue === "" || isNaN(parseInt(inputValue)) || mintAmount <= 0) {
      validMintAmount = 1;
      setMintAmount(1);
      setInputValue("1");
    }

    try {
      // Pass validation state to hook
      await mint(validMintAmount, cost.wei, inviterTokenId, { global: myGlobal, user: myUser });
      toast.success("Mint 交易已提交");
      setShowInviteDialog(false); // 关闭弹框
      setInviteCode(""); // 清空邀请码
    } catch (e: unknown) {
      console.error(e);
      
      // Check if user rejected the transaction
      const errorMessage = e instanceof Error ? e.message : String(e);
      const isUserRejection = 
        errorMessage.includes("User rejected") ||
        errorMessage.includes("User denied") ||
        errorMessage.includes("user rejected") ||
        errorMessage.includes("User cancelled") ||
        errorMessage.includes("Transaction was rejected");
      
      if (isUserRejection) {
        // User cancelled, show a gentle message or just silently ignore
        toast.info("已取消 Mint");
        return;
      }
      
      // Other errors
      const message = e instanceof Error ? e.message : "Mint 失败";
      toast.error(message);
    }
  };

  // 5. Button Logic
  const canInvite = displayBalance > 0;

  const getMintButtonState = () => {
    if (isMinting) return { label: "Minting...", disabled: true };
    if (!myGlobal || !myUser) return { label: "Loading...", disabled: true };

    // Validation checks
    if (!myGlobal.isPublicMintEnabled) return { label: "暂未开启", disabled: true };
    if (myUser.remainingMintQuota <= 0) return { label: "已达上限", disabled: true };
    if (myGlobal.remainingSupply <= 0) return { label: "已售罄", disabled: true };

    // Standard Mint
    const label = Number(cost.bnb) > 0 ? "Mint" : "Mint (Free)";
    return { label, disabled: false };
  };

  const mintBtnState = getMintButtonState();

  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(window.scrollY / 100, 1);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerBgOpacity = scrollProgress;
  const headerTextColor = scrollProgress > 0.6 ? "text-gray-900" : "text-white";

  return (
    <div className="relative min-h-screen bg-gray-50 pb-32">
      {/* Fixed Header */}
      <div
        className="fixed top-0 right-0 left-0 z-50 flex items-center px-5 py-4 transition-colors duration-200"
        style={{
          backgroundColor:
            scrollProgress > 0 ? `rgba(255, 255, 255, ${headerBgOpacity})` : "transparent",
        }}
      >
        <button
          onClick={() => safeBack()}
          className={`flex items-center gap-2 ${headerTextColor} transition-all hover:opacity-80 active:scale-95`}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          <span className="text-base font-medium">权益NFT</span>
        </button>
      </div>

      {/* Hero / Banner Area */}
      <div className="h-64 bg-gradient-to-b from-[#3B71FE] via-[#3B71FE] to-transparent px-6 pt-20">
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-[#1D212B] p-6 shadow-2xl">
          <div className="pointer-events-none absolute -right-4 -bottom-4 h-40 w-40 rotate-[10deg] opacity-10">
            <svg viewBox="0 0 100 100" fill="none" className="h-full w-full">
              <path
                d="M15 75 Q 50 85 85 75 L 90 40 L 65 55 L 50 20 L 35 55 L 10 40 Z"
                stroke="white"
                strokeWidth="1.2"
                fill="white"
                fillOpacity="0.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="mb-2 text-[11px] font-medium text-white/50">
              {isMe ? "我的权益NFT" : "Ta的权益NFT"}
            </div>
            <div className="mb-6 text-[28px] font-bold text-white">
              {isLoading ? "加载中..." : `已拥有${displayBalance}枚`}
            </div>

            <div className="flex gap-3">
              <button className="rounded-full border border-white/5 bg-white/10 px-5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white/20">
                链上探索
              </button>
              <button className="rounded-full border border-white/5 bg-white/10 px-6 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white/20">
                用途
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - NFT List */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 mt-4">
        {targetLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-400">加载中...</div>
          </div>
        ) : targetNFTs && targetNFTs.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {targetNFTs.map((nft) => (
                <NFTCard key={nft.tokenId} nft={nft} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
              <Inbox className="h-10 w-10 text-gray-400" />
            </div>
            <div className="text-sm text-gray-400">暂无 NFT</div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed right-0 bottom-0 left-0 z-40 bg-white px-6 pt-4 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <InfoDrawer
            title="什么是铸造 (Mint)"
            trigger={
              <button className="flex items-center gap-1.5 text-blue-500/80 transition-colors hover:text-blue-600">
                <HelpCircle size={16} />
                <span className="text-xs font-medium">什么是铸造</span>
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <h4 className="mb-1 font-bold text-gray-900">权益 NFT 铸造说明</h4>
                <p>
                  铸造（Mint）是将 m&w 权益凭证正式记录在区块链上的过程。持有权益 NFT
                  是参与超级节点建设、获取节点收益的必要条件。
                </p>
              </div>
              <div>
                <h4 className="mb-1 font-bold text-gray-900">铸造规则</h4>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    消耗：根据当前全网热度，铸造可能需要支付一定数量的 BNB（作为 Gas 费或协议费）。
                  </li>
                  <li>配额：每个账户初始可铸造数量有限，通过参与生态活动可提升配额。</li>
                </ul>
              </div>
            </div>
          </InfoDrawer>

          <InfoDrawer
            title="邀请码的用途"
            trigger={
              <button className="flex items-center gap-1.5 text-blue-500/80 transition-colors hover:text-blue-600">
                <HelpCircle size={16} />
                <span className="text-xs font-medium">邀请码的用途</span>
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <h4 className="mb-1 font-bold text-gray-900">建立连接与奖励</h4>
                <p>
                  邀请码是 MetaWorld
                  裂变增长的核心机制。当他人使用您的邀请码登录或参与节点建设时，您将获得共识奖励加成。
                </p>
              </div>
              <div>
                <h4 className="mb-1 font-bold text-gray-900">主要功能</h4>
                <ul className="list-disc space-y-1 pl-4">
                  <li>绑定关系：通过邀请码建立推荐关系。</li>
                  <li>收益加成：邀请更多活跃用户可提升您的挖矿效率（CMW 产出）。</li>
                </ul>
              </div>
              <p className="text-xs text-gray-400">建立关系后不可更改，请确保邀请关系的真实性。</p>
            </div>
          </InfoDrawer>
        </div>


        {/* Bottom Actions */}
        <div className="flex gap-4">
          {/* Left: Mint Button */}
          <button
            onClick={handleMint}
            disabled={mintBtnState.disabled}
            className={`flex h-[52px] flex-1 items-center justify-center gap-1 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
              !mintBtnState.disabled
                ? "bg-[#3B71FE] shadow-blue-100"
                : "cursor-not-allowed bg-gray-300"
            }`}
          >
            <Hammer size={20} className="stroke-[2.5px]" />
            <span className="text-base">{mintBtnState.label}</span>
          </button>

          {/* Right: Amount Selector + Price */}
          <div className={`flex h-[52px] flex-col ${cost.bnb !== "0" ? "justify-between" : "justify-center"}`}>
            {/* Amount Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newValue = Math.max(1, mintAmount - 1);
                  setMintAmount(newValue);
                  setInputValue(String(newValue));
                }}
                disabled={mintAmount <= 1 || mintBtnState.disabled}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-all hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-lg font-bold">−</span>
              </button>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value); // 允许任何输入（包括空值）
                  
                  // 如果是有效数字，立即更新 mintAmount 并限制范围
                  const numValue = parseInt(value);
                  
                  if (!isNaN(numValue) && numValue >= 1) {
                    const clampedValue = Math.min(maxQuota, numValue);
                    setMintAmount(clampedValue);
                    // 如果超出最大值，立即修正输入框
                    if (numValue > maxQuota) {
                      setInputValue(String(clampedValue));
                    }
                  } else {
                    // 输入为空或无效时，设为 0（标记为无效状态）
                    setMintAmount(0);
                  }
                }}
                onBlur={() => {
                  // 失去焦点时，确保有效值
                  const numValue = parseInt(inputValue);
                  
                  if (isNaN(numValue) || numValue < 1) {
                    setMintAmount(1);
                    setInputValue("1");
                  } else {
                    // 确保在有效范围内
                    const finalValue = Math.min(maxQuota, numValue);
                    setMintAmount(finalValue);
                    setInputValue(String(finalValue));
                  }
                }}
                disabled={mintBtnState.disabled}
                className="h-8 w-12 rounded-lg border border-gray-200 text-center text-base font-bold text-gray-900 focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                min="1"
                max={maxQuota}
              />
              <button
                onClick={() => {
                  const newValue = Math.min(maxQuota, mintAmount + 1);
                  setMintAmount(newValue);
                  setInputValue(String(newValue));
                }}
                disabled={mintAmount >= maxQuota || mintBtnState.disabled}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-all hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-lg font-bold">+</span>
              </button>
            </div>

            {/* Price */}
            {cost.bnb !== "0" && (
              <div className="text-center">
                <p className="text-xs font-medium text-gray-900">{cost.bnb} BNB</p>
              </div>
            )}
          </div>

          {/* 
          <button
            disabled={!canInvite}
            className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 font-bold transition-all active:scale-[0.98] ${
              canInvite
                ? "border-[#3B71FE] bg-white text-[#3B71FE]"
                : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            <QrCode size={20} className="stroke-[2.5px]" />
            <span className="text-base">复制邀请码</span>
          </button> */}
          
        </div>
      </div>
      
      {/* 邀请码输入弹框 - 使用 Drawer */}
      <Drawer.Root open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Drawer.Content className="fixed right-0 bottom-0 left-0 z-[60] flex max-h-[85vh] flex-col rounded-t-3xl bg-white outline-none">
            {/* 关闭按钮 - 右上角 */}
            <button
              onClick={() => {
                setShowInviteDialog(false);
                setInviteCode("");
              }}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-95"
            >
              <X size={20} />
            </button>
            
            {/* 顶部指示条 */}
            <div className="mx-auto mt-4 mb-2 h-1 w-12 flex-shrink-0 rounded-full bg-gray-300" />
            
            {/* 标题 */}
            <div className="px-6 pb-2">
              <Drawer.Title className="text-center text-lg font-bold text-gray-900">
                输入邀请码 (可选)
              </Drawer.Title>
            </div>
            
            {/* 内容区域 */}
            <div className="px-6 pb-8">
              {/* 输入框 + 粘贴按钮 */}
              <div className="relative mb-2">
                <input
                  type="number"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="请输入邀请码"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-center text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  min="1"
                  max="20000"
                />
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        setInviteCode(text.trim());
                        toast.success("已粘贴");
                      } else {
                        toast.error("剪贴板为空");
                      }
                    } catch (err) {
                      console.error("粘贴失败:", err);
                      toast.error("粘贴失败，请手动输入或授权剪贴板权限");
                    }
                  }}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-700 active:scale-95"
                  title="粘贴"
                >
                  <Clipboard size={18} />
                </button>
              </div>
              
              {/* 提示文字 */}
              <p className="mb-6 text-center text-xs text-gray-500">
                有效范围: 1 - 20000
              </p>
              
              {/* 确认按钮 */}
              <button
                onClick={() => {
                  setShowInviteDialog(false);
                  const finalCode = isValidInviteCode ? inviteCodeNum : 0;
                  setInviteCode("");
                  executeMint(finalCode);
                }}
                className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white transition-all hover:bg-blue-600 active:scale-[0.98]"
              >
                {isValidInviteCode ? `使用邀请码 ${inviteCode}` : "跳过"}
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

// NFT Card Component
function NFTCard({ nft }: { nft: { tokenId: string; tokenIdBigInt: bigint; ipfsURL?: string } }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(nft.tokenId);
    setCopied(true);
    toast.success(`已复制 ${nft.tokenId}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 p-2 shadow-sm transition-all hover:shadow-md">
      {/* NFT Image */}
      <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-white">
        {nft.ipfsURL ? (
          <img
            src={nft.ipfsURL}
            alt={`NFT #${nft.tokenId}`}
            className="h-full w-full object-contain transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'%3ENFT%3C/text%3E%3C/svg%3E";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <Hammer size={32} />
          </div>
        )}
      </div>

      {/* NFT Info */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500">Token ID</p>
          <p className="text-sm font-bold text-gray-900">#{nft.tokenId}</p>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-gray-600 shadow-sm transition-all hover:bg-white hover:text-blue-500 hover:shadow active:scale-95"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}
