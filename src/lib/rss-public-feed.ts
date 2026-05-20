import { resolvePagination } from "@/db/helpers"
import { prisma } from "@/db/client"
import { countApprovedRssEntriesBySourceIds, countPublicRssEntries, listAllPublicRssSources, listPublicRssEntries, listPublicRssEntryViewerLikes } from "@/db/rss-public-feed-queries"
import { listRssSourceRuntimeStates } from "@/lib/rss-harvest-source-state"
import { normalizeHttpUrl } from "@/lib/shared/url"
import { getSiteSettings, type SiteTippingGiftItem } from "@/lib/site-settings"

function normalizeExternalUrl(value: string | null) {
  return normalizeHttpUrl(value)
}

export interface RssUniverseFeedPageData {
  items: Array<{
    id: string
    sourceId: string
    sourceName: string
    sourceLogoPath: string | null
    title: string
    author: string | null
    summary: string | null
    linkUrl: string | null
    publishedAt: string | null
    createdAt: string
    likeCount: number
    tipCount: number
    tipTotalPoints: number
    viewerLiked: boolean
  }>
  availableSources: Array<{
    id: string
    siteName: string
    description: string | null
    logoPath: string | null
    entryCount: number
    latestEntryAt: string | null
  }>
  activeSource: {
    id: string
    siteName: string
    description: string | null
    logoPath: string | null
    entryCount: number
    latestEntryAt: string | null
  } | null
  support: {
    enabled: boolean
    isLoggedIn: boolean
    pointName: string
    currentUserPoints: number
    gifts: SiteTippingGiftItem[]
    allowedAmounts: number[]
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

function buildEntrySummary(record: {
  summary: string | null
  contentText: string | null
}) {
  const rawValue = record.summary?.trim() || record.contentText?.trim() || ""
  const normalized = rawValue.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return null
  }

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized
}

function normalizeSourceIds(sourceIds: string[] | null | undefined, availableSourceIds: Set<string>) {
  if (!sourceIds?.length) {
    return []
  }

  return Array.from(new Set(sourceIds.map((value) => value.trim()).filter((value) => value && availableSourceIds.has(value))))
}

export async function getRssUniverseFeedPage(
  page: number,
  pageSize: number,
  sourceIds?: string[] | null,
  viewerUserId?: number | null,
): Promise<RssUniverseFeedPageData> {
  const [allSources, settings, currentUser] = await Promise.all([
    listAllPublicRssSources(),
    getSiteSettings(),
    viewerUserId
      ? prisma.user.findUnique({
          where: { id: viewerUserId },
          select: { points: true },
        })
      : Promise.resolve(null),
  ])
  const runtimeStates = await listRssSourceRuntimeStates(allSources.map((source) => source.id))
  const enabledSources = allSources.filter((source) => runtimeStates.get(source.id)?.enabled)
  const publicSources = enabledSources
  const sourceStats = await countApprovedRssEntriesBySourceIds(publicSources.map((source) => source.id))
  const sourceStatsById = new Map(sourceStats.map((item) => [item.sourceId, item]))
  const availableSources = publicSources.map((source) => {
    const stats = sourceStatsById.get(source.id)
    const latestEntryAt = stats?._max.publishedAt ?? stats?._max.createdAt ?? null
    return {
      id: source.id,
      siteName: source.siteName,
      description: source.description ?? null,
      logoPath: source.logoPath ?? null,
      entryCount: stats?._count._all ?? 0,
      latestEntryAt: latestEntryAt?.toISOString() ?? null,
    }
  })
  if (availableSources.length === 0) {
    return {
      items: [],
      availableSources: [],
      activeSource: null,
      support: {
        enabled: settings.tippingEnabled,
        isLoggedIn: Boolean(viewerUserId),
        pointName: settings.pointName,
        currentUserPoints: currentUser?.points ?? 0,
        gifts: settings.tippingGifts,
        allowedAmounts: settings.tippingAmounts,
      },
      pagination: {
        page: 1,
        pageSize,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      },
    }
  }
  const normalizedSourceIds = normalizeSourceIds(sourceIds, new Set(availableSources.map((source) => source.id)))
  const effectiveSourceIds = normalizedSourceIds.length > 0 ? normalizedSourceIds : availableSources.map((source) => source.id)
  const total = await countPublicRssEntries(effectiveSourceIds)
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)
  const records = await listPublicRssEntries(pagination.skip, pagination.pageSize, effectiveSourceIds)
  const viewerLikes = await listPublicRssEntryViewerLikes(records.map((record) => record.id), viewerUserId)
  const viewerLikedEntryIds = new Set(viewerLikes.map((item) => item.entryId))
  const activeSource = normalizedSourceIds.length === 1
    ? availableSources.find((source) => source.id === normalizedSourceIds[0]) ?? null
    : null

  return {
    items: records.map((record) => ({
      id: record.id,
      sourceId: record.sourceId,
      sourceName: record.source.siteName,
      sourceLogoPath: record.source.logoPath ?? null,
      title: record.title,
      author: record.author ?? null,
      summary: buildEntrySummary(record),
      linkUrl: normalizeExternalUrl(record.linkUrl ?? null),
      publishedAt: record.publishedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      likeCount: record.likeCount,
      tipCount: record.tipCount,
      tipTotalPoints: record.tipTotalPoints,
      viewerLiked: viewerLikedEntryIds.has(record.id),
    })),
    availableSources,
    activeSource,
    support: {
      enabled: settings.tippingEnabled,
      isLoggedIn: Boolean(viewerUserId),
      pointName: settings.pointName,
      currentUserPoints: currentUser?.points ?? 0,
      gifts: settings.tippingGifts,
      allowedAmounts: settings.tippingAmounts,
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
