import { prisma } from "@/db/client"
import { findPendingRssSourceApplicationByFeedUrl, findRssSourceByFeedUrl } from "@/db/rss-harvest-queries"
import { apiError } from "@/lib/api-route"
import { createRssSource } from "@/lib/rss-harvest"
import { normalizeHttpUrl } from "@/lib/shared/url"

function normalizeApplicationInput(input: Record<string, unknown>) {
  const siteName = typeof input.siteName === "string" ? input.siteName.trim() : ""
  const description = typeof input.description === "string" ? input.description.trim() : ""
  const rawFeedUrl = typeof input.feedUrl === "string" ? input.feedUrl.trim() : ""
  const feedUrl = normalizeHttpUrl(rawFeedUrl, {
    allowCredentials: false,
    clearHash: true,
  })

  if (!siteName) {
    apiError(400, "博客名称不能为空")
  }

  if (siteName.length > 80) {
    apiError(400, "博客名称不能超过 80 个字符")
  }

  if (description.length > 240) {
    apiError(400, "描述不能超过 240 个字符")
  }

  if (!feedUrl) {
    apiError(400, "RSS 地址格式不正确")
  }

  return {
    siteName,
    description: description || null,
    feedUrl,
  }
}

export async function createRssSourceApplication(input: {
  applicantId: number
  body: Record<string, unknown>
}) {
  const normalized = normalizeApplicationInput(input.body)
  const [existingSource, existingPending] = await Promise.all([
    findRssSourceByFeedUrl(normalized.feedUrl),
    findPendingRssSourceApplicationByFeedUrl(normalized.feedUrl),
  ])

  if (existingSource) {
    apiError(400, "该 RSS 源已经收录")
  }

  if (existingPending) {
    apiError(400, "这个 RSS 源已有待审核申请")
  }

  return prisma.rssSourceApplication.create({
    data: {
      applicantId: input.applicantId,
      siteName: normalized.siteName,
      description: normalized.description,
      feedUrl: normalized.feedUrl,
    },
    select: {
      id: true,
      status: true,
    },
  })
}

export async function approveRssSourceApplication(input: {
  applicationId: string
  reviewerId: number
  reviewNote?: string | null
}) {
  const application = await prisma.rssSourceApplication.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      siteName: true,
      description: true,
      feedUrl: true,
      status: true,
    },
  })

  if (!application) {
    apiError(404, "申请不存在")
  }

  if (application.status !== "PENDING") {
    apiError(400, "该申请已经处理")
  }

  const existingSource = await findRssSourceByFeedUrl(application.feedUrl)
  const source = existingSource ?? await createRssSource({
    siteName: application.siteName,
    description: application.description ?? "",
    feedUrl: application.feedUrl,
    intervalMinutes: 30,
    requiresReview: true,
    enabled: true,
  })

  await prisma.rssSourceApplication.update({
    where: { id: application.id },
    data: {
      status: "APPROVED",
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
      sourceId: source.id,
    },
  })

  return source
}

export async function rejectRssSourceApplication(input: {
  applicationId: string
  reviewerId: number
  reviewNote?: string | null
}) {
  const application = await prisma.rssSourceApplication.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!application) {
    apiError(404, "申请不存在")
  }

  if (application.status !== "PENDING") {
    apiError(400, "该申请已经处理")
  }

  await prisma.rssSourceApplication.update({
    where: { id: application.id },
    data: {
      status: "REJECTED",
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
    },
  })

  return { id: application.id }
}
