export interface Article {
  id: string;
  title?: string;
  url: string;
  description: string;
  extendedContent?: string;
  parsedContent?: string;
  parsedInfo?: {
    userId: string;
    at: Date | string;
  } | null;
  images: string[];
  author: {
    id: string;
    userId: string;
    name: string;
    avatar: string;
  };
  node: {
    id: string;
    name: string;
  };
  createdAt: Date | string;
  tags: { name: string; color: string }[];
  stats: {
    upVotes: number;
    downVotes?: number;
    comments: number;
    viewCount: number;
    cmwValue?: number;
  };
  userVote?: "LIKE" | "DISLIKE" | null;
}
