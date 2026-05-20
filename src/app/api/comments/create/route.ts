import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { executeCommentCreation } from "@/lib/comment-create-execution"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const result = await executeCommentCreation(body, {
    request,
    author: {
      id: currentUser.id,
      username: currentUser.username,
      nickname: currentUser.nickname,
      status: currentUser.status,
    },
    log: {
      scope: "comments-create",
      action: "create-comment",
    },
  })

  return apiSuccess({
    id: result.created.id,
    reviewRequired: result.reviewRequired,
    navigation: {
      page: result.targetPage,
      sort: "oldest",
      view: result.commentView,
      anchor: `comment-${result.created.id}`,
    },
  }, result.reviewRequired
    ? "当前节点开启回帖审核，回复已进入审核"
    : `${result.privateRecipientName ? `已发送私密回复给 ${result.privateRecipientName}` : result.normalizedReplyToUserName ? `已回复 @${result.normalizedReplyToUserName}` : "回复成功"}${result.contentAdjusted ? "，部分内容已自动替换" : ""}`)
}, {
  errorMessage: "评论失败",
  logPrefix: "[api/comments/create] unexpected error",
  unauthorizedMessage: "请先登录后再评论",
  allowStatuses: ["ACTIVE"],
  forbiddenMessages: {
    MUTED: "账号已被禁言，暂不可回复",
    BANNED: "账号已被拉黑，无法回复",
  },
})
