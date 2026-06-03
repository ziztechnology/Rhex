import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { LevelIcon } from "@/components/level-icon"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/rbutton"
import { UserAvatar } from "@/components/user/user-avatar"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { getBoards } from "@/lib/boards"
import { formatNumber } from "@/lib/formatters"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { getVerificationTypeDetailBySlug } from "@/lib/verifications"
import { getZones } from "@/lib/zones"

export const dynamic = "force-dynamic"

type VerificationDetailPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    user?: string | string[]
  }>
}

export async function generateMetadata(props: VerificationDetailPageProps): Promise<Metadata> {
  const { slug } = await props.params
  const [settings, verification] = await Promise.all([
    getSiteSettings(),
    getVerificationTypeDetailBySlug(slug),
  ])

  if (!verification) {
    return {
      title: `认证不存在 - ${settings.siteName}`,
    }
  }

  return {
    title: `${verification.name} - ${settings.siteName}`,
    description: verification.description?.trim() || `查看 ${verification.name} 的认证说明、申请要求与当前已认证人数。`,
    alternates: {
      canonical: `/verifications/${verification.slug}`,
    },
  }
}

export default async function VerificationDetailPage(props: VerificationDetailPageProps) {
  const { slug } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const requestedUsername = readSearchParam(searchParams?.user)?.trim() || null
  const settingsPromise = getSiteSettings()
  const currentUserPromise = getCurrentUser()
  const verificationPromise = getVerificationTypeDetailBySlug(slug, { username: requestedUsername })
  const [settings, boards, zones, currentUser, announcements, verification] = await Promise.all([
    settingsPromise,
    getBoards(),
    getZones(),
    currentUserPromise,
    getHomeAnnouncements(3),
    verificationPromise,
  ])

  if (!verification) {
    notFound()
  }

  const [sidebarUser, hotTopics] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount),
  ])
  const settingsHref = "/settings?tab=verifications"
  const applyHref = currentUser
    ? settingsHref
    : buildLoginHrefWithRedirect(settingsHref)
  const applicationCost = verification.pointsCost > 0
    ? `${formatNumber(verification.pointsCost)} ${settings.pointName}`
    : "免费申请"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="mt-6 pb-12">
              <div className="flex flex-col gap-6">
                <section className="rounded-xl border border-border bg-card px-5 py-6 shadow-xs sm:px-7 sm:py-8">
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Verification Detail
                    </p>
                    <div
                      className="mx-auto mt-5 flex h-28 w-fit min-w-28 max-w-full items-center justify-center rounded-[32px] px-5 text-6xl sm:h-32 sm:min-w-32 sm:px-6"
                      style={{
                        color: verification.color,
                        background: `linear-gradient(180deg, ${verification.color}20, ${verification.color}10)`,
                      }}
                    >
                      <LevelIcon
                        icon={verification.iconText}
                        color={verification.color}
                        className="h-14 min-w-14 max-w-full text-[56px] sm:h-16 sm:min-w-16 sm:text-[64px]"
                        emojiClassName="text-inherit"
                        svgClassName="[&>svg]:block"
                      />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                        认证标识 {verification.slug}
                      </span>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                        {verification.status ? "开放申请" : "已停用"}
                      </span>
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                      {verification.name}
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                      {verification.description?.trim() || "该认证用于展示用户在社区内的身份、资质或业务属性。"}
                    </p>
                    <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                      <VerificationStatCard label="已认证人数" value={`${formatNumber(verification.approvedUserCount)} 人`} />
                      <VerificationStatCard label="申请成本" value={applicationCost} />
                      <VerificationStatCard label="公开展示" value="个性描述" />
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <Link href={applyHref}>
                        <Button className="rounded-full px-5">
                          {currentUser ? "前往认证中心" : "登录后申请"}
                        </Button>
                      </Link>
                      <Link href="/faq/verification-system">
                        <Button variant="outline" className="rounded-full px-5">
                          查看认证规则
                        </Button>
                      </Link>
                    </div>
                  </div>
                </section>
                {verification.featuredApplication ? (
                  <VerificationApplicationCard
                    verification={{
                      name: verification.name,
                      color: verification.color,
                      iconText: verification.iconText,
                    }}
                    application={verification.featuredApplication}
                  />
                ) : requestedUsername ? (
                  <section className="rounded-xl border border-border bg-card px-5 py-5 shadow-xs sm:px-6">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-semibold text-foreground">未找到该用户的认证资料</h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        @{requestedUsername} 当前没有通过 {verification.name} 认证，或该认证资料已经变更。
                      </p>
                    </div>
                  </section>
                ) : null}
              </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
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
            </aside>
          )}
        />
      </div>
    </div>
  )
}

function VerificationApplicationCard({
  verification,
  application,
}: {
  verification: {
    name: string
    color: string
    iconText: string
  }
  application: NonNullable<Awaited<ReturnType<typeof getVerificationTypeDetailBySlug>>>["featuredApplication"]
}) {
  if (!application) {
    return null
  }

  const effectiveIcon = application.customIconText?.trim() || verification.iconText
  const customDescription = application.customDescription?.trim()

  return (
    <section className="rounded-xl border border-border bg-card px-5 py-6 shadow-xs sm:px-7">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <UserAvatar
              name={application.user.displayName}
              avatarPath={application.user.avatarPath}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                User Verification
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {application.user.displayName} 的{verification.name}
              </h2>
              <Link
                href={`/users/${application.user.username}`}
                className="mt-1 inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                @{application.user.username}
              </Link>
            </div>
          </div>
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl border text-[34px]"
            style={{
              color: verification.color,
              borderColor: `${verification.color}40`,
              backgroundColor: `${verification.color}10`,
            }}
          >
            <LevelIcon
              icon={effectiveIcon}
              color={verification.color}
              className="h-10 min-w-10 max-w-full text-[34px]"
              emojiClassName="text-inherit"
              svgClassName="[&>svg]:block"
            />
          </div>
        </div>

        {customDescription ? (
          <div className="rounded-xl border border-border bg-background/70 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              个性描述
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {customDescription}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-background/70 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              个性描述
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              暂未设置个性描述
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function VerificationStatCard({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-base font-semibold text-foreground">
        {value}
      </div>
    </div>
  )
}
