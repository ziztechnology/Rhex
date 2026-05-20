import { prisma } from "@/db/client"
import { resolvePagination } from "@/db/helpers"
import { RssSourceApplicationStatus, type Prisma } from "@/db/types"
import { apiError } from "@/lib/api-route"
import { normalizePageSize, normalizePositiveInteger, normalizeText, normalizeTrimmedText } from "@/lib/shared/normalizers"

const RSS_SOURCE_APPLICATION_PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const RSS_SOURCE_APPLICATION_DEFAULT_PAGE_SIZE = 20

export interface RssSourceApplicationAdminListItem {
  id: string
  applicantId: number
  applicantName: string
  applicantAvatarPath: string | null
  siteName: string
  description: string | null
  feedUrl: string
  status: string
  reviewNote: string | null
  reviewerName: string | null
  reviewedAt: string | null
  sourceId: string | null
  createdAt: string
  updatedAt: string
}

export interface RssSourceApplicationAdminPageData {
  applications: RssSourceApplicationAdminListItem[]
  filters: {
    keyword: string
    status: string
  }
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface RssSourceApplicationAdminQuery {
  keyword?: unknown
  status?: unknown
  page?: unknown
  pageSize?: unknown
}

function normalizeApplicationStatus(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  return normalized === "APPROVED" || normalized === "REJECTED" || normalized === "PENDING" ? normalized : "ALL"
}

function buildWhereInput(query: {
  keyword: string
  status: string
}): Prisma.RssSourceApplicationWhereInput {
  const and: Prisma.RssSourceApplicationWhereInput[] = []

  if (query.status !== "ALL") {
    and.push({ status: query.status as RssSourceApplicationStatus })
  }

  if (query.keyword) {
    and.push({
      OR: [
        { siteName: { contains: query.keyword, mode: "insensitive" } },
        { description: { contains: query.keyword, mode: "insensitive" } },
        { feedUrl: { contains: query.keyword, mode: "insensitive" } },
        { applicant: { username: { contains: query.keyword, mode: "insensitive" } } },
        { applicant: { nickname: { contains: query.keyword, mode: "insensitive" } } },
      ],
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

function mapApplicationItem(record: Awaited<ReturnType<typeof listApplicationsPage>>[number]): RssSourceApplicationAdminListItem {
  return {
    id: record.id,
    applicantId: record.applicantId,
    applicantName: record.applicant.nickname ?? record.applicant.username,
    applicantAvatarPath: record.applicant.avatarPath ?? null,
    siteName: record.siteName,
    description: record.description ?? null,
    feedUrl: record.feedUrl,
    status: record.status,
    reviewNote: record.reviewNote ?? null,
    reviewerName: record.reviewer ? (record.reviewer.nickname ?? record.reviewer.username) : null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    sourceId: record.sourceId ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function countApplications(where: Prisma.RssSourceApplicationWhereInput) {
  return prisma.rssSourceApplication.count({ where })
}

function countApplicationsByStatus(where: Prisma.RssSourceApplicationWhereInput, status: RssSourceApplicationStatus) {
  return prisma.rssSourceApplication.count({
    where: {
      AND: [
        where,
        { status },
      ],
    },
  })
}

function listApplicationsPage(where: Prisma.RssSourceApplicationWhereInput, skip: number, take: number) {
  return prisma.rssSourceApplication.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take,
    select: {
      id: true,
      applicantId: true,
      siteName: true,
      description: true,
      feedUrl: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      sourceId: true,
      createdAt: true,
      updatedAt: true,
      applicant: {
        select: {
          username: true,
          nickname: true,
          avatarPath: true,
        },
      },
      reviewer: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })
}

function normalizeReviewNote(value: unknown) {
  return normalizeTrimmedText(value, 500) || null
}

export async function getRssSourceApplicationAdminPageData(query: RssSourceApplicationAdminQuery = {}): Promise<RssSourceApplicationAdminPageData> {
  const normalized = {
    keyword: normalizeTrimmedText(query.keyword, 100),
    status: normalizeApplicationStatus(query.status),
    page: normalizePositiveInteger(query.page, 1),
    pageSize: normalizePageSize(query.pageSize, RSS_SOURCE_APPLICATION_PAGE_SIZE_OPTIONS, RSS_SOURCE_APPLICATION_DEFAULT_PAGE_SIZE),
  }
  const where = buildWhereInput(normalized)
  const [total, pending, approved, rejected] = await Promise.all([
    countApplications(where),
    countApplicationsByStatus(where, RssSourceApplicationStatus.PENDING),
    countApplicationsByStatus(where, RssSourceApplicationStatus.APPROVED),
    countApplicationsByStatus(where, RssSourceApplicationStatus.REJECTED),
  ])
  const pagination = resolvePagination({ page: normalized.page, pageSize: normalized.pageSize }, total, RSS_SOURCE_APPLICATION_PAGE_SIZE_OPTIONS, RSS_SOURCE_APPLICATION_DEFAULT_PAGE_SIZE)
  const applications = await listApplicationsPage(where, pagination.skip, pagination.pageSize)

  return {
    applications: applications.map(mapApplicationItem),
    filters: {
      keyword: normalized.keyword,
      status: normalized.status,
    },
    summary: {
      total,
      pending,
      approved,
      rejected,
    },
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },
  }
}

export function normalizeSourceApplicationActionInput(body: Record<string, unknown>) {
  const applicationId = normalizeText(body.applicationId)
  if (!applicationId) {
    apiError(400, "缺少申请参数")
  }

  return {
    applicationId,
    reviewNote: normalizeReviewNote(body.reviewNote),
  }
}
