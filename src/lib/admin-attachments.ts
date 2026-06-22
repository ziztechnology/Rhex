import { revalidatePath } from "next/cache"

import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { createAdminLogEntry } from "@/db/admin-log-queries"
import {
  deleteBackgroundJobById,
  enqueueBackgroundJob,
  findBackgroundJobById,
  type BackgroundJobDeleteResult,
  type BackgroundJobEnvelope,
} from "@/lib/background-jobs"
import { formatDateTime } from "@/lib/formatters"
import { PublicRouteError } from "@/lib/public-route-error"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { toPrismaJsonValue } from "@/lib/shared/prisma-json"
import { deleteStoredUploadFile } from "@/lib/upload"

export type AdminAttachmentReferenceFilter = "ALL" | "REFERENCED" | "ORPHAN"
export type AdminAttachmentReferenceScanKind = "SCAN" | "CLEANUP"
export type AdminAttachmentReferenceScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"

export const ATTACHMENT_REFERENCE_SCAN_JOB_NAME = "attachments.reference-scan"
export const ATTACHMENT_CLEANUP_JOB_NAME = "attachments.cleanup-orphans"

export interface AdminAttachmentFilters {
  keyword?: string
  bucketType?: string
  referenceStatus?: string
  page?: number
  pageSize?: number
}

export interface AdminAttachmentItem {
  id: string
  userId: number
  userName: string
  userHandle: string
  bucketType: string
  originalName: string
  fileName: string
  fileExt: string
  mimeType: string
  fileSize: number
  fileHash: string | null
  storagePath: string
  urlPath: string
  createdAt: string
  createdAtText: string
  postAttachmentCount: number
  directReferenceCount: number
  referenceCount: number
  referenceStatus: "REFERENCED" | "ORPHAN"
  referenceSources: string[]
}

