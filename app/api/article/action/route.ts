import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, apiError, unauthorized, badRequest } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { VoteType, NotificationType } from "@prisma/client";
import { requireActiveUser } from "@/lib/auth/permissions";
import { verifySignatureAndLog } from "@/lib/auth/signature";
import { ACTION_LIKE, ACTION_DISLIKE, ACTION_SHARE, ARTICLE_ACTIONS } from "@/lib/constants/actions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    // 检查用户状态（是否被封禁）
    const user = await requireActiveUser(session.address);

    // action: 'LIKE' | 'DISLIKE' | 'VIEW' | 'SHARE' etc.
    // signature & nonce are required for critical actions
    const { articleId, action, signature, nonce } = await req.json();

    if (!articleId || !action) {
      return badRequest("Invalid parameters");
    }

    // Unified handling for all ARTICLE_ACTIONS (LIKE, DISLIKE, SHARE, VIEW, COMMENT)
    if (ARTICLE_ACTIONS.includes(action)) {
      // 🛡️ Security Check: Verify EIP-712 Signature
      // For VIEW actions, we might skip signature if it's just a pixel tracking (but for rewards, we need it)
      // Assuming all rewarding actions need signature
      if (!signature || !nonce) {
        return badRequest("Missing signature or nonce");
      }

      // Verify and Log Action (This records the audit trail & reward basis)
      await verifySignatureAndLog({
        userAddress: session.address,
        userId: user.id,
        action: action,
        targetId: articleId,
        nonce: nonce,
        signature: signature,
      });

      // --- Business Logic for STATE Modifications (Vote) ---
      if (action === ACTION_LIKE || action === ACTION_DISLIKE) {
        const voteType = action as VoteType;
        
        // ... (existing vote transaction logic) ...
        const existingVote = await db.articleVote.findUnique({
          where: {
            userId_articleId: {
              userId: user.id,
              articleId,
            },
          },
        });
  
        let newStats;
  
        await db.$transaction(async (tx) => {
          // 2. Handle vote logic
          if (existingVote) {
            if (existingVote.voteType === voteType) {
              // Cancel vote
              await tx.articleVote.delete({
                where: { id: existingVote.id },
              });
  
              // Remove notification if exists
              await tx.notification.deleteMany({
                where: {
                  triggerUserId: user.id,
                  articleId: articleId,
                  type:
                    existingVote.voteType === "LIKE"
                      ? NotificationType.ARTICLE_LIKE
                      : NotificationType.ARTICLE_DISLIKE,
                },
              });
            } else {
              // Change vote
              await tx.articleVote.update({
                where: { id: existingVote.id },
                data: { voteType },
              });
            }
          } else {
            // Create new vote
            await tx.articleVote.create({
              data: {
                userId: user.id,
                articleId,
                voteType,
              },
            });
  
            // 3. Create Notification
            const article = await tx.article.findUnique({
              where: { id: articleId },
              select: { authorId: true, title: true, description: true },
            });
  
            if (article) {
              // Temporary: Always notify if article exists
              await tx.notification.create({
                data: {
                  userId: article.authorId,
                  triggerUserId: user.id,
                  type:
                    voteType === "LIKE"
                      ? NotificationType.ARTICLE_LIKE
                      : NotificationType.ARTICLE_DISLIKE,
                  articleId: articleId,
                  title: article.title,
                  content: article.description?.slice(0, 50),
                },
              });
            }
          }
  
          // 4. Recalculate stats
          const upVotes = await tx.articleVote.count({
            where: { articleId, voteType: "LIKE" },
          });
  
          const downVotes = await tx.articleVote.count({
            where: { articleId, voteType: "DISLIKE" },
          });
  
          newStats = { upVotes, downVotes };
        });
  
        return success(newStats);
      }
      
      // --- Business Logic for SHARE ---
      if (action === ACTION_SHARE) {
         // Share logic (e.g. increase share count if article model has it, or just return success)
         // Currently Article model doesn't have shearCount, but we might want to return something?
         return success({ message: "Share recorded" });
      }

      // --- Business Logic for VIEW/COMMENT (Handled elsewhere or just logged) ---
      return success({ message: "Action recorded" });
    }

    return badRequest("Unknown action type");
  } catch (error) {
    console.error("[Action API] Error:", error);
    return apiError("Action failed");
  }
}
