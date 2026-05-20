import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { approveRssSourceApplication, rejectRssSourceApplication } from "@/lib/rss-source-applications"
import { getRssSourceApplicationAdminPageData, normalizeSourceApplicationActionInput } from "@/lib/rss-source-application-admin"

export const dynamic = "force-dynamic"

function revalidateApplicationPaths() {
  revalidatePath("/admin")
  revalidatePath("/admin/apps")
  revalidatePath("/admin/apps/rss-harvest")
  revalidatePath("/admin/apps/rss-harvest/applications")
}

export const GET = createAdminRouteHandler<unknown>(async ({ request }) => {
  const url = new URL(request.url)
  const data = await getRssSourceApplicationAdminPageData({
    keyword: url.searchParams.get("keyword") ?? "",
    status: url.searchParams.get("status") ?? "ALL",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "20",
  })

  return apiSuccess(data)
}, {
  errorMessage: "RSS 收录申请加载失败",
  logPrefix: "[api/admin/apps/rss-harvest/applications:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""
  const requestIp = getRequestIp(request)
  const input = normalizeSourceApplicationActionInput(body)

  if (action === "approve-source-application") {
    const source = await approveRssSourceApplication({
      applicationId: input.applicationId,
      reviewerId: adminUser.id,
      reviewNote: input.reviewNote,
    })
    await writeAdminLog(adminUser.id, "rss.source-application.approve", "RSS_SOURCE", source.id, `批准 RSS 源申请 ${source.siteName}`, requestIp)
    revalidateApplicationPaths()
    return apiSuccess(undefined, "申请已通过，RSS 源已创建并启用")
  }

  if (action === "reject-source-application") {
    await rejectRssSourceApplication({
      applicationId: input.applicationId,
      reviewerId: adminUser.id,
      reviewNote: input.reviewNote,
    })
    await writeAdminLog(adminUser.id, "rss.source-application.reject", "RSS_SOURCE", input.applicationId, "拒绝 RSS 源申请", requestIp)
    revalidateApplicationPaths()
    return apiSuccess(undefined, "申请已拒绝")
  }

  return apiSuccess(undefined, "未执行任何变更")
}, {
  errorMessage: "RSS 收录申请操作失败",
  logPrefix: "[api/admin/apps/rss-harvest/applications:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
