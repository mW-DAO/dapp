"use client";

import React from "react";
import {
  ChevronLeft,
  HelpCircle,
  Compass,
  Heart,
  MessageSquare,
  Share2,
  Eye,
  Atom,
  Pickaxe,
} from "lucide-react";
import { InfoDrawer } from "@/components/ui/InfoDrawer";
import { useUserRewardInfo } from "@/hooks/contracts/useMediaReward";
import { useAccount } from "wagmi";

// ... (imports)
import axios from "axios";
// ...

interface StatBreakdown {
  total: string;
  breakdown: Record<string, string>;
}

interface MinerStats {
  createdSuper: StatBreakdown;
  joinedSuper: StatBreakdown;
  normal: StatBreakdown;
}

export default function MinerPage() {
  const { address } = useAccount();
  const { data: rewardData } = useUserRewardInfo(address);
  const revenue = rewardData?.totalEarned || "0";
  
  const [stats, setStats] = React.useState<MinerStats | null>(null);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await axios.get("/api/miner/stats");
        if (data.code === 200) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch miner stats", error);
      }
    };
    fetchStats();
  }, []);

  // Helper to safely get value with precision
  const formatVal = (val?: string) => {
      if (!val) return "0 CMW";
      return `${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} CMW`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
      {/* ... (Header Area) ... */}
      <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 pt-4 pb-32">
        <div className="absolute right-0 bottom-0 left-0 h-24 bg-gradient-to-t from-gray-50 to-transparent" />
      </div>

      <div className="relative z-10 -mt-16 space-y-4 px-4">
        {/* ... (Stats Card) ... */}
        <div className="relative overflow-hidden rounded-3xl bg-[#1a1f2e] p-6 text-white shadow-xl shadow-blue-900/20">
             {/* ... (Existing Stats Card Content, skipping for brevity in replace block if possible, but replace_file_content needs contiguous block) ... */}
             <div className="relative z-10">
            <div className="mb-2 text-xs font-medium text-gray-400">累计已挖矿</div>
            <div className="mb-8 text-4xl font-black tracking-tight">
              {parseFloat(revenue).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}{" "}
              CMW
            </div>
             {/* ... (Buttons) ... */}
            <div className="flex gap-3">
              <button className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95">
                <Compass size={14} />
                链上探索
              </button>

              <InfoDrawer
                title="矿机运作机制"
                trigger={
                  <button className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95">
                    <HelpCircle size={14} />
                    如何运作
                  </button>
                }
              >
                  {/* ... (Info Content) ... */}
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-1 font-bold text-gray-900">什么是 CMW 挖矿？</h4>
                    <p>
                      CMW 是 MetaWorld
                      生态的核心代币。通过持有矿机或参与社区互动（点赞、评论、分享），您可以获得 CMW
                      奖励。
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-1 font-bold text-gray-900">收益构成</h4>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>基础值：根据矿机等级产生的固定产出。</li>
                      <li>互动加成：内容被点赞、评论、浏览等社交行为会触发额外的共识奖励。</li>
                    </ul>
                  </div>
                  <p className="text-xs text-gray-400">数据每 24 小时进行一次结算并更新至链上。</p>
                </div>
              </InfoDrawer>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-30px] rotate-[-15deg] text-white opacity-[0.15]">
            <Pickaxe size={160} strokeWidth={1.5} />
          </div>
        </div>

        {/* List Sections */}
        <div className="space-y-4">
          <Section
            icon={<Atom className="text-blue-500" strokeWidth={2.5} />}
            title="建立的超级节点矿机"
            value={formatVal(stats?.createdSuper.total)}
            stats={stats?.createdSuper.breakdown}
            type="passive"
            highlight
          />

          <Section
            icon={<Atom className="text-indigo-500" strokeWidth={2.5} />}
            title="加入的超级节点矿机"
            value={formatVal(stats?.joinedSuper.total)}
            stats={stats?.joinedSuper.breakdown}
            type="active"
            highlight
          />

          <Section
            icon={<Pickaxe className="text-cyan-500" strokeWidth={2.5} />}
            title="普通矿机"
            value={formatVal(stats?.normal.total)}
            stats={stats?.normal.breakdown}
            type="active"
            highlight
          />
        </div>
      </div>
    </div>
  );
}

// Helper Components
const Section = ({
  icon,
  title,
  value,
  highlight,
  stats,
  type = "active",
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  highlight?: boolean;
  stats?: Record<string, string>;
  type?: "active" | "passive";
}) => {
    // Map API keys (LIKE, VIEW...) to Labels
    // Passive Keys: LIKED, VIEWED...
    // Active Keys: LIKE, VIEW...
    
    // UI Labels
    const labels: Record<string, string> = type === "passive" ? {
        "LIKED": "被点赞",
        "COMMENTED": "被评论",
        "SHARED": "被分享",
        "VIEWED": "被浏览"
    } : {
        "LIKE": "点赞",
        "COMMENT": "评论",
        "SHARE": "分享",
        "VIEW": "浏览"
    };

    // Keys to look for in stats
    const keys = type === "passive" 
       ? ["LIKED", "COMMENTED", "SHARED", "VIEWED"]
       : ["LIKE", "COMMENT", "SHARE", "VIEW"];
       
    const icons = {
        "LIKE": Heart, "LIKED": Heart,
        "COMMENT": MessageSquare, "COMMENTED": MessageSquare,
        "SHARE": Share2, "SHARED": Share2,
        "VIEW": Eye, "VIEWED": Eye,
    };

    return (
      <div className="rounded-2xl border border-gray-100/50 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="mb-4 flex items-center justify-between border-b border-gray-50 pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
            <span className="text-sm font-bold tracking-tight text-gray-800">{title}</span>
          </div>
          <div className="flex flex-col items-end text-xs sm:flex-row sm:items-center sm:gap-1">
            <span className="text-gray-400">已获得</span>
            <span className={`font-bold ${highlight ? "text-blue-600" : "text-gray-800"} text-sm`}>
              {value}
            </span>
          </div>
        </div>
    
        <div className="space-y-3.5">
           {keys.map(key => {
               const val = stats?.[key];
               const numVal = val ? parseFloat(val) : 0;
               const displayVal = numVal > 0 
                   ? `${numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} CMW`
                   : "0 CMW";
               
               // Type of key might not match icons keys exactly if we use strictly typed map, but JS is loose.
               const Icon = icons[key as keyof typeof icons] || Eye;
               
               return (
                  <StatRow 
                    key={key} 
                    icon={Icon} 
                    label={labels[key] || key} 
                    value={displayVal} 
                  />
               );
           })}
        </div>
      </div>
    );
};

const StatRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="group -mx-2 flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-gray-50">
    <div className="flex items-center gap-2 text-gray-400 transition-colors group-hover:text-blue-500">
      <Icon size={14} />
      <span>{label}</span>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-gray-300">已获得 </span>
      <span className="font-bold text-blue-600">{value}</span>
      <ChevronLeft size={12} className="rotate-180 text-gray-300" />
    </div>
  </div>
);