export interface AdminAttachmentManagementResult {
  filters: {
    keyword: string
    bucketType: string
    referenceStatus: AdminAttachmentReferenceFilter
  }
  summary: {
    total: number
    referenced: number
    orphan: number
    totalBytes: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  rows: AdminAttachmentItem[]
  scan: AdminAttachmentScanState
  bucketOptions: Array<{
    value: string
    label: string
    count: number
  }>
}

export interface AdminAttachmentReferenceScanJobSummary {
  id: string
  kind: AdminAttachmentReferenceScanKind
  status: AdminAttachmentReferenceScanStatus
  backgroundJobId: string | null
  keyword: string
  bucketType: string
  limit: number | null
  total: number
  scanned: number
  referenced: number
  orphan: number
  deletedRecords: number
  deletedFiles: number
  retainedSharedFiles: number
  failed: number
  errorMessage: string | null
  startedAt: string | null
  startedAtText: string | null
  finishedAt: string | null
  finishedAtText: string | null
  createdAt: string
  createdAtText: string
  updatedAt: string
  updatedAtText: string
  progressPercent: number
}

export interface AdminAttachmentScanState {
  latestScan: AdminAttachmentReferenceScanJobSummary | null
  activeScan: AdminAttachmentReferenceScanJobSummary | null
  latestCleanup: AdminAttachmentReferenceScanJobSummary | null
  activeCleanup: AdminAttachmentReferenceScanJobSummary | null
  snapshot: {
    total: number
    referenced: number
    orphan: number
    latestScannedAt: string | null
    latestScannedAtText: string | null
  }
}

export interface AdminAttachmentJobEnqueueResult {
  job: AdminAttachmentReferenceScanJobSummary
}

export interface AdminAttachmentJobRepairResult {
  repairedJobs: AdminAttachmentReferenceScanJobSummary[]
  removedBackgroundJobs: BackgroundJobDeleteResult[]
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const CLEANUP_DEFAULT_LIMIT = 100
const CLEANUP_MAX_LIMIT = 500
const REFERENCE_SCAN_BATCH_SIZE = 50
const ACTIVE_REFERENCE_SCAN_STATUSES: AdminAttachmentReferenceScanStatus[] = ["QUEUED", "RUNNING"]
const REPAIRABLE_REFERENCE_SCAN_STATUSES: AdminAttachmentReferenceScanStatus[] = ["QUEUED"]

const uploadListSelect = {
  id: true,
  userId: true,
  bucketType: true,
  originalName: true,
  fileName: true,
  fileExt: true,
  mimeType: true,
  fileSize: true,
  fileHash: true,
  storagePath: true,
  urlPath: true,
  createdAt: true,
  user: {
    select: {
      username: true,
      nickname: true,
    },
  },
  _count: {
    select: {
      postAttachments: true,
    },
  },
} satisfies Prisma.UploadSelect

type UploadListRow = Prisma.UploadGetPayload<{ select: typeof uploadListSelect }>

const uploadReferenceScanJobSelect = {
  id: true,
  kind: true,
  status: true,
  backgroundJobId: true,
  adminId: true,
  keyword: true,
  bucketType: true,
  ip: true,
  limit: true,
  total: true,
  scanned: true,
  referenced: true,
  orphan: true,
  deletedRecords: true,
  deletedFiles: true,
  retainedSharedFiles: true,
  failed: true,
  errorMessage: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UploadReferenceScanJobSelect

type UploadReferenceScanJobRow = Prisma.UploadReferenceScanJobGetPayload<{ select: typeof uploadReferenceScanJobSelect }>

const uploadReferenceSnapshotSelect = {
  uploadId: true,
  scanJobId: true,
  referenceStatus: true,
  referenceCount: true,
  postAttachmentCount: true,
  directReferenceCount: true,
  referenceSourcesJson: true,
  scannedAt: true,
} satisfies Prisma.UploadReferenceSnapshotSelect

type UploadReferenceSnapshotRow = Prisma.UploadReferenceSnapshotGetPayload<{ select: typeof uploadReferenceSnapshotSelect }>

const uploadReferenceSnapshotWithUploadSelect = {
  ...uploadReferenceSnapshotSelect,
  upload: {
    select: uploadListSelect,
  },
} satisfies Prisma.UploadReferenceSnapshotSelect

type UploadReferenceSnapshotWithUploadRow = Prisma.UploadReferenceSnapshotGetPayload<{
  select: typeof uploadReferenceSnapshotWithUploadSelect
}>

interface UploadReferenceState {
  postAttachmentCount: number
  directReferenceCount: number
  sources: Set<string>
}

interface ResolveUploadReferenceOptions {
  deep?: boolean
}

function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function normalizePageSize(value: unknown) {
  const pageSize = Number(value)
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(pageSize, MAX_PAGE_SIZE)
}

function normalizeCleanupLimit(value: unknown) {
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit <= 0) {
    return CLEANUP_DEFAULT_LIMIT
  }

  return Math.min(limit, CLEANUP_MAX_LIMIT)
}

function normalizeReferenceFilter(value: unknown): AdminAttachmentReferenceFilter {
  return value === "REFERENCED" || value === "ORPHAN" ? value : "ALL"
}

function normalizeScanKind(value: string): AdminAttachmentReferenceScanKind {
  return value === "CLEANUP" ? "CLEANUP" : "SCAN"
}

function normalizeScanStatus(value: string): AdminAttachmentReferenceScanStatus {
  return value === "RUNNING" || value === "COMPLETED" || value === "FAILED" ? value : "QUEUED"
}

function isRevalidateUnavailableError(error: unknown) {
  return error instanceof Error
    && (
      error.message.startsWith("Invariant: static generation store missing in revalidatePath")
      || error.message.includes('used "revalidatePath ')
    )
}

function revalidateAdminAttachmentManagement() {
  try {
    revalidatePath("/admin")
  } catch (error) {
    if (!isRevalidateUnavailableError(error)) {
      console.warn("[admin-attachments] failed to revalidate admin attachment page", error)
    }
  }
}

function buildUploadWhere(filters: AdminAttachmentFilters): Prisma.UploadWhereInput {
  const keyword = filters.keyword?.trim() ?? ""
  const bucketType = filters.bucketType?.trim() ?? "ALL"

  return {
    ...(bucketType && bucketType !== "ALL" ? { bucketType } : {}),
    ...(keyword
      ? {
          OR: [
            { id: { contains: keyword, mode: "insensitive" } },
            { originalName: { contains: keyword, mode: "insensitive" } },
            { fileName: { contains: keyword, mode: "insensitive" } },
            { fileExt: { contains: keyword, mode: "insensitive" } },
            { mimeType: { contains: keyword, mode: "insensitive" } },
            { urlPath: { contains: keyword, mode: "insensitive" } },
            { storagePath: { contains: keyword, mode: "insensitive" } },
            { user: { username: { contains: keyword, mode: "insensitive" } } },
            { user: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }
}

function buildSnapshotWhere(
  filters: AdminAttachmentFilters,
  referenceStatus?: Exclude<AdminAttachmentReferenceFilter, "ALL">,
): Prisma.UploadReferenceSnapshotWhereInput {
  return {
    ...(referenceStatus ? { referenceStatus } : {}),
    upload: buildUploadWhere(filters),
  }
}

function buildPagination(total: number, requestedPage: number, requestedPageSize: number) {
  const pageSize = normalizePageSize(requestedPageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

function buildUploadOrderBy() {
  return [
    { createdAt: "desc" as const },
    { id: "desc" as const },
  ]
}

function createReferenceStateMap(rows: UploadListRow[]) {
  return new Map<string, UploadReferenceState>(rows.map((row) => [
    row.id,
    {
      postAttachmentCount: row._count.postAttachments,
      directReferenceCount: 0,
      sources: row._count.postAttachments > 0 ? new Set(["帖子附件"]) : new Set<string>(),
    },
  ]))
}

function addReference(
  states: Map<string, UploadReferenceState>,
  uploadIds: string[],
  source: string,
) {
  for (const uploadId of uploadIds) {
    const state = states.get(uploadId)
    if (!state) {
      continue
    }

    state.directReferenceCount += 1
    state.sources.add(source)
  }
}

function matchExactPath(value: string | null | undefined, uploadIdsByUrlPath: Map<string, string[]>) {
  if (!value) {
    return []
  }

  return uploadIdsByUrlPath.get(value) ?? []
}

function stringifyReferenceValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

function matchContainedPaths(value: unknown, rows: UploadListRow[]) {
  const referenceValue = stringifyReferenceValue(value)
  if (!referenceValue) {
    return []
  }

  return rows
    .filter((row) => getUploadReferenceNeedles(row).some((needle) => referenceValue.includes(needle)))
    .map((row) => row.id)
}

function getUploadReferenceNeedles(row: UploadListRow) {
  return Array.from(new Set([row.urlPath, row.id].map((item) => item.trim()).filter(Boolean)))
}

function buildContainsOr(rows: UploadListRow[], field: string) {
  return rows.flatMap((row) => getUploadReferenceNeedles(row).map((needle) => ({
    [field]: { contains: needle },
  })))
}

export async function resolveUploadReferenceStates(rows: UploadListRow[], options: ResolveUploadReferenceOptions = {}) {
  const states = createReferenceStateMap(rows)
  if (rows.length === 0) {
    return states
  }

  const deep = options.deep !== false
  const urlPaths = Array.from(new Set(rows.map((row) => row.urlPath).filter(Boolean)))
  const uploadIdsByUrlPath = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.urlPath) {
      continue
    }

    const existing = uploadIdsByUrlPath.get(row.urlPath) ?? []
    existing.push(row.id)
    uploadIdsByUrlPath.set(row.urlPath, existing)
  }

  if (!deep) {
    const [
      users,
      zones,
      boards,
      posts,
      friendLinks,
      badges,
      siteSettings,
      rssSources,
      announcements,
      boardApplications,
      levelDefinitions,
      verificationTypes,
      userVerifications,
      selfServeAdOrders,
      giftDefinitions,
    ] = await Promise.all([
      prisma.user.findMany({ where: { avatarPath: { in: urlPaths } }, select: { avatarPath: true } }),
      prisma.zone.findMany({ where: { icon: { in: urlPaths } }, select: { icon: true } }),
      prisma.board.findMany({
        where: { OR: [{ iconPath: { in: urlPaths } }, { coverPath: { in: urlPaths } }] },
        select: { iconPath: true, coverPath: true },
      }),
      prisma.post.findMany({ where: { coverPath: { in: urlPaths } }, select: { coverPath: true } }),
      prisma.friendLink.findMany({ where: { logoPath: { in: urlPaths } }, select: { logoPath: true } }),
      prisma.badge.findMany({
        where: { OR: [{ iconPath: { in: urlPaths } }, { iconText: { in: urlPaths } }, { imageUrl: { in: urlPaths } }] },
        select: { iconPath: true, iconText: true, imageUrl: true },
      }),
      prisma.siteSetting.findMany({ where: { siteLogoPath: { in: urlPaths } }, select: { siteLogoPath: true } }),
      prisma.rssSource.findMany({ where: { logoPath: { in: urlPaths } }, select: { logoPath: true } }),
      prisma.announcement.findMany({ where: { linkUrl: { in: urlPaths } }, select: { linkUrl: true } }),
      prisma.boardApplication.findMany({ where: { icon: { in: urlPaths } }, select: { icon: true } }),
      prisma.levelDefinition.findMany({ where: { icon: { in: urlPaths } }, select: { icon: true } }),
      prisma.verificationType.findMany({ where: { iconText: { in: urlPaths } }, select: { iconText: true } }),
      prisma.userVerification.findMany({ where: { customIconText: { in: urlPaths } }, select: { customIconText: true } }),
      prisma.selfServeAdOrder.findMany({ where: { imageUrl: { in: urlPaths } }, select: { imageUrl: true } }),
      prisma.giftDefinition.findMany({ where: { icon: { in: urlPaths } }, select: { icon: true } }),
    ])

    for (const item of users) {
      addReference(states, matchExactPath(item.avatarPath, uploadIdsByUrlPath), "用户头像")
    }
    for (const item of zones) {
      addReference(states, matchExactPath(item.icon, uploadIdsByUrlPath), "分区图标")
    }
    for (const item of boards) {
      addReference(states, matchExactPath(item.iconPath, uploadIdsByUrlPath), "节点图标")
      addReference(states, matchExactPath(item.coverPath, uploadIdsByUrlPath), "节点封面")
    }
    for (const item of posts) {
      addReference(states, matchExactPath(item.coverPath, uploadIdsByUrlPath), "帖子封面")
    }
    for (const item of friendLinks) {
      addReference(states, matchExactPath(item.logoPath, uploadIdsByUrlPath), "友情链接")
    }
    for (const item of badges) {
      addReference(states, matchExactPath(item.iconPath, uploadIdsByUrlPath), "勋章图标")
      addReference(states, matchExactPath(item.iconText, uploadIdsByUrlPath), "勋章图标")
      addReference(states, matchExactPath(item.imageUrl, uploadIdsByUrlPath), "勋章图片")
    }
    for (const item of siteSettings) {
      addReference(states, matchExactPath(item.siteLogoPath, uploadIdsByUrlPath), "站点 Logo")
    }
    for (const item of rssSources) {
      addReference(states, matchExactPath(item.logoPath, uploadIdsByUrlPath), "RSS 源")
    }
    for (const item of announcements) {
      addReference(states, matchExactPath(item.linkUrl, uploadIdsByUrlPath), "站点文档链接")
    }
    for (const item of boardApplications) {
      addReference(states, matchExactPath(item.icon, uploadIdsByUrlPath), "节点申请")
    }
    for (const item of levelDefinitions) {
      addReference(states, matchExactPath(item.icon, uploadIdsByUrlPath), "等级图标")
    }
    for (const item of verificationTypes) {
      addReference(states, matchExactPath(item.iconText, uploadIdsByUrlPath), "认证类型图标")
    }
    for (const item of userVerifications) {
      addReference(states, matchExactPath(item.customIconText, uploadIdsByUrlPath), "用户认证图标")
    }
    for (const item of selfServeAdOrders) {
      addReference(states, matchExactPath(item.imageUrl, uploadIdsByUrlPath), "自助广告图片")
    }
    for (const item of giftDefinitions) {
      addReference(states, matchExactPath(item.icon, uploadIdsByUrlPath), "礼物图标")
    }

    return states
  }

  const [
    users,
    zones,
    boards,
    posts,
    appendices,
    comments,
    messages,
    friendLinks,
    badges,
    siteSettings,
    rssSources,
    announcements,
    customPages,
    boardApplications,
    postAuctions,
    levelDefinitions,
    verificationTypes,
    userVerifications,
    selfServeAdOrders,
    giftDefinitions,
    addonConfigs,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ avatarPath: { in: urlPaths } }, ...buildContainsOr(rows, "bio"), ...buildContainsOr(rows, "signature")] },
      select: { avatarPath: true, bio: true, signature: true },
    }),
    prisma.zone.findMany({ where: { OR: buildContainsOr(rows, "icon") }, select: { icon: true } }),
    prisma.board.findMany({ select: { iconPath: true, coverPath: true, configJson: true } }),
    prisma.post.findMany({
      where: { OR: [{ coverPath: { in: urlPaths } }, ...buildContainsOr(rows, "content"), ...buildContainsOr(rows, "appendedContent")] },
      select: { coverPath: true, content: true, appendedContent: true },
    }),
    prisma.postAppendix.findMany({ where: { OR: buildContainsOr(rows, "content") }, select: { content: true } }),
    prisma.comment.findMany({ where: { OR: buildContainsOr(rows, "content") }, select: { content: true } }),
    prisma.directMessage.findMany({ where: { OR: buildContainsOr(rows, "body") }, select: { body: true } }),
    prisma.friendLink.findMany({ where: { logoPath: { in: urlPaths } }, select: { logoPath: true } }),
    prisma.badge.findMany({
      where: { OR: [{ iconPath: { in: urlPaths } }, { imageUrl: { in: urlPaths } }, ...buildContainsOr(rows, "iconText"), ...buildContainsOr(rows, "imageUrl")] },
      select: { iconPath: true, iconText: true, imageUrl: true },
    }),
    prisma.siteSetting.findMany({
      where: {
        OR: [
          { siteLogoPath: { in: urlPaths } },
          ...buildContainsOr(rows, "appStateJson"),
          ...buildContainsOr(rows, "headerAppLinksJson"),
          ...buildContainsOr(rows, "footerLinksJson"),
          ...buildContainsOr(rows, "markdownEmojiMapJson"),
        ],
      },
      select: { siteLogoPath: true, appStateJson: true, headerAppLinksJson: true, footerLinksJson: true, markdownEmojiMapJson: true },
    }),
    prisma.rssSource.findMany({ where: { logoPath: { in: urlPaths } }, select: { logoPath: true } }),
    prisma.announcement.findMany({
      where: { OR: [...buildContainsOr(rows, "content"), { linkUrl: { in: urlPaths } }] },
      select: { content: true, linkUrl: true },
    }),
    prisma.customPage.findMany({ where: { OR: buildContainsOr(rows, "htmlContent") }, select: { htmlContent: true } }),
    prisma.boardApplication.findMany({ where: { OR: [{ icon: { in: urlPaths } }, ...buildContainsOr(rows, "icon")] }, select: { icon: true } }),
    prisma.postAuction.findMany({
      where: { OR: [...buildContainsOr(rows, "winnerOnlyContent"), ...buildContainsOr(rows, "winnerOnlyContentPreview")] },
      select: { winnerOnlyContent: true, winnerOnlyContentPreview: true },
    }),
    prisma.levelDefinition.findMany({ where: { OR: buildContainsOr(rows, "icon") }, select: { icon: true } }),
    prisma.verificationType.findMany({ where: { OR: buildContainsOr(rows, "iconText") }, select: { iconText: true } }),
    prisma.userVerification.findMany({
      where: { OR: [...buildContainsOr(rows, "customIconText"), ...buildContainsOr(rows, "content"), ...buildContainsOr(rows, "formResponseJson")] },
      select: { customIconText: true, content: true, formResponseJson: true },
    }),
    prisma.selfServeAdOrder.findMany({ where: { OR: buildContainsOr(rows, "imageUrl") }, select: { imageUrl: true } }),
    prisma.giftDefinition.findMany({ where: { OR: buildContainsOr(rows, "icon") }, select: { icon: true } }),
    prisma.addonConfig.findMany({ select: { valueJson: true } }),
  ])

