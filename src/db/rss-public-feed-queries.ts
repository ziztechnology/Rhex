import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

const rssPublicFeedSelect = {
  id: true,
  sourceId: true,
  title: true,
  author: true,
  summary: true,
  contentText: true,
  linkUrl: true,
  publishedAt: true,
  createdAt: true,
  likeCount: true,
  tipCount: true,
  tipTotalPoints: true,
  source: {
    select: {
      id: true,
      siteName: true,
      description: true,
      logoPath: true,
    },
  },
} satisfies Prisma.RssEntrySelect

export type RssPublicFeedRecord = Prisma.RssEntryGetPayload<{ select: typeof rssPublicFeedSelect }>

const rssPublicSourceSelect = {
  id: true,
  siteName: true,
  description: true,
  logoPath: true,
  createdAt: true,
} satisfies Prisma.RssSourceSelect

export type RssPublicSourceRecord = Prisma.RssSourceGetPayload<{ select: typeof rssPublicSourceSelect }>

function buildPublicRssFeedWhere(sourceIds: string[] = []) {
  return {
    reviewStatus: "APPROVED",
    ...(sourceIds.length > 0
      ? {
          sourceId: {
            in: sourceIds,
          },
        }
      : {}),
  } satisfies Prisma.RssEntryWhereInput
}

export function countPublicRssEntries(sourceIds: string[] = []) {
  return prisma.rssEntry.count({
    where: buildPublicRssFeedWhere(sourceIds),
  })
}

export function listPublicRssEntries(skip: number, take: number, sourceIds: string[] = []) {
  return prisma.rssEntry.findMany({
    where: buildPublicRssFeedWhere(sourceIds),
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take,
    select: rssPublicFeedSelect,
  })
}

export function listPublicRssEntryViewerLikes(entryIds: string[], userId?: number | null) {
  if (!userId || entryIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.rssEntryLike.findMany({
    where: {
      userId,
      entryId: {
        in: entryIds,
      },
    },
    select: {
      entryId: true,
    },
  })
}

export function listPublicRssSources() {
  return prisma.rssSource.findMany({
    where: {
      entries: {
        some: {
          reviewStatus: "APPROVED",
        },
      },
    },
    orderBy: [
      { siteName: "asc" },
      { id: "asc" },
    ],
    select: rssPublicSourceSelect,
  })
}

export function listAllPublicRssSources() {
  return prisma.rssSource.findMany({
    orderBy: [
      { siteName: "asc" },
      { id: "asc" },
    ],
    select: rssPublicSourceSelect,
  })
}

export function countApprovedRssEntriesBySourceIds(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.rssEntry.groupBy({
    by: ["sourceId"],
    where: {
      sourceId: {
        in: sourceIds,
      },
      reviewStatus: "APPROVED",
    },
    _count: {
      _all: true,
    },
    _max: {
      publishedAt: true,
      createdAt: true,
    },
  })
}
