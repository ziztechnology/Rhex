import { getCurrentUser } from "@/lib/auth"
import { apiSuccess, createUserRouteHandler, readJsonBody, readOptionalStringField, requireNumberField, requireSearchParam, requireStringField } from "@/lib/api-route"
import { getRssEntrySupportSummary, tipRssEntry } from "@/lib/rss-interactions"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export async function GET(request: Request) {
  const entryId = requireSearchParam(request, "entryId", "缺少内容参数")
  const currentUser = await getCurrentUser()
  const data = await getRssEntrySupportSummary(entryId, currentUser?.id)

  return Response.json(apiSuccess(data))
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const entryId = requireStringField(body, "entryId", "缺少内容参数")
  const amount = requireNumberField(body, "amount", "缺少打赏金额")
  const giftId = readOptionalStringField(body, "giftId") || undefined

  return withRequestWriteGuard(createRequestWriteGuardOptions("rss-entry-tip", {
    request,
    userId: currentUser.id,
    input: {
      entryId,
      amount,
      giftId,
    },
  }), async () => {
    const result = await tipRssEntry({
      entryId,
      senderId: currentUser.id,
      amount,
      giftId,
    })
    const summary = await getRssEntrySupportSummary(entryId, currentUser.id)

    return apiSuccess(summary, result.gift ? `已送出 ${result.gift.name}` : `已成功打赏 ${result.amount} ${result.pointName}`)
  })
}, {
  errorMessage: "RSS 内容打赏失败",
  logPrefix: "[api/rss-universe/tip] unexpected error",
  unauthorizedMessage: "请登录后参与打赏",
  allowStatuses: ["ACTIVE", "MUTED"],
})
