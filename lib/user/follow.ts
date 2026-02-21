import { db } from "@/lib/db";

/**
 * 关注用户
 */
export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new Error("不能关注自己");
  }

  return await db.follow.create({
    data: {
      followerId,
      followingId,
    },
  });
}

/**
 * 取消关注
 */
export async function unfollowUser(followerId: string, followingId: string) {
  return await db.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
}

/**
 * 检查是否已关注
 */
export async function isFollowing(followerId: string, followingId: string) {
  const follow = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
  return !!follow;
}

/**
 * 获取用户信息（包含关注/粉丝数）
 */
export async function getUserWithStats(userId: string) {
  return await db.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          following: true, // 关注数
          followers: true, // 粉丝数
        },
      },
    },
  });
}

/**
 * 获取关注列表
 */
export async function getFollowingList(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            userId: true,
            userName: true,
            avatarUrl: true,
            userBio: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.follow.count({
      where: { followerId: userId },
    }),
  ]);

  return {
    list: list.map((item) => item.following),
    total,
    page,
    pageSize,
  };
}

/**
 * 获取粉丝列表
 */
export async function getFollowersList(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            userId: true,
            userName: true,
            avatarUrl: true,
            userBio: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.follow.count({
      where: { followingId: userId },
    }),
  ]);

  return {
    list: list.map((item) => item.follower),
    total,
    page,
    pageSize,
  };
}
