import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight, Ban, ChevronLeft, ChevronRight, Clock3 } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { UserAvatar } from "@/components/user/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { prisma } from "@/db/client"
import { clearExpiredUserRestrictions } from "@/db/user-status-queries"
import { UserStatus } from "@/db/types"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { formatDateTime, serializeDate } from "@/lib/formatters"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserAvatarPath, getUserDisplayName } from "@/lib/user-display"
import { cn } from "@/lib/utils"
import { getZones } from "@/lib/zones"

export const metadata: Metadata = {
  title: "小黑屋",
  description: "查看当前被拉黑和禁言的用户名单。",
}

export const dynamic = "force-dynamic"

const PAGE_SIZE = 24

const statusTabs = [
  { key: "ALL", label: "全部名单", summary: "公开展示全部禁言与拉黑账号" },
  { key: "BANNED", label: "拉黑名单", summary: "只看当前已被拉黑的账号" },
  { key: "MUTED", label: "禁言名单", summary: "只看当前已被禁言的账号" },
] as const

type PrisonStatusFilter = (typeof statusTabs)[number]["key"]
type PaginationToken = number | "ellipsis"
type ModerationAction = "user.ban" | "user.mute"

function normalizeStatusFilter(value?: string): PrisonStatusFilter {
  if (value === "BANNED" || value === "MUTED") {
    return value
  }

  return "ALL"
}

function normalizePage(value?: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function buildPageTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: PaginationToken[] = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? (result.at(-1) as number) : null

    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }

    result.push(current)
  }

  return result
}

function buildPrisonHref(params: { status: PrisonStatusFilter; page?: number }) {
  const searchParams = new URLSearchParams()

  if (params.status !== "ALL") {
    searchParams.set("status", params.status)
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page))
  }

  const query = searchParams.toString()
  return query ? `/prison?${query}` : "/prison"
}

function getStatusMeta(status: UserStatus) {
  if (status === UserStatus.BANNED) {
    return {
      label: "已拉黑",
      statusLabel: "拉黑中",
      stamp: "封",
      tone: "danger" as const,
      action: "user.ban" as const,
      reasonLabel: "拉黑说明",
      fallbackReason: "因违反社区规范被管理员公开列入拉黑名单。",
    }
  }

  return {
    label: "已禁言",
    statusLabel: "禁言中",
    stamp: "禁",
    tone: "warning" as const,
    action: "user.mute" as const,
    reasonLabel: "禁言说明",
    fallbackReason: "因违反社区规范被管理员公开列入禁言名单。",
  }
}

function resolveModerationReason(detail: string | null | undefined, fallbackReason: string) {
  const reason = detail?.trim()

  if (!reason || reason === "管理员拉黑用户" || reason === "管理员禁言用户") {
    return fallbackReason
  }

  return reason
}

function resolveStatusCount(status: PrisonStatusFilter, counts: { mutedCount: number; bannedCount: number; totalCount: number }) {
  if (status === "BANNED") return counts.bannedCount
  if (status === "MUTED") return counts.mutedCount
  return counts.totalCount
}

function buildModerationLogMap(logs: Array<{ targetId: string | null; action: string; detail: string | null; createdAt: Date }>) {
  const result = new Map<string, Partial<Record<ModerationAction, { detail: string | null; createdAt: Date }>>>()

  for (const log of logs) {
    if (!log.targetId || (log.action !== "user.ban" && log.action !== "user.mute")) {
      continue
    }

    const current = result.get(log.targetId) ?? {}
    if (!current[log.action]) {
      current[log.action] = {
        detail: log.detail,
        createdAt: log.createdAt,
      }
      result.set(log.targetId, current)
    }
  }

  return result
}

