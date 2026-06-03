import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import {
  cleanupOrphanUploads,
  deleteOrphanUploadById,
  enqueueAttachmentReferenceScan,
  getAdminAttachmentManagement,
  repairQueuedAttachmentJobs,
} from "@/lib/admin-attachments"
import { getRequestIp } from "@/lib/request-ip"

export const GET = createAdminRouteHandler(async ({ request }) => {
  const searchParams = new URL(request.url).searchParams
  const data = await getAdminAttachmentManagement({
    keyword: searchParams.get("keyword") ?? "",
    bucketType: searchParams.get("bucketType") ?? "ALL",
    referenceStatus: searchParams.get("referenceStatus") ?? "ALL",
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "20"),
  })

  return apiSuccess(data)
}, {
  errorMessage: "获取附件列表失败",
  logPrefix: "[api/admin/attachments:GET] unexpected error",
  unauthorizedMessage: "无权访问附件管理",
})

export const POST = createAdminRouteHandler<unknown>(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = String(body.action ?? "").trim()

  if (action === "start-reference-scan") {
    const result = await enqueueAttachmentReferenceScan({
      bucketType: typeof body.bucketType === "string" ? body.bucketType : "ALL",
      keyword: typeof body.keyword === "string" ? body.keyword : "",
      adminId: adminUser.id,
      ip: getRequestIp(request),
    })

    revalidatePath("/admin")
    return apiSuccess(result, "附件引用深度扫描已进入后台队列")
  }

  if (action === "cleanup-orphans") {
    const result = await cleanupOrphanUploads({
      limit: Number(body.limit ?? 100),
      bucketType: typeof body.bucketType === "string" ? body.bucketType : "ALL",
      keyword: typeof body.keyword === "string" ? body.keyword : "",
      adminId: adminUser.id,
      ip: getRequestIp(request),
    })

    revalidatePath("/admin")
    return apiSuccess(result, "无引用资源清理已进入后台队列")
  }

  if (action === "delete-orphan") {
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : ""
    const result = await deleteOrphanUploadById({
      uploadId,
      adminId: adminUser.id,
      ip: getRequestIp(request),
    })

    revalidatePath("/admin")
    return apiSuccess(result, "无引用资源已删除")
  }

  if (action === "repair-stuck-jobs") {
    const result = await repairQueuedAttachmentJobs({
      adminId: adminUser.id,
      ip: getRequestIp(request),
    })

    revalidatePath("/admin")
    return apiSuccess(result, result.repairedJobs.length > 0 ? "已解除卡住的附件后台任务" : "没有需要解除的附件后台任务")
  }

  const result = await getAdminAttachmentManagement({
    keyword: typeof body.keyword === "string" ? body.keyword : "",
    bucketType: typeof body.bucketType === "string" ? body.bucketType : "ALL",
    referenceStatus: typeof body.referenceStatus === "string" ? body.referenceStatus : "ALL",
    page: Number(body.page ?? "1"),
    pageSize: Number(body.pageSize ?? "20"),
  })

  return apiSuccess(result)
}, {
  errorMessage: "附件管理操作失败",
  logPrefix: "[api/admin/attachments:POST] unexpected error",
  unauthorizedMessage: "无权操作附件管理",
})
