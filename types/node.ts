export interface NodeData {
  id: string;
  creatorId: string;
  coverImage: string;
  name: string; // e.g. "Node 元宇宙艺术中心"
  author: {
    id: string; // NEW
    avatar: string;
    name: string;
    description: string; // "权益NFT持有者..."
  };
  stats: {
    followers: number;
    members: number;
    contentCount: number;
    outputValue: string; // "2.4k CMW"
  };
  description: string;
  tags: { name: string; color: string }[];
  isJoined?: boolean;
}