export default async function PrisonPage(props: PageProps<"/prison">) {
  const searchParams = await props.searchParams
  const activeStatus = normalizeStatusFilter(readSearchParam(searchParams?.status))
  const requestedPage = normalizePage(readSearchParam(searchParams?.page))
  await clearExpiredUserRestrictions()
  const where = activeStatus === "ALL"
    ? { status: { in: [UserStatus.BANNED, UserStatus.MUTED] } }
    : { status: activeStatus === "BANNED" ? UserStatus.BANNED : UserStatus.MUTED }

  const settingsPromise = getSiteSettings()
  const hotTopicsPromise = settingsPromise.then((resolvedSettings) => getHomeSidebarHotTopics(resolvedSettings.homeSidebarHotTopicsCount))

  const [filteredCount, mutedCount, bannedCount, boards, zones, currentUser, hotTopics, settings, announcements] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { status: UserStatus.MUTED } }),
    prisma.user.count({ where: { status: UserStatus.BANNED } }),
    getBoards(),
    getZones(),
    getCurrentUser(),
    hotTopicsPromise,
    settingsPromise,
    getHomeAnnouncements(3),
  ])

  const totalCount = mutedCount + bannedCount
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  const skip = (page - 1) * PAGE_SIZE

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarPath: true,
      status: true,
      updatedAt: true,
    },
  })

  const moderationLogs = users.length === 0
    ? []
    : await prisma.adminLog.findMany({
        where: {
          targetType: "USER",
          targetId: { in: users.map((user) => String(user.id)) },
          action: { in: ["user.ban", "user.mute"] },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          targetId: true,
          action: true,
          detail: true,
          createdAt: true,
        },
      })

  const moderationLogMap = buildModerationLogMap(moderationLogs)
  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const cardUsers = users.map((user) => {
    const statusMeta = getStatusMeta(user.status)
    const moderationLog = moderationLogMap.get(String(user.id))?.[statusMeta.action]

    return {
      ...user,
      displayName: getUserDisplayName(user),
      avatarPath: getUserAvatarPath(user),
      statusMeta,
      moderationAt: moderationLog?.createdAt ?? user.updatedAt,
      reason: resolveModerationReason(moderationLog?.detail, statusMeta.fallbackReason),
    }
  })

  return (
    <div className="min-h-screen  text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="prison.page.before" />
        <AddonSurfaceRenderer surface="prison.page" props={{ activeStatus, users: cardUsers, page, totalPages, totalCount }}>
          <ForumPageShell
            zones={zones}
            boards={boards}
            main={(
              <main>
                <div>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20" />
                  <div className=" flex flex-col">
                    <AddonSlotRenderer slot="prison.hero.before" />
                    <AddonSurfaceRenderer surface="prison.hero" props={{ activeStatus, bannedCount, mutedCount, totalCount, users: cardUsers }}>
          &nbsp;
                    </AddonSurfaceRenderer>
                    <AddonSlotRenderer slot="prison.hero.after" />

                    <AddonSlotRenderer slot="prison.content.before" />
                    <AddonSurfaceRenderer surface="prison.content" props={{ activeStatus, users: cardUsers, page, totalPages }}>
                      <>
                        <section className="rounded-xl border border-border/60 bg-background/84 p-3 shadow-[0_12px_28px_hsl(var(--foreground)/0.06)] backdrop-blur-sm sm:p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                              {statusTabs.map((tab) => {
                                const active = tab.key === activeStatus
                                const href = buildPrisonHref({ status: tab.key })

                                return (
                                  <Link
                                    key={tab.key}
                                    href={href}
                                    className={cn(
                                      "min-w-[126px] rounded-[18px] border px-3 py-2.5 transition-all",
                                      active
                                        ? "border-foreground/20 bg-foreground text-background shadow-[0_10px_24px_hsl(var(--foreground)/0.16)]"
                                        : "border-border/70 bg-background/70 text-foreground hover:border-foreground/15 hover:bg-background",
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className={cn("text-sm font-semibold", active ? "text-background" : "text-foreground")}>{tab.label}</span>
                                      <span className={cn("text-xs", active ? "text-background/80" : "text-muted-foreground")}>
                                        {resolveStatusCount(tab.key, { mutedCount, bannedCount, totalCount })}
                                      </span>
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>

                            <div className="rounded-[18px] border border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                              共 {filteredCount} 人，当前第 {page} / {totalPages} 页
                            </div>
                          </div>
                        </section>

                        <section className="flex flex-col gap-4 mt-4">
                          {cardUsers.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-background/76 px-6 py-14 text-center shadow-[0_14px_40px_hsl(var(--foreground)/0.04)]">
                              <p className="text-base font-medium">当前筛选条件下暂无公开记录</p>
                              <p className="mt-2 text-sm text-muted-foreground">可以切换到其他名单，或稍后再来查看最新治理结果。</p>
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {cardUsers.map((user) => (
                                  <PrisonUserCard key={user.id} user={user} />
                                ))}
                              </div>
                              <PrisonPagination page={page} totalPages={totalPages} buildHref={(nextPage) => buildPrisonHref({ status: activeStatus, page: nextPage })} />
                            </>
                          )}
                        </section>
                      </>
                    </AddonSurfaceRenderer>
                    <AddonSlotRenderer slot="prison.content.after" />
                  </div>
                </div>
              </main>
            )}
            rightSidebar={(
              <aside className="mt-6 hidden pb-12 lg:block">
                <AddonSlotRenderer slot="prison.sidebar.before" />
                <AddonSurfaceRenderer surface="prison.sidebar" props={{ announcements, hotTopics, settings }}>
                  <div className="rounded-[26px]">
                    <HomeSidebarPanels
                      user={sidebarUser}
                      hotTopics={hotTopics}
                      announcements={announcements}
                      showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                      siteName={settings.siteName}
                      siteDescription={settings.siteDescription}
                      siteLogoPath={settings.siteLogoPath}
                      siteIconPath={settings.siteIconPath}
                    />
                  </div>
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="prison.sidebar.after" />
              </aside>
            )}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="prison.page.after" />
      </div>
    </div>
  )
}

function PrisonUserCard({
  user,
}: {
  user: {
    username: string
    displayName: string
    avatarPath: string | null
    moderationAt: Date
    reason: string
    statusMeta: ReturnType<typeof getStatusMeta>
  }
}) {
  return (
    <Card className="h-full rounded-[18px] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.12)_100%)] py-0 shadow-[0_10px_22px_hsl(var(--foreground)/0.08)] ring-0">
      <CardHeader className="px-3 pt-3">
        <div className="flex items-start gap-2.5">
          <div className="relative">
            <UserAvatar name={user.displayName} avatarPath={user.avatarPath} size="sm" />
            <div
              className={cn(
                "absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-destructive text-[10px] font-bold text-destructive-foreground shadow-[0_8px_16px_hsl(var(--destructive)/0.35)]",
                user.statusMeta.tone === "danger" ? "rotate-12" : "-rotate-6",
              )}
            >
              {user.statusMeta.stamp}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/users/${user.username}`} className="block truncate text-sm font-semibold tracking-tight text-foreground hover:text-primary">
                  {user.displayName}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock3 className="size-3 shrink-0" />
                  <span title={formatDateTime(user.moderationAt)}>处理时间:{serializeDate(user.moderationAt) ?? "-"}</span>
                  <Badge variant={user.statusMeta.tone === "danger" ? "destructive" : "secondary"} className="h-4 rounded-full px-1.5 text-[9px]">
                    {user.statusMeta.label}
                  </Badge>
                </div>
              </div>

              <Link href={`/users/${user.username}`} className="rounded-full border border-border/70 bg-background/80 p-1 text-muted-foreground transition-colors hover:border-foreground/15 hover:bg-background hover:text-foreground">
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        <div className="flex items-start gap-2 rounded-[12px] border border-border/70 bg-background/82 px-2.5 py-2">
          <Ban className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">{user.statusMeta.reasonLabel}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4.5 text-primary">{user.reason}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PrisonPagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}) {
  if (totalPages <= 1) {
    return null
  }

  const tokens = buildPageTokens(page, totalPages)

  return (
    <nav className="flex justify-center pt-2" aria-label="小黑屋分页">
      <div className="inline-flex items-center overflow-hidden rounded-[18px] border border-border/70 bg-background/86 shadow-[0_12px_30px_hsl(var(--foreground)/0.06)]">
        <PaginationStep href={page > 1 ? buildHref(page - 1) : "#"} disabled={page <= 1} ariaLabel="上一页">
          <ChevronLeft />
        </PaginationStep>

        {tokens.map((token, index) => token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="flex h-11 min-w-11 items-center justify-center border-l border-border/70 px-3 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <Link
            key={token}
            href={buildHref(token)}
            aria-current={token === page ? "page" : undefined}
            className={cn(
              "flex h-11 min-w-11 items-center justify-center border-l border-border/70 px-3 text-sm transition-colors",
              token === page
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground hover:bg-background",
            )}
          >
            {token}
          </Link>
        ))}

        <PaginationStep href={page < totalPages ? buildHref(page + 1) : "#"} disabled={page >= totalPages} ariaLabel="下一页">
          <ChevronRight />
        </PaginationStep>
      </div>
    </nav>
  )
}

function PaginationStep({
  href,
  disabled,
  ariaLabel,
  children,
}: {
  href: string
  disabled: boolean
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <Link
      href={disabled ? "#" : href}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "flex h-11 min-w-11 items-center justify-center px-3 transition-colors",
        disabled
          ? "pointer-events-none text-muted-foreground/50"
          : "text-foreground hover:bg-background",
      )}
    >
      {children}
    </Link>
  )
}