  for (const item of users) {
    addReference(states, matchExactPath(item.avatarPath, uploadIdsByUrlPath), "用户头像")
    addReference(states, matchContainedPaths(item.bio, rows), "用户简介")
    addReference(states, matchContainedPaths(item.signature, rows), "用户介绍")
  }
  for (const item of zones) {
    addReference(states, matchContainedPaths(item.icon, rows), "分区图标")
  }
  for (const item of boards) {
    addReference(states, matchExactPath(item.iconPath, uploadIdsByUrlPath), "节点图标")
    addReference(states, matchExactPath(item.coverPath, uploadIdsByUrlPath), "节点封面")
    addReference(states, matchContainedPaths(item.configJson, rows), "节点配置")
  }
  for (const item of posts) {
    addReference(states, matchExactPath(item.coverPath, uploadIdsByUrlPath), "帖子封面")
    addReference(states, matchContainedPaths(item.content, rows), "帖子内容")
    addReference(states, matchContainedPaths(item.appendedContent, rows), "帖子追加内容")
  }
  for (const item of appendices) {
    addReference(states, matchContainedPaths(item.content, rows), "帖子附加内容")
  }
  for (const item of comments) {
    addReference(states, matchContainedPaths(item.content, rows), "评论内容")
  }
  for (const item of messages) {
    addReference(states, matchContainedPaths(item.body, rows), "私信内容")
  }
  for (const item of friendLinks) {
    addReference(states, matchExactPath(item.logoPath, uploadIdsByUrlPath), "友情链接")
  }
  for (const item of badges) {
    addReference(states, matchExactPath(item.iconPath, uploadIdsByUrlPath), "勋章图标")
    addReference(states, matchContainedPaths(item.iconText, rows), "勋章图标")
    addReference(states, matchExactPath(item.imageUrl, uploadIdsByUrlPath), "勋章图片")
    addReference(states, matchContainedPaths(item.imageUrl, rows), "勋章图片")
  }
  for (const item of siteSettings) {
    addReference(states, matchExactPath(item.siteLogoPath, uploadIdsByUrlPath), "站点 Logo")
    addReference(states, matchContainedPaths(item.appStateJson, rows), "站点设置")
    addReference(states, matchContainedPaths(item.headerAppLinksJson, rows), "站点设置")
    addReference(states, matchContainedPaths(item.footerLinksJson, rows), "站点设置")
    addReference(states, matchContainedPaths(item.markdownEmojiMapJson, rows), "站点设置")
  }
  for (const item of rssSources) {
    addReference(states, matchExactPath(item.logoPath, uploadIdsByUrlPath), "RSS 源")
  }
  for (const item of announcements) {
    addReference(states, matchContainedPaths(item.content, rows), "站点文档")
    addReference(states, matchExactPath(item.linkUrl, uploadIdsByUrlPath), "站点文档链接")
  }
  for (const item of customPages) {
    addReference(states, matchContainedPaths(item.htmlContent, rows), "自定义页面")
  }
  for (const item of boardApplications) {
    addReference(states, matchExactPath(item.icon, uploadIdsByUrlPath), "节点申请")
    addReference(states, matchContainedPaths(item.icon, rows), "节点申请")
  }
  for (const item of postAuctions) {
    addReference(states, matchContainedPaths(item.winnerOnlyContent, rows), "拍卖赢家内容")
    addReference(states, matchContainedPaths(item.winnerOnlyContentPreview, rows), "拍卖赢家内容")
  }
  for (const item of levelDefinitions) {
    addReference(states, matchContainedPaths(item.icon, rows), "等级图标")
  }
  for (const item of verificationTypes) {
    addReference(states, matchContainedPaths(item.iconText, rows), "认证类型图标")
  }
  for (const item of userVerifications) {
    addReference(states, matchContainedPaths(item.customIconText, rows), "用户认证图标")
    addReference(states, matchContainedPaths(item.content, rows), "用户认证材料")
    addReference(states, matchContainedPaths(item.formResponseJson, rows), "用户认证材料")
  }
  for (const item of selfServeAdOrders) {
    addReference(states, matchContainedPaths(item.imageUrl, rows), "自助广告图片")
  }
  for (const item of giftDefinitions) {
    addReference(states, matchContainedPaths(item.icon, rows), "礼物图标")
  }
  for (const item of addonConfigs) {
    addReference(states, matchContainedPaths(item.valueJson, rows), "插件配置")
  }

