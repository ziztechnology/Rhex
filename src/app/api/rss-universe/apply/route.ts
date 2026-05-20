import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { createRssSourceApplication } from "@/lib/rss-source-applications"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const feedUrl = typeof body.feedUrl === "string" ? body.feedUrl.trim() : ""

  return withRequestWriteGuard(createRequestWriteGuardOptions("rss-source-application-create", {
    request,
    userId: currentUser.id,
    input: { feedUrl },
  }), async () => {
    const result = await createRssSourceApplication({
      applicantId: currentUser.id,
      body,
    })

    return apiSuccess(result, "申请已提交，等待后台审核")
  })
}, {
  errorMessage: "RSS 源申请提交失败",
  logPrefix: "[api/rss-universe/apply] unexpected error",
  unauthorizedMessage: "请登录后提交 RSS 源",
  allowStatuses: ["ACTIVE", "MUTED"],
})
