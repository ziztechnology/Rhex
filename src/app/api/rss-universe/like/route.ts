import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { toggleRssEntryLike } from "@/lib/rss-interactions"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const entryId = requireStringField(body, "entryId", "缺少内容参数")

  return withRequestWriteGuard(createRequestWriteGuardOptions("rss-entry-like", {
    request,
    userId: currentUser.id,
    input: { entryId },
  }), async () => {
    const result = await toggleRssEntryLike({
      entryId,
      userId: currentUser.id,
    })

    return apiSuccess(result, result.liked ? "点赞成功" : "已取消点赞")
  })
}, {
  errorMessage: "RSS 内容点赞失败",
  logPrefix: "[api/rss-universe/like] unexpected error",
  unauthorizedMessage: "请先登录后再点赞",
  allowStatuses: ["ACTIVE", "MUTED"],
})