  return states
}

function isReferenced(state: UploadReferenceState) {
  return state.postAttachmentCount + state.directReferenceCount > 0
}

function mapUploadItem(row: UploadListRow, state: UploadReferenceState): AdminAttachmentItem {
  const referenceCount = state.postAttachmentCount + state.directReferenceCount

  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.nickname ?? row.user.username,
    userHandle: `@${row.user.username}`,
    bucketType: row.bucketType,
    originalName: row.originalName,
    fileName: row.fileName,
    fileExt: row.fileExt,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    storagePath: row.storagePath,
    urlPath: row.urlPath,
    createdAt: row.createdAt.toISOString(),
    createdAtText: formatDateTime(row.createdAt),
    postAttachmentCount: state.postAttachmentCount,
    directReferenceCount: state.directReferenceCount,
    referenceCount,
    referenceStatus: referenceCount > 0 ? "REFERENCED" : "ORPHAN",
    referenceSources: Array.from(state.sources),
  }
}

function readSnapshotReferenceSources(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

function mapSnapshotState(snapshot: UploadReferenceSnapshotRow): UploadReferenceState {
  return {
    postAttachmentCount: snapshot.postAttachmentCount,
    directReferenceCount: snapshot.directReferenceCount,
    sources: new Set(readSnapshotReferenceSources(snapshot.referenceSourcesJson)),
  }
}

function mapUploadItemFromSnapshot(snapshot: UploadReferenceSnapshotWithUploadRow) {
  return mapUploadItem(snapshot.upload, mapSnapshotState(snapshot))
}

function mapNullableDateTime(value: Date | null) {
  return value
    ? {
        iso: value.toISOString(),
        text: formatDateTime(value),
      }
    : {
        iso: null,
        text: null,
      }
}

function mapReferenceScanJob(row: UploadReferenceScanJobRow | null): AdminAttachmentReferenceScanJobSummary | null {
  if (!row) {
    return null
  }

  const startedAt = mapNullableDateTime(row.startedAt)
  const finishedAt = mapNullableDateTime(row.finishedAt)
  const base = row.total > 0 ? Math.floor((row.scanned / row.total) * 100) : 0
  const progressPercent = row.status === "COMPLETED"
    ? 100
    : Math.max(0, Math.min(99, base))

  return {
    id: row.id,
    kind: normalizeScanKind(row.kind),
    status: normalizeScanStatus(row.status),
    backgroundJobId: row.backgroundJobId,
    keyword: row.keyword ?? "",
    bucketType: row.bucketType ?? "ALL",
    limit: row.limit,
    total: row.total,
    scanned: row.scanned,
    referenced: row.referenced,
    orphan: row.orphan,
    deletedRecords: row.deletedRecords,
    deletedFiles: row.deletedFiles,
    retainedSharedFiles: row.retainedSharedFiles,
    failed: row.failed,
    errorMessage: row.errorMessage,
    startedAt: startedAt.iso,
    startedAtText: startedAt.text,
    finishedAt: finishedAt.iso,
    finishedAtText: finishedAt.text,
    createdAt: row.createdAt.toISOString(),
    createdAtText: formatDateTime(row.createdAt),
    updatedAt: row.updatedAt.toISOString(),
    updatedAtText: formatDateTime(row.updatedAt),
    progressPercent,
  }
}

async function getAttachmentScanState(filters: AdminAttachmentFilters): Promise<AdminAttachmentScanState> {
  const snapshotWhere = buildSnapshotWhere(filters)
  const [
    latestScan,
    activeScan,
    latestCleanup,
    activeCleanup,
    snapshotTotal,
    snapshotReferenced,
    snapshotOrphan,
    latestSnapshot,
  ] = await Promise.all([
    prisma.uploadReferenceScanJob.findFirst({
      where: { kind: "SCAN" },
      orderBy: { createdAt: "desc" },
      select: uploadReferenceScanJobSelect,
    }),
    prisma.uploadReferenceScanJob.findFirst({
      where: { kind: "SCAN", status: { in: ACTIVE_REFERENCE_SCAN_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: uploadReferenceScanJobSelect,
    }),
    prisma.uploadReferenceScanJob.findFirst({
      where: { kind: "CLEANUP" },
      orderBy: { createdAt: "desc" },
      select: uploadReferenceScanJobSelect,
    }),
    prisma.uploadReferenceScanJob.findFirst({
      where: { kind: "CLEANUP", status: { in: ACTIVE_REFERENCE_SCAN_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: uploadReferenceScanJobSelect,
    }),
    prisma.uploadReferenceSnapshot.count({ where: snapshotWhere }),
    prisma.uploadReferenceSnapshot.count({ where: { ...snapshotWhere, referenceStatus: "REFERENCED" } }),
    prisma.uploadReferenceSnapshot.count({ where: { ...snapshotWhere, referenceStatus: "ORPHAN" } }),
    prisma.uploadReferenceSnapshot.findFirst({
      where: snapshotWhere,
      orderBy: { scannedAt: "desc" },
      select: { scannedAt: true },
    }),
  ])
  const latestScannedAt = mapNullableDateTime(latestSnapshot?.scannedAt ?? null)

  return {
    latestScan: mapReferenceScanJob(latestScan),
    activeScan: mapReferenceScanJob(activeScan),
    latestCleanup: mapReferenceScanJob(latestCleanup),
    activeCleanup: mapReferenceScanJob(activeCleanup),
    snapshot: {
      total: snapshotTotal,
      referenced: snapshotReferenced,
      orphan: snapshotOrphan,
      latestScannedAt: latestScannedAt.iso,
      latestScannedAtText: latestScannedAt.text,
    },
  }
}

async function getUploadPageFromSnapshot(filters: AdminAttachmentFilters, referenceStatus: Exclude<AdminAttachmentReferenceFilter, "ALL">, page: number, pageSize: number) {
  const where = buildSnapshotWhere(filters, referenceStatus)
  const total = await prisma.uploadReferenceSnapshot.count({ where })
  const pagination = buildPagination(total, page, pageSize)
  const snapshots = await prisma.uploadReferenceSnapshot.findMany({
    where,
    orderBy: [
      { scannedAt: "desc" },
      { uploadId: "desc" },
    ],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: uploadReferenceSnapshotWithUploadSelect,
  })

  return {
    pagination,
    rows: snapshots.map(mapUploadItemFromSnapshot),
  }
}

async function getUploadPageFromUploads(where: Prisma.UploadWhereInput, page: number, pageSize: number) {
  const total = await prisma.upload.count({ where })
  const pagination = buildPagination(total, page, pageSize)
  const rows = await prisma.upload.findMany({
    where,
    orderBy: buildUploadOrderBy(),
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: uploadListSelect,
  })
  const states = await resolveUploadReferenceStates(rows)

  return {
    pagination,
    rows: rows.map((row) => mapUploadItem(row, states.get(row.id) ?? {
      postAttachmentCount: row._count.postAttachments,
      directReferenceCount: 0,
      sources: new Set<string>(),
    })),
  }
}

export async function getAdminAttachmentManagement(filters: AdminAttachmentFilters = {}): Promise<AdminAttachmentManagementResult> {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权限访问附件管理",
  )

  const where = buildUploadWhere(filters)
  const keyword = filters.keyword?.trim() ?? ""
  const bucketType = filters.bucketType?.trim() || "ALL"
  const referenceStatus = normalizeReferenceFilter(filters.referenceStatus)
  const page = normalizePage(filters.page)
  const pageSize = normalizePageSize(filters.pageSize)
  const [bucketGroups, total, aggregate, scan, pageResult] = await Promise.all([
    prisma.upload.groupBy({
      by: ["bucketType"],
      _count: { _all: true },
      orderBy: { bucketType: "asc" },
    }),
    prisma.upload.count({ where }),
    prisma.upload.aggregate({ where, _sum: { fileSize: true } }),
    getAttachmentScanState({ keyword, bucketType }),
    referenceStatus === "ALL"
      ? getUploadPageFromUploads(where, page, pageSize)
      : getUploadPageFromSnapshot({ keyword, bucketType }, referenceStatus, page, pageSize),
  ])

  return {
    filters: {
      keyword,
      bucketType,
      referenceStatus,
    },
    summary: {
      total,
      referenced: scan.snapshot.referenced,
      orphan: scan.snapshot.orphan,
      totalBytes: aggregate._sum.fileSize ?? 0,
    },
    pagination: pageResult.pagination,
    rows: pageResult.rows,
    scan,
    bucketOptions: bucketGroups.map((item) => ({
      value: item.bucketType,
      label: item.bucketType,
      count: item._count._all,
    })),
  }
}

async function deleteUploadFileIfUnshared(row: UploadListRow, deletingIds: Set<string>) {
  const sharedCount = await prisma.upload.count({
    where: {
      storagePath: row.storagePath,
      id: { notIn: Array.from(deletingIds) },
    },
  })

  if (sharedCount > 0) {
    return "retained" as const
  }

  try {
    await deleteStoredUploadFile(row.storagePath)
    return "deleted" as const
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "missing" as const
    }

    throw error
  }
}

async function updateReferenceSnapshot(scanJobId: string, row: UploadListRow, state: UploadReferenceState, scannedAt: Date) {
  const referenceCount = state.postAttachmentCount + state.directReferenceCount
  await prisma.uploadReferenceSnapshot.upsert({
    where: { uploadId: row.id },
    create: {
      uploadId: row.id,
      scanJobId,
      referenceStatus: referenceCount > 0 ? "REFERENCED" : "ORPHAN",
      referenceCount,
      postAttachmentCount: state.postAttachmentCount,
      directReferenceCount: state.directReferenceCount,
      referenceSourcesJson: toPrismaJsonValue(Array.from(state.sources)) ?? [],
      scannedAt,
    },
    update: {
      scanJobId,
      referenceStatus: referenceCount > 0 ? "REFERENCED" : "ORPHAN",
      referenceCount,
      postAttachmentCount: state.postAttachmentCount,
      directReferenceCount: state.directReferenceCount,
      referenceSourcesJson: toPrismaJsonValue(Array.from(state.sources)) ?? [],
      scannedAt,
    },
  })
}

async function getReferenceScanJobOrThrow(scanJobId: string) {
  const job = await prisma.uploadReferenceScanJob.findUnique({
    where: { id: scanJobId },
    select: uploadReferenceScanJobSelect,
  })

  if (!job) {
    throw new PublicRouteError("附件引用任务不存在", 404)
  }

  return job
}

function getReferenceBackgroundJobName(kind: AdminAttachmentReferenceScanKind) {
  return kind === "CLEANUP" ? ATTACHMENT_CLEANUP_JOB_NAME : ATTACHMENT_REFERENCE_SCAN_JOB_NAME
}

function matchesReferenceBackgroundJob(row: UploadReferenceScanJobRow) {
  return (job: BackgroundJobEnvelope) => {
    if (job.name !== getReferenceBackgroundJobName(normalizeScanKind(row.kind))) {
      return false
    }

    const payload = job.payload as { scanJobId?: unknown; cleanupJobId?: unknown }
    return payload.scanJobId === row.id || payload.cleanupJobId === row.id
  }
}

async function findActiveReferenceScanJob(kind: AdminAttachmentReferenceScanKind) {
  const jobs = await prisma.uploadReferenceScanJob.findMany({
    where: { kind, status: { in: ACTIVE_REFERENCE_SCAN_STATUSES } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: uploadReferenceScanJobSelect,
  })

  for (const job of jobs) {
    const reconciled = await reconcileQueuedReferenceScanJob(job)
    if (ACTIVE_REFERENCE_SCAN_STATUSES.includes(normalizeScanStatus(reconciled.status))) {
      return reconciled
    }
  }

  return null
}

async function markReferenceScanJobFailedWithMessage(scanJobId: string, message: string) {
  const job = await prisma.uploadReferenceScanJob.update({
    where: { id: scanJobId },
    data: {
      status: "FAILED",
      errorMessage: message.slice(0, 1000),
      finishedAt: new Date(),
    },
    select: uploadReferenceScanJobSelect,
  })
  revalidateAdminAttachmentManagement()

  return job
}

async function reconcileQueuedReferenceScanJob(job: UploadReferenceScanJobRow) {
  if (normalizeScanStatus(job.status) !== "QUEUED" || !job.backgroundJobId) {
    return job
  }

  const backgroundJob = await findBackgroundJobById(job.backgroundJobId, {
    match: matchesReferenceBackgroundJob(job),
  }).catch(() => null)

  if (backgroundJob) {
    return job
  }

  return markReferenceScanJobFailedWithMessage(
    job.id,
    "后台队列里已找不到对应任务，系统已自动解除排队状态。请确认 worker 已重启后重新发起扫描或清理。",
  )
}

async function markReferenceScanJobFailed(scanJobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  await markReferenceScanJobFailedWithMessage(scanJobId, message)
}

export async function repairQueuedAttachmentJobs(input: {
  adminId?: number
  ip?: string | null
} = {}): Promise<AdminAttachmentJobRepairResult> {
  const queuedJobs = await prisma.uploadReferenceScanJob.findMany({
    where: { status: { in: REPAIRABLE_REFERENCE_SCAN_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: uploadReferenceScanJobSelect,
  })
  const repairedJobs: AdminAttachmentReferenceScanJobSummary[] = []
  const removedBackgroundJobs: BackgroundJobDeleteResult[] = []

  for (const job of queuedJobs) {
    if (job.backgroundJobId) {
      const removed = await deleteBackgroundJobById(job.backgroundJobId, {
        match: matchesReferenceBackgroundJob(job),
      })
      removedBackgroundJobs.push(removed)
    }

    const repaired = await markReferenceScanJobFailedWithMessage(
      job.id,
      "后台任务已被管理员解除。通常是 worker 未重启导致新任务进入死信队列，请重启 worker 后重新发起扫描或清理。",
    )
    const summary = mapReferenceScanJob(repaired)
    if (summary) {
      repairedJobs.push(summary)
    }
  }

  if (input.adminId && repairedJobs.length > 0) {
    await createAdminLogEntry({
      adminId: input.adminId,
      action: "attachments.repair-queued-jobs",
      targetType: "UploadReferenceScanJob",
      targetId: "bulk",
      detail: `解除卡住的附件后台任务 ${repairedJobs.length} 个，移除后台队列/死信记录 ${removedBackgroundJobs.filter((item) => item.removed).length} 个`,
      ip: input.ip,
    })
  }

  return {
    repairedJobs,
    removedBackgroundJobs,
  }
}

export async function enqueueAttachmentReferenceScan(input: {
  bucketType?: string
  keyword?: string
  adminId?: number
  ip?: string | null
}): Promise<AdminAttachmentJobEnqueueResult> {
  const [activeScan, activeCleanup] = await Promise.all([
    findActiveReferenceScanJob("SCAN"),
    findActiveReferenceScanJob("CLEANUP"),
  ])
  if (activeScan) {
    return { job: mapReferenceScanJob(activeScan)! }
  }
  if (activeCleanup) {
    throw new PublicRouteError("附件清理任务正在运行，完成后再启动深度扫描")
  }

  const job = await prisma.uploadReferenceScanJob.create({
    data: {
      kind: "SCAN",
      status: "QUEUED",
      keyword: input.keyword?.trim() || null,
      bucketType: input.bucketType?.trim() || "ALL",
      adminId: input.adminId,
      ip: input.ip ?? null,
    },
    select: uploadReferenceScanJobSelect,
  })
  const backgroundJob = await enqueueBackgroundJob(ATTACHMENT_REFERENCE_SCAN_JOB_NAME, { scanJobId: job.id }, { maxAttempts: 1 })
  const updated = await prisma.uploadReferenceScanJob.update({
    where: { id: job.id },
    data: { backgroundJobId: backgroundJob.job.id },
    select: uploadReferenceScanJobSelect,
  })

  return { job: mapReferenceScanJob(updated)! }
}

export async function enqueueAttachmentCleanupJob(input: {
  limit?: number
  bucketType?: string
  keyword?: string
  adminId?: number
  ip?: string | null
}): Promise<AdminAttachmentJobEnqueueResult> {
  const [activeScan, activeCleanup] = await Promise.all([
    findActiveReferenceScanJob("SCAN"),
    findActiveReferenceScanJob("CLEANUP"),
  ])
  if (activeCleanup) {
    return { job: mapReferenceScanJob(activeCleanup)! }
  }
  if (activeScan) {
    throw new PublicRouteError("附件引用深度扫描正在运行，完成后再清理无引用资源")
  }

  const limit = normalizeCleanupLimit(input.limit)
  const job = await prisma.uploadReferenceScanJob.create({
    data: {
      kind: "CLEANUP",
      status: "QUEUED",
      keyword: input.keyword?.trim() || null,
      bucketType: input.bucketType?.trim() || "ALL",
      limit,
      adminId: input.adminId,
      ip: input.ip ?? null,
    },
    select: uploadReferenceScanJobSelect,
  })
  const backgroundJob = await enqueueBackgroundJob(ATTACHMENT_CLEANUP_JOB_NAME, { cleanupJobId: job.id }, { maxAttempts: 1 })
  const updated = await prisma.uploadReferenceScanJob.update({
    where: { id: job.id },
    data: { backgroundJobId: backgroundJob.job.id },
    select: uploadReferenceScanJobSelect,
  })

  return { job: mapReferenceScanJob(updated)! }
}

export async function runAttachmentReferenceScanJob(scanJobId: string) {
  const existing = await getReferenceScanJobOrThrow(scanJobId)
  if (existing.status === "COMPLETED" || existing.status === "RUNNING") {
    return
  }

  const where = buildUploadWhere({
    keyword: existing.keyword ?? "",
    bucketType: existing.bucketType ?? "ALL",
  })
  const total = await prisma.upload.count({ where })
  await prisma.uploadReferenceScanJob.update({
    where: { id: scanJobId },
    data: {
      status: "RUNNING",
      total,
      scanned: 0,
      referenced: 0,
      orphan: 0,
      failed: 0,
      errorMessage: null,
      startedAt: new Date(),
      finishedAt: null,
    },
  })

  let scanned = 0
  let referenced = 0
  let orphan = 0
  let cursor: string | undefined

  try {
    while (true) {
      const batch = await prisma.upload.findMany({
        where,
        orderBy: buildUploadOrderBy(),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: REFERENCE_SCAN_BATCH_SIZE,
        select: uploadListSelect,
      })

      if (batch.length === 0) {
        break
      }

      const scannedAt = new Date()
      const states = await resolveUploadReferenceStates(batch)
      for (const row of batch) {
        const state = states.get(row.id) ?? {
          postAttachmentCount: row._count.postAttachments,
          directReferenceCount: 0,
          sources: new Set<string>(),
        }
        await updateReferenceSnapshot(scanJobId, row, state, scannedAt)
        if (isReferenced(state)) {
          referenced += 1
        } else {
          orphan += 1
        }
      }

      scanned += batch.length
      cursor = batch[batch.length - 1]?.id
      await prisma.uploadReferenceScanJob.update({
        where: { id: scanJobId },
        data: { scanned, referenced, orphan },
      })
    }

    await prisma.uploadReferenceScanJob.update({
      where: { id: scanJobId },
      data: {
        status: "COMPLETED",
        scanned,
        referenced,
        orphan,
        finishedAt: new Date(),
      },
    })
    revalidateAdminAttachmentManagement()
  } catch (error) {
    await markReferenceScanJobFailed(scanJobId, error)
    throw error
  }
}

export async function runAttachmentCleanupJob(cleanupJobId: string) {
  const existing = await getReferenceScanJobOrThrow(cleanupJobId)
  if (existing.status === "COMPLETED" || existing.status === "RUNNING") {
    return
  }

  const limit = normalizeCleanupLimit(existing.limit)
  const snapshotWhere = buildSnapshotWhere({
    keyword: existing.keyword ?? "",
    bucketType: existing.bucketType ?? "ALL",
  }, "ORPHAN")
  const total = await prisma.uploadReferenceSnapshot.count({ where: snapshotWhere })
  await prisma.uploadReferenceScanJob.update({
    where: { id: cleanupJobId },
    data: {
      status: "RUNNING",
      total: Math.min(total, limit),
      scanned: 0,
      deletedRecords: 0,
      deletedFiles: 0,
      retainedSharedFiles: 0,
      failed: 0,
      errorMessage: null,
      startedAt: new Date(),
      finishedAt: null,
    },
  })

  const snapshots = await prisma.uploadReferenceSnapshot.findMany({
    where: snapshotWhere,
    orderBy: [
      { scannedAt: "desc" },
      { uploadId: "desc" },
    ],
    take: limit,
    select: { uploadId: true },
  })
  const deletingIds = new Set(snapshots.map((item) => item.uploadId))
  const deletedStoragePaths = new Set<string>()
  let scanned = 0
  let deletedRecords = 0
  let deletedFiles = 0
  let retainedSharedFiles = 0
  let failed = 0

  try {
    for (const snapshot of snapshots) {
      scanned += 1
      const latest = await prisma.upload.findUnique({ where: { id: snapshot.uploadId }, select: uploadListSelect })
      if (!latest) {
        await prisma.uploadReferenceSnapshot.deleteMany({ where: { uploadId: snapshot.uploadId } })
        await prisma.uploadReferenceScanJob.update({
          where: { id: cleanupJobId },
          data: { scanned, deletedRecords, deletedFiles, retainedSharedFiles, failed },
        })
        continue
      }

      const latestStates = await resolveUploadReferenceStates([latest])
      const latestState = latestStates.get(latest.id) ?? {
        postAttachmentCount: latest._count.postAttachments,
        directReferenceCount: 0,
        sources: new Set<string>(),
      }

      if (isReferenced(latestState)) {
        await updateReferenceSnapshot(cleanupJobId, latest, latestState, new Date())
        failed += 1
        await prisma.uploadReferenceScanJob.update({
          where: { id: cleanupJobId },
          data: { scanned, deletedRecords, deletedFiles, retainedSharedFiles, failed },
        })
        continue
      }

      try {
        if (!deletedStoragePaths.has(latest.storagePath)) {
          const result = await deleteUploadFileIfUnshared(latest, deletingIds)
          if (result === "retained") {
            retainedSharedFiles += 1
          } else {
            deletedFiles += 1
            deletedStoragePaths.add(latest.storagePath)
          }
        }

        await prisma.upload.delete({ where: { id: latest.id } })
        deletedRecords += 1
      } catch (error) {
        failed += 1
        console.error("[admin-attachments] failed to cleanup upload", latest.id, error)
      }

      await prisma.uploadReferenceScanJob.update({
        where: { id: cleanupJobId },
        data: { scanned, deletedRecords, deletedFiles, retainedSharedFiles, failed },
      })
    }

    await prisma.uploadReferenceScanJob.update({
      where: { id: cleanupJobId },
      data: {
        status: "COMPLETED",
        scanned,
        deletedRecords,
        deletedFiles,
        retainedSharedFiles,
        failed,
        finishedAt: new Date(),
      },
    })

    if (existing.adminId) {
      await createAdminLogEntry({
        adminId: existing.adminId,
        action: "attachments.cleanup-orphans",
        targetType: "Upload",
        targetId: "bulk",
        detail: `后台清理无引用资源：删除记录 ${deletedRecords} 条，删除文件 ${deletedFiles} 个，共校验 ${scanned} 条`,
        ip: existing.ip,
      })
    }
    revalidateAdminAttachmentManagement()
  } catch (error) {
    await markReferenceScanJobFailed(cleanupJobId, error)
    throw error
  }
}

export async function cleanupOrphanUploads(input: {
  limit?: number
  bucketType?: string
  keyword?: string
  adminId?: number
  ip?: string | null
}): Promise<AdminAttachmentJobEnqueueResult> {
  return enqueueAttachmentCleanupJob(input)
}

export async function deleteOrphanUploadById(input: {
  uploadId: string
  adminId?: number
  ip?: string | null
}) {
  const upload = await prisma.upload.findUnique({ where: { id: input.uploadId }, select: uploadListSelect })
  if (!upload) {
    throw new PublicRouteError("附件记录不存在", 404)
  }

  const states = await resolveUploadReferenceStates([upload])
  const state = states.get(upload.id)
  if (state && isReferenced(state)) {
    throw new PublicRouteError("该资源仍被引用，不能删除")
  }

  const fileResult = await deleteUploadFileIfUnshared(upload, new Set([upload.id]))
  await prisma.upload.delete({ where: { id: upload.id } })
  revalidateAdminAttachmentManagement()

  if (input.adminId) {
    await createAdminLogEntry({
      adminId: input.adminId,
      action: "attachments.delete-orphan",
      targetType: "Upload",
      targetId: upload.id,
      detail: `删除无引用资源：${upload.originalName}（${fileResult === "retained" ? "共享文件保留" : "文件已删除"}）`,
      ip: input.ip,
    })
  }

  return {
    uploadId: upload.id,
    fileDeleted: fileResult !== "retained",
  }
}
