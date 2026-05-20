import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import {
  clearRssLogsHistory,
  clearRssRunHistoryRecords,
  clearRssSourceQueueHistory,
  clearRssSourceRunHistory,
  createRssSource,
  enqueueRssSourceRunNow,
  getRssAdminData,
  getRssRecentLogPage,
  getRssRecentRunPage,
  getRssSourceQueuePage,
  getRssSourceRunPage,
  repairRssSchedulerJob,
  saveRssSettings,
  startRssSource,
  stopRssSource,
  testRssSourceConnection,
  updateRssSource,
} from "@/lib/rss-harvest"
import { approveRssSourceApplication, rejectRssSourceApplication } from "@/lib/rss-source-applications"

export const dynamic = "force-dynamic"

function revalidateRssAdminPaths(options?: {
  includeAppsIndex?: boolean
  includeWorkerPage?: boolean
}) {
  if (options?.includeAppsIndex) {
    revalidatePath("/admin/apps")
  }

  revalidatePath("/admin/apps/rss-harvest")

  if (options?.includeWorkerPage) {
    revalidatePath("/admin/apps/worker")
  }
}

export const GET = createAdminRouteHandler<unknown>(async ({ request }) => {
  const url = new URL(request.url)
  const view = url.searchParams.get("view")?.trim() ?? "overview"
  const pageValue = Number(url.searchParams.get("page") ?? "1")
  const sourceId = url.searchParams.get("sourceId")?.trim() ?? ""

  if (view === "source-queue") {
    const data = await getRssSourceQueuePage(sourceId, { page: pageValue })
    return apiSuccess(data)
  }

  if (view === "source-runs") {
    const data = await getRssSourceRunPage(sourceId, { page: pageValue })
    return apiSuccess(data)
  }

  if (view === "recent-runs") {
    const data = await getRssRecentRunPage({ page: pageValue })
    return apiSuccess(data)
  }

  if (view === "recent-logs") {
    const data = await getRssRecentLogPage({ page: pageValue })
    return apiSuccess(data)
  }

  const data = await getRssAdminData({
    sourcePage: Number(url.searchParams.get("sourcePage") ?? "1"),
    recentRunsPage: Number(url.searchParams.get("recentRunsPage") ?? "1"),
    recentLogsPage: Number(url.searchParams.get("recentLogsPage") ?? "1"),
  })
  return apiSuccess(data)
}, {
  errorMessage: "RSS 抓取后台数据加载失败",
  logPrefix: "[api/admin/apps/rss-harvest:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler<unknown>(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""
  const requestIp = getRequestIp(request)

  if (action === "save-settings") {
    await saveRssSettings(body.settings && typeof body.settings === "object" ? body.settings as Record<string, unknown> : {})
    await writeAdminLog(adminUser.id, "rss.settings.update", "RSS_SETTING", "global", "管理员更新了 RSS 抓取调度配置", requestIp)
    revalidateRssAdminPaths({
      includeAppsIndex: true,
    })
    return apiSuccess(undefined, "调度配置已保存")
  }

  if (action === "create-source") {
    const created = await createRssSource(body.source && typeof body.source === "object" ? body.source as Record<string, unknown> : {})
    await writeAdminLog(adminUser.id, "rss.source.create", "RSS_SOURCE", created.id, `创建 RSS 任务 ${created.siteName}`, requestIp)
    revalidateRssAdminPaths({
      includeAppsIndex: true,
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, "RSS 任务已创建")
  }

  if (action === "test-source") {
    const result = await testRssSourceConnection(body.source && typeof body.source === "object" ? body.source as Record<string, unknown> : {})
    await writeAdminLog(adminUser.id, "rss.source.test", "RSS_SOURCE", "preview", `测试 RSS 地址 ${result.feedUrl}`, requestIp)
    return apiSuccess(result, result.message)
  }

  if (action === "update-source") {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
    const updated = await updateRssSource(sourceId, body.source && typeof body.source === "object" ? body.source as Record<string, unknown> : {})
    await writeAdminLog(adminUser.id, "rss.source.update", "RSS_SOURCE", updated.id, `更新 RSS 任务 ${updated.siteName}`, requestIp)
    revalidateRssAdminPaths({
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, "RSS 任务已更新")
  }

  if (action === "start-source") {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
    const source = await startRssSource(sourceId)
    await writeAdminLog(adminUser.id, "rss.source.start", "RSS_SOURCE", source.id, `启动 RSS 任务 ${source.siteName}`, requestIp)
    revalidateRssAdminPaths({
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, "RSS 任务已启动")
  }

  if (action === "stop-source") {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
    await stopRssSource(sourceId)
    await writeAdminLog(adminUser.id, "rss.source.stop", "RSS_SOURCE", sourceId, "停止 RSS 任务并取消待执行 Redis 队列快照", requestIp)
    revalidateRssAdminPaths({
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, "RSS 任务已停止")
  }

  if (action === "run-source") {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
    const result = await enqueueRssSourceRunNow(sourceId)
    await writeAdminLog(adminUser.id, "rss.source.run-now", "RSS_SOURCE", sourceId, "手动触发 RSS 抓取任务", requestIp)
    revalidateRssAdminPaths({
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, result.message)
  }

  if (action === "approve-source-application") {
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : ""
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : ""
    const source = await approveRssSourceApplication({
      applicationId,
      reviewerId: adminUser.id,
      reviewNote,
    })
    await writeAdminLog(adminUser.id, "rss.source-application.approve", "RSS_SOURCE", source.id, `批准 RSS 源申请 ${source.siteName}`, requestIp)
    revalidateRssAdminPaths({
      includeAppsIndex: true,
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, "申请已通过，RSS 源已创建并启用")
  }

  if (action === "reject-source-application") {
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : ""
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : ""
    await rejectRssSourceApplication({
      applicationId,
      reviewerId: adminUser.id,
      reviewNote,
    })
    await writeAdminLog(adminUser.id, "rss.source-application.reject", "RSS_SOURCE", applicationId, "拒绝 RSS 源申请", requestIp)
    revalidateRssAdminPaths()
    return apiSuccess(undefined, "申请已拒绝")
  }

  if (action === "repair-scheduler") {
    const result = await repairRssSchedulerJob()
    await writeAdminLog(adminUser.id, "rss.scheduler.repair", "RSS_SETTING", "global", result.message, requestIp)
    revalidateRssAdminPaths({
      includeWorkerPage: true,
    })
    return apiSuccess(undefined, result.message)
  }

  if (action === "clear-logs") {
    const result = await clearRssLogsHistory()
    await writeAdminLog(adminUser.id, "rss.logs.clear", "RSS_LOG", "global", `清空 RSS Redis 短期日志 ${result.count} 条`, requestIp)
    revalidateRssAdminPaths()
    return apiSuccess(undefined, result.count > 0 ? `已清空 ${result.count} 条日志` : "暂无日志可清空")
  }

  if (action === "clear-source-queue") {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
    const result = await clearRssSourceQueueHistory(sourceId)
    await writeAdminLog(adminUser.id, "rss.source.queue.clear", "RSS_SOURCE", sourceId, `清空 RSS Redis 队列快照 ${result.sourceName} ${result.count} 条`, requestIp)
    revalidateRssAdminPaths()
    return apiSuccess(undefined, result.count > 0 ? `已清空 ${result.count} 条队列快照` : "暂无已完成的队列快照可清空")
  }

  if (action === "clear-source-runs") {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
    const result = await clearRssSourceRunHistory(sourceId)
    await writeAdminLog(adminUser.id, "rss.source.runs.clear", "RSS_SOURCE", sourceId, `清空 RSS 执行记录 ${result.sourceName} ${result.count} 条`, requestIp)
    revalidateRssAdminPaths()
    return apiSuccess(undefined, result.count > 0 ? `已清空 ${result.count} 条执行记录` : "暂无已完成的执行记录可清空")
  }

  if (action === "clear-runs") {
    const result = await clearRssRunHistoryRecords()
    await writeAdminLog(adminUser.id, "rss.runs.clear", "RSS_RUN", "global", `清空 RSS 全局执行记录 ${result.count} 条`, requestIp)
    revalidateRssAdminPaths()
    return apiSuccess(undefined, result.count > 0 ? `已清空 ${result.count} 条全局执行记录` : "暂无已完成的执行记录可清空")
  }

  const data = await getRssAdminData()
  return apiSuccess(data, "未执行任何变更")
}, {
  errorMessage: "RSS 抓取后台操作失败",
  logPrefix: "[api/admin/apps/rss-harvest:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
