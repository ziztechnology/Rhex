import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { toggleGodCommentByAdmin } from "@/lib/god-comments"
import { ensureCanManageComment } from "@/lib/moderator-permissions"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const commentId = requireStringField(body, "commentId", "缺少必要参数")
  const action = body.action === "unmark" ? "unmark" : "mark"
  const comment = await ensureCanManageComment(adminUser, commentId)

  if (comment.parentId) {
    apiError(400, "仅支持将一级评论设为神评")
  }

  const result = await toggleGodCommentByAdmin({
    commentId,
    adminUserId: adminUser.id,
    action,
  })

  return apiSuccess({
    commentId,
    changed: result.changed,
    isGodComment: result.isGodComment,
  }, action === "mark" ? "评论已设为神评" : "已取消神评")
}, {
  errorMessage: "神评操作失败",
  logPrefix: "[api/posts/god-comment] unexpected error",
  unauthorizedMessage: "无权操作神评",
  allowModerator: true,
})
