export interface User {
  id: string;
  username: string;
  userId: string; // 显示的用户 ID，如 "mw_992834"
  avatar: string;
  address: string;
  bio?: string;
  followingCount: number;
  followersCount: number;
  articleCount?: number;
  cmwBalance: string; // 使用 string 避免 BigInt 序列化问题
  nftCount: number;
  nodeCount: number;
  joinedNodeCount: number;
  minerRevenue: string;
  isFollowing?: boolean; // 当前用户是否关注了这个用户
}
