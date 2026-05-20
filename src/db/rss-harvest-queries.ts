import { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

const rssSettingSelect = {
  id: true,
  maxConcurrentJobs: true,
  maxRetryCount: true,
  retryBackoffSec: true,
  fetchTimeoutMs: true,
  maxResponseBytes: true,
  maxRedirects: true,
  failurePauseThreshold: true,
  homeDisplayEnabled: true,
  homePageSize: true,
  userAgent: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RssSettingSelect

const rssSourceAdminSelect = {
  id: true,
  siteName: true,
  description: true,
  feedUrl: true,
  logoPath: true,
  intervalMinutes: true,
  requiresReview: true,
  requestTimeoutMs: true,
  maxRetryCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RssSourceSelect

export type RssSettingRecord = Prisma.RssSettingGetPayload<{ select: typeof rssSettingSelect }>
export type RssSourceAdminRecord = Prisma.RssSourceGetPayload<{ select: typeof rssSourceAdminSelect }>

const rssSourceApplicationAdminSelect = {
  id: true,
  applicantId: true,
  siteName: true,
  description: true,
  feedUrl: true,
  status: true,
  reviewNote: true,
  reviewedById: true,
  reviewedAt: true,
  sourceId: true,
  createdAt: true,
  updatedAt: true,
  applicant: {
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarPath: true,
    },
  },
} satisfies Prisma.RssSourceApplicationSelect

export type RssSourceApplicationAdminRecord = Prisma.RssSourceApplicationGetPayload<{ select: typeof rssSourceApplicationAdminSelect }>

export async function getOrCreateRssSettingRecord() {
  const existing = await prisma.rssSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: rssSettingSelect,
  })

  if (existing) {
    return existing
  }

  return prisma.rssSetting.create({
    data: {},
    select: rssSettingSelect,
  })
}

export function updateRssSettingRecord(id: string, data: Prisma.RssSettingUpdateInput) {
  return prisma.rssSetting.update({
    where: { id },
    data,
    select: rssSettingSelect,
  })
}

export function listRssSourcesForAdmin() {
  return prisma.rssSource.findMany({
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
    select: rssSourceAdminSelect,
  })
}

export function countRssSources() {
  return prisma.rssSource.count()
}

export function listRssSourcesPage(skip: number, take: number) {
  return prisma.rssSource.findMany({
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take,
    select: rssSourceAdminSelect,
  })
}

export function findRssSourceById(id: string) {
  return prisma.rssSource.findUnique({
    where: { id },
    select: rssSourceAdminSelect,
  })
}

export function findRssSourceByFeedUrl(feedUrl: string) {
  return prisma.rssSource.findUnique({
    where: { feedUrl },
    select: rssSourceAdminSelect,
  })
}

export function createRssSourceRecord(data: Prisma.RssSourceCreateInput) {
  return prisma.rssSource.create({
    data,
    select: rssSourceAdminSelect,
  })
}

export function updateRssSourceRecord(id: string, data: Prisma.RssSourceUpdateInput) {
  return prisma.rssSource.update({
    where: { id },
    data,
    select: rssSourceAdminSelect,
  })
}

export function createManyRssEntries(data: Prisma.RssEntryCreateManyInput[]) {
  return prisma.rssEntry.createMany({
    data,
    skipDuplicates: true,
  })
}

export function countRssEntriesForSource(sourceId: string) {
  return prisma.rssEntry.count({
    where: { sourceId },
  })
}

export function countPendingRssSourceApplications() {
  return prisma.rssSourceApplication.count({
    where: { status: "PENDING" },
  })
}

export function listPendingRssSourceApplications(take = 20) {
  return prisma.rssSourceApplication.findMany({
    where: { status: "PENDING" },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    take,
    select: rssSourceApplicationAdminSelect,
  })
}

export function findPendingRssSourceApplicationByFeedUrl(feedUrl: string, applicantId?: number) {
  return prisma.rssSourceApplication.findFirst({
    where: {
      feedUrl,
      status: "PENDING",
      ...(applicantId ? { applicantId } : {}),
    },
    select: {
      id: true,
    },
  })
}
