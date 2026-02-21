import { db } from "@/lib/db";
import redis from "@/lib/redis";
import { verifyActionSignature } from "./eip712";

// 临时 Nonce 数据结构 (Redis)
interface NonceData {
  userId: string;
  action: string;
  targetId: string;
  deadline: number;
}

/**
 * 创建签名 Nonce (Create Signature Nonce)
 * 1. 生成 Nonce
 * 2. 存入 Redis (TTL 2 Mins)
 */
export async function createSignatureNonce(userId: string, action: string, targetId: string) {
  if (!redis) throw new Error("Redis client not initialized");

  const nonce = crypto.randomUUID();
  
  // 有效期 2 分钟 (Redis TTL)
  const ttlSeconds = 120; 
  const deadlineDate = new Date(Date.now() + ttlSeconds * 1000);
  const deadlineRef = Math.floor(deadlineDate.getTime() / 1000);

  const data: NonceData = {
    userId,
    action,
    targetId,
    deadline: deadlineRef,
  };

  //存入 Redis: key = "nonce:{nonce}"
  await redis.set(`nonce:${nonce}`, JSON.stringify(data), { ex: ttlSeconds });

  return {
    nonce,
    deadline: deadlineRef,
  };
}

/**
 * 验证签名并记录日志 (Verify & Log)
 * 1. 从 Redis 读取 Nonce
 * 2. 校验签名
 * 3. 删除 Redis Key (防重放)
 * 4. 写入数据库 UserActionRecord (审计与奖励追踪)
 * 
 * @param extraData 可选参数，用于补充 targetType 等元数据
 */
import { ARTICLE_ACTIONS, NODE_ACTIONS } from "@/lib/constants/actions";

export async function verifySignatureAndLog({
  userAddress,
  userId,
  action,
  targetId,
  nonce,
  signature,
}: {
  userAddress: string;
  userId: string;
  action: string;
  targetId: string;
  nonce: string;
  signature: string;
}) {
  if (!redis) throw new Error("Redis client not initialized");

  const key = `nonce:${nonce}`;
  
  // 1. 从 Redis获取 Nonce
  const storedDataStr = await redis.get<string>(key);
  
  if (!storedDataStr) {
    throw new Error("Nonce invalid or expired");
  }

  // Handle object or string response from redis client
  const storedNonce: NonceData = typeof storedDataStr === 'string' 
    ? JSON.parse(storedDataStr) 
    : storedDataStr;

  // 2. 校验参数匹配 (防止签名移花接木)
  if (storedNonce.userId !== userId) throw new Error("User mismatch");
  if (storedNonce.action !== action) throw new Error("Action mismatch");
  if (storedNonce.targetId !== targetId) throw new Error("Target mismatch");
  
  // 3. EIP-712 签名校验
  const isValid = await verifyActionSignature({
    userAddress,
    action,
    targetId,
    nonce,
    deadline: storedNonce.deadline,
    signature,
  });

  if (!isValid) {
    throw new Error("Signature verification failed");
  }

  // 4. ✅ 验证通过：删除 Redis Key (Prevent Replay)
  await redis.del(key);

  // 5. 📝 操作日志：永久写入数据库 (UserActionRecord)
  // 智能推断：根据 action 判断 targetId 的类型
  let articleId: string | undefined = undefined;
  let nodeId: string | undefined = undefined;

  // Article Action Types
  if (ARTICLE_ACTIONS.includes(action)) {
     articleId = targetId;
     // Retrieve nodeId from Article
     const article = await db.article.findUnique({
        where: { id: articleId },
        select: { nodeId: true }
     });
     if (article) {
        nodeId = article.nodeId;
     }
  }
  // Node Action Types (Expand as needed)
  else if (NODE_ACTIONS.includes(action)) {
     nodeId = targetId;
  }

  await db.userActionRecord.create({
    data: {
      userId,
      action,
      targetId,     // 通用 ID
      articleId,    // 关联文章
      nodeId,       // 关联节点
      nonce,
      // createdAt, updatedAt 自动生成
    },
  });

  return true;
}
