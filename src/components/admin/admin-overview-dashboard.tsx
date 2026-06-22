import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bookmark,
  CheckCircle2,
  CreditCard,
  Eye,
  ExternalLink,
  FileText,
  Heart,
  Info,
  KeyRound,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Rss,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/rbutton"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip } from "@/components/ui/tooltip"
import { formatAdminCommentPreview } from "@/lib/admin-comment-preview"
import type { AdminDashboardData } from "@/lib/admin-dashboard"
import { getAdminSettingsHref } from "@/lib/admin-settings-navigation"
import { getAvatarFallback } from "@/lib/avatar"
import { formatMonthDayTime, formatNumber } from "@/lib/formatters"
import { getCanonicalPostPath } from "@/lib/post-links"
import { cn } from "@/lib/utils"

interface AdminOverviewDashboardProps {
  data: AdminDashboardData
}

export function AdminOverviewDashboard({
  data,
}: AdminOverviewDashboardProps) {
  return (
    <>
      <section className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3 2xl:grid-cols-6">
        <CompactStatCard
          title="注册用户"
          value={data.overview.userCount}
          icon={<Users className="h-4 w-4" />}
          hint={`近 7 天 +${formatNumber(data.overview.newUserCount7d)}`}
        />
        <CompactStatCard
          title="帖子总数"
          value={data.overview.postCount}
          icon={<FileText className="h-4 w-4" />}
          hint={`近 7 天 +${formatNumber(data.overview.newPostCount7d)}`}
          tone="emerald"
        />
        <CompactStatCard
          title="评论总数"
          value={data.overview.commentCount}
          icon={<MessageSquare className="h-4 w-4" />}
          hint={`近 7 天 +${formatNumber(data.overview.newCommentCount7d)}`}
          tone="violet"
        />
        <CompactStatCard
          title="活跃用户"
          value={data.overview.activeUserCount7d}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="近 7 天登录 / 发帖 / 评论活跃"
          tone="sky"
        />
        <CompactStatCard
          title="节点数量"
          value={data.overview.boardCount}
          icon={<LayoutGrid className="h-4 w-4" />}
          hint={`分区 ${formatNumber(data.overview.zoneCount)} 个`}
        />
        <CompactStatCard
          title="风控用户"
          value={data.overview.mutedUserCount + data.overview.bannedUserCount}
          icon={<Ban className="h-4 w-4" />}
          hint={`禁言 ${formatNumber(data.overview.mutedUserCount)} / 封禁 ${formatNumber(data.overview.bannedUserCount)}`}
          tone="slate"
        />
      </section>

      <section className="rounded-[22px] border border-border/70 bg-muted/20 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-semibold text-foreground">数据面板</h2>
            <p className="mt-1 text-xs text-muted-foreground">把运营数据按主题分组，手机端减少纵向滚动。</p>
          </div>
          <Badge variant="secondary" className="rounded-full">4 组</Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-4">
        <OverviewMetricPanel
          title="内容脉冲"
          description="看新增和产出节奏"
          items={[
            {
              label: "今日发帖",
              value: data.overview.todayPostCount,
              hint: `近 7 天 +${formatNumber(data.overview.newPostCount7d)}`,
            },
            {
              label: "今日评论",
              value: data.overview.todayCommentCount,
              hint: `近 7 天 +${formatNumber(data.overview.newCommentCount7d)}`,
            },
            {
              label: "今日签到",
              value: data.overview.todayCheckInUserCount,
              hint: "按业务日统计",
            },
          ]}
        />
        <OverviewMetricPanel
          title="互动规模"
          description="看社区热度和沉淀"
          items={[
            {
              label: "总浏览量",
              value: data.overview.totalViewCount,
              icon: <Eye className="h-3.5 w-3.5" />,
            },
            {
              label: "总点赞量",
              value: data.overview.totalLikeCount,
              icon: <Heart className="h-3.5 w-3.5" />,
            },
            {
              label: "总收藏量",
              value: data.overview.totalFavoriteCount,
              icon: <Bookmark className="h-3.5 w-3.5" />,
            },
            {
              label: "节点关注量",
              value: data.overview.totalFollowerCount,
              icon: <Users className="h-3.5 w-3.5" />,
            },
          ]}
        />
        <OverviewMetricPanel
          title="风险处置"
          description="看举报流转和内容状态"
          items={[
            {
              label: "待处理",
              value: data.overview.pendingReportCount,
              tone: "rose",
            },
            {
              label: "处理中",
              value: data.overview.processingReportCount,
              tone: "amber",
            },
            {
              label: "已解决",
              value: data.overview.resolvedReportCount,
              tone: "emerald",
            },
            {
              label: "下线帖子",
              value: data.overview.offlinePostCount,
              tone: "slate",
            },
          ]}
        />
        <OverviewMetricPanel
          title="用户状态"
          description="看可运营用户质量"
          items={[
            {
              label: "活跃用户",
              value: data.overview.activeUserCount7d,
              hint: "近 7 天活跃",
            },
            {
              label: "禁言用户",
              value: data.overview.mutedUserCount,
              tone: "amber",
            },
            {
              label: "封禁用户",
              value: data.overview.bannedUserCount,
              tone: "rose",
            },
            {
              label: "今日举报",
              value: data.overview.todayReportCount,
              tone: "slate",
            },
          ]}
        />
        </div>
      </section>

      <div className="grid gap-4 rounded-[22px] border border-border/70 bg-muted/20 p-3 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>近 7 天增长趋势</CardTitle>
            <CardDescription>用户、帖子、评论和举报的波峰波谷。</CardDescription>
            <CardAction>
              <Badge variant="secondary">最近 7 天</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <TrendLegend />
            <DashboardTrendChart data={data.trends} />
          </CardContent>
          <CardFooter className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <TrendSummaryItem
              label="新增用户峰值"
              value={getTrendPeak(data.trends, "userCount")}
              colorClassName="bg-sky-500"
            />
            <TrendSummaryItem
              label="新增帖子峰值"
              value={getTrendPeak(data.trends, "postCount")}
              colorClassName="bg-emerald-500"
            />
            <TrendSummaryItem
              label="新增评论峰值"
              value={getTrendPeak(data.trends, "commentCount")}
              colorClassName="bg-violet-500"
            />
            <MetricHighlightCard
              title="今日签到人数"
              value={data.overview.todayCheckInUserCount}
              description="按业务日统计的签到独立用户"
              compact
            />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>运营待办</CardTitle>
            <CardDescription>优先处理高影响的审核与处置任务。</CardDescription>
            <CardAction>
              <Badge variant="secondary">10 项待看</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
            <PendingReviewCard
              href="/admin?tab=board-applications"
              title="待审核节点"
              value={data.overview.pendingBoardApplicationCount}
              description="审核用户提交的节点申请与分区归属"
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href="/admin?tab=verifications&verificationSubTab=reviews"
              title="待认证审核"
              value={data.overview.pendingVerificationCount}
              description="处理用户身份与资质认证申请"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href={`${getAdminSettingsHref("oauth", "clients")}?status=PENDING`}
              title="OAuth 待审核"
              value={data.overview.pendingOAuthClientCount}
              description="审核用户提交的 OAuth 应用接入申请"
              icon={<KeyRound className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href={`${getAdminSettingsHref("oauth", "payment")}?status=PENDING`}
              title="Pay 待审核"
              value={data.overview.pendingPaymentApplicationCount}
              description="审核用户提交的 Payment 应用收款申请"
              icon={<CreditCard className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href={getAdminSettingsHref("friend-links")}
              title="友情链接审核"
              value={data.overview.pendingFriendLinkCount}
              description="审核站点互链申请与展示资料"
              icon={<Shield className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href="/admin/apps/rss-harvest/applications"
              title="RSS 源审核"
              value={data.overview.pendingRssSourceApplicationCount}
              description="审核用户提交的 RSS 博客收录申请"
              icon={<Rss className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href="/admin/apps/self-serve-ads"
              title="广告审核"
              value={data.overview.pendingAdOrderCount}
              description="审核自助推广广告位申请内容"
              icon={<Megaphone className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href="/admin?tab=reports"
              title="举报待处理"
              value={data.overview.pendingReportCount}
              description="社区风险内容与违规行为处置"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href="/admin?tab=posts&status=PENDING"
              title="待审核帖子"
              value={data.overview.pendingPostCount}
              description="人工复核待发布内容"
              icon={<FileText className="h-3.5 w-3.5" />}
            />
            <PendingReviewCard
              href="/admin?tab=comments&status=PENDING"
              title="待审核评论"
              value={data.overview.pendingCommentCount}
              description="处理命中规则或待人工复核的评论"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 rounded-[22px] border border-border/70 bg-muted/20 p-3 xl:grid-cols-[1.15fr_0.85fr]">
        <RecentPostsCard posts={data.recentPosts} />
        <RecentCommentsCard comments={data.recentComments} />
      </div>
    </>
  )
}

function CompactStatCard({
  title,
  value,
  icon,
  hint,
  tone = "default",
}: {
  title: string
  value: number
  icon: React.ReactNode
  hint: string
  tone?: "default" | "sky" | "emerald" | "violet" | "rose" | "amber" | "slate"
}) {
  const toneClassName = {
    default: "bg-accent text-foreground",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    slate:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
  }[tone]

  return (
    <Card size="sm" className="min-w-[168px] snap-start overflow-hidden border-border/70 bg-card shadow-xs sm:min-w-0">
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl font-semibold leading-none">
            {formatNumber(value)}
          </p>
          <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">
            {hint}
          </p>
        </div>
        <Badge
          className={cn(
            "h-9 w-9 shrink-0 justify-center rounded-xl border-transparent p-0",
            toneClassName
          )}
        >
          {icon}
        </Badge>
      </CardContent>
    </Card>
  )
}

function OverviewMetricPanel({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: Array<{
    label: string
    value: number
    hint?: string
    icon?: React.ReactNode
    tone?: "default" | "rose" | "amber" | "emerald" | "slate"
  }>
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        {items.map((item, index) => (
          <div key={item.label}>
            {index > 0 ? <Separator className="my-3" /> : null}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{item.label}</p>
                {item.hint ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.hint}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.icon ? (
                  <span className="text-muted-foreground">{item.icon}</span>
                ) : null}
                <Badge
                  className={cn(
                    "h-6 min-w-14 justify-center rounded-full border-transparent px-2.5 text-sm font-semibold",
                    getOverviewMetricBadgeClassName(item.tone)
                  )}
                >
                  {formatNumber(item.value)}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PendingReviewCard({
  href,
  title,
  value,
  description,
  icon,
}: {
  href: string
  title: string
  value: number
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      title={description}
      className="block rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="h-full transition-colors hover:bg-muted/35">
        <CardContent className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-medium leading-5">{title}</p>
              <Tooltip content={description}>
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80"
                  aria-label={description}
                >
                  <Info className="h-3 w-3" />
                </span>
              </Tooltip>
            </div>
            <p className="mt-1.5 text-2xl font-semibold leading-none">
              {formatNumber(value)}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="h-8 w-8 shrink-0 justify-center rounded-xl p-0 text-foreground"
          >
            {icon}
          </Badge>
        </CardContent>
        <CardFooter className="justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
          <span className="line-clamp-1">{description}</span>
          <ArrowRight className="size-3.5 shrink-0" />
        </CardFooter>
      </Card>
    </Link>
  )
}

function MetricHighlightCard({
  title,
  value,
  description,
  compact = false,
}: {
  title: string
  value: number
  description: string
  compact?: boolean
}) {
  return (
    <Card
      size="sm"
      className="border border-dashed border-border/80 bg-background/70 py-0 ring-0"
    >
      <CardContent className={cn(compact ? "py-3.5" : "py-4")}>
        <p className="text-sm font-medium">{title}</p>
        <p
          className={cn(
            "mt-2 font-semibold",
            compact ? "text-2xl" : "text-3xl"
          )}
        >
          {formatNumber(value)}
        </p>
        <p
          className={cn(
            "text-xs leading-6 text-muted-foreground",
            compact ? "mt-2" : "mt-3"
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

function TrendLegend() {
  const items = [
    { label: "用户", colorClassName: "bg-sky-500" },
    { label: "帖子", colorClassName: "bg-emerald-500" },
    { label: "评论", colorClassName: "bg-violet-500" },
    { label: "举报", colorClassName: "bg-rose-500" },
  ]

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <Badge
          key={item.label}
          variant="outline"
          className="gap-2 rounded-full bg-background/70 px-2.5 font-normal text-muted-foreground"
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", item.colorClassName)} />
          <span>{item.label}</span>
        </Badge>
      ))}
    </div>
  )
}

function TrendSummaryItem({
  label,
  value,
  colorClassName,
}: {
  label: string
  value: { count: number; dateLabel: string }
  colorClassName: string
}) {
  return (
    <Card size="sm" className="bg-background/80 py-0">
      <CardContent className="py-3.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", colorClassName)} />
          <p className="text-sm font-medium">{label}</p>
        </div>
        <p className="mt-3 text-2xl font-semibold">{formatNumber(value.count)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          峰值日期：{value.dateLabel}
        </p>
      </CardContent>
    </Card>
  )
}

function DashboardTrendChart({
  data,
}: {
  data: Array<{
    date: string
    userCount: number
    postCount: number
    commentCount: number
    reportCount: number
  }>
}) {
  const width = 720
  const height = 220
  const paddingX = 28
  const paddingTop = 16
  const paddingBottom = 24
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [
      item.userCount,
      item.postCount,
      item.commentCount,
      item.reportCount,
    ])
  )
  const labels = data.map((item) => formatChartDate(item.date))
  const drawableHeight = height - paddingTop - paddingBottom

  const createPath = (values: number[]) =>
    values
      .map((value, index) => {
        const x =
          paddingX +
          (index * (width - paddingX * 2)) / Math.max(values.length - 1, 1)
        const y =
          height - paddingBottom - (value / maxValue) * drawableHeight
        return `${index === 0 ? "M" : "L"}${x},${y}`
      })
      .join(" ")

  const series = [
    { key: "userCount", color: "#0ea5e9", path: createPath(data.map((item) => item.userCount)) },
    { key: "postCount", color: "#10b981", path: createPath(data.map((item) => item.postCount)) },
    { key: "commentCount", color: "#8b5cf6", path: createPath(data.map((item) => item.commentCount)) },
    { key: "reportCount", color: "#f43f5e", path: createPath(data.map((item) => item.reportCount)) },
  ]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - paddingBottom - ratio * drawableHeight
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
            )
          })}
          {labels.map((label, index) => {
            const x =
              paddingX +
              (index * (width - paddingX * 2)) / Math.max(labels.length - 1, 1)
            return (
              <g key={label}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={height - paddingBottom}
                  stroke="currentColor"
                  strokeOpacity="0.04"
                />
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {label}
                </text>
              </g>
            )
          })}
          {series.map((item) => (
            <path
              key={item.key}
              d={item.path}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

function getTrendPeak(
  data: Array<{
    date: string
    userCount: number
    postCount: number
    commentCount: number
    reportCount: number
  }>,
  key: "userCount" | "postCount" | "commentCount" | "reportCount"
) {
  const peak = data.reduce(
    (best, current) => (current[key] > best[key] ? current : best),
    data[0] ?? {
      date: "",
      userCount: 0,
      postCount: 0,
      commentCount: 0,
      reportCount: 0,
    }
  )

  return {
    count: peak[key] ?? 0,
    dateLabel: peak.date ? formatChartDate(peak.date) : "-",
  }
}

function formatChartDate(value: string) {
  return value.slice(5, 10)
}

function RecentPostsCard({
  posts,
}: {
  posts: AdminDashboardData["recentPosts"]
}) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle>最近帖子</CardTitle>
        <CardDescription>最新进入后台视野的帖子内容。</CardDescription>
        <CardAction>
          <OverviewSectionActionLink href="/admin?tab=posts" label="帖子管理" />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {posts.length === 0 ? (
          <OverviewEmptyState
            title="还没有最新帖子"
            description="帖子内容会在这里按最近进入后台的顺序展示。"
            href="/admin?tab=posts"
            actionLabel="前往帖子管理"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>帖子</TableHead>
                <TableHead className="w-[190px]">状态</TableHead>
                <TableHead className="w-[96px]">互动</TableHead>
                <TableHead className="w-[128px] text-right">时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const postPath = getCanonicalPostPath({ slug: post.slug })

                return (
                  <TableRow key={post.id}>
                    <TableCell className="align-top">
                      <div className="flex items-start gap-3">
                        <Avatar size="sm" className="mt-0.5 rounded-lg">
                          <AvatarFallback className="rounded-lg">
                            {getInitials(post.authorName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Tooltip
                            content={post.title}
                            className="w-full"
                            disabled={post.title.length < 16}
                          >
                            <Link
                              href={postPath}
                              className="block line-clamp-1 text-sm font-medium transition-colors hover:text-primary"
                            >
                              {post.title}
                            </Link>
                          </Tooltip>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{post.boardName}</span>
                            <span>·</span>
                            <span>{post.authorName}</span>
                          </div>
                          {post.reviewNote ? (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              审核备注：{post.reviewNote}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        <Badge className={getPostStatusBadgeClassName(post.status)}>
                          {post.statusLabel}
                        </Badge>
                        <Badge variant="outline">{post.typeLabel}</Badge>
                        {post.isPinned ? (
                          <Badge className="border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">
                            置顶
                          </Badge>
                        ) : null}
                        {post.isFeatured ? (
                          <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                            推荐
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      <div className="space-y-1">
                        <p>评论 {formatNumber(post.commentCount)}</p>
                        <p>点赞 {formatNumber(post.likeCount)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {formatMonthDayTime(post.createdAt)}
                        </span>
                        <Link
                          href={postPath}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-7 px-2 text-xs"
                          )}
                        >
                          前台
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function RecentCommentsCard({
  comments,
}: {
  comments: AdminDashboardData["recentComments"]
}) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle>最近评论</CardTitle>
        <CardDescription>最近触达后台的评论与回复。</CardDescription>
        <CardAction>
          <OverviewSectionActionLink href="/admin?tab=comments" label="评论管理" />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {comments.length === 0 ? (
          <OverviewEmptyState
            title="还没有最新评论"
            description="最新评论会在这里展示，方便快速进入处理。"
            href="/admin?tab=comments"
            actionLabel="前往评论管理"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>评论内容</TableHead>
                <TableHead>帖子</TableHead>
                <TableHead className="w-[96px]">状态</TableHead>
                <TableHead className="w-[128px] text-right">时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map((comment) => {
                const commentPath = `${getCanonicalPostPath({ slug: comment.postSlug })}#comment-${comment.id}`
                const content = comment.content || "无评论内容"

                return (
                  <TableRow key={comment.id}>
                    <TableCell className="align-top">
                      <div className="flex items-start gap-3">
                        <Avatar size="sm" className="mt-0.5 rounded-lg">
                          <AvatarFallback className="rounded-lg">
                            {getInitials(comment.authorName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Tooltip
                            content={content}
                            className="w-full"
                            disabled={content.length < 18}
                          >
                            <span className="block line-clamp-2 text-sm text-foreground/90">
                              {formatAdminCommentPreview(content)}
                            </span>
                          </Tooltip>
                          <p className="mt-1 text-xs text-muted-foreground">
                            评论人：{comment.authorName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Tooltip
                        content={comment.postTitle}
                        className="w-full"
                        disabled={comment.postTitle.length < 16}
                      >
                        <Link
                          href={commentPath}
                          className="block line-clamp-1 text-sm font-medium transition-colors hover:text-primary"
                        >
                          {comment.postTitle}
                        </Link>
                      </Tooltip>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        /posts/{comment.postSlug}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge className={getCommentStatusBadgeClassName(comment.status)}>
                        {getCommentStatusLabel(comment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {formatMonthDayTime(comment.createdAt)}
                        </span>
                        <Link
                          href={commentPath}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-7 px-2 text-xs"
                          )}
                        >
                          前台
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function OverviewEmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string
  description: string
  href: string
  actionLabel: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <OverviewSectionActionLink href={href} label={actionLabel} />
    </div>
  )
}

function OverviewSectionActionLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "w-fit gap-1.5 rounded-full shadow-xs"
      )}
    >
      {label}
      <ArrowRight className="size-3.5" />
    </Link>
  )
}

function getInitials(name: string) {
  return getAvatarFallback(name)
}

function getOverviewMetricBadgeClassName(
  tone: "default" | "rose" | "amber" | "emerald" | "slate" = "default"
) {
  return {
    default: "bg-accent text-foreground",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
  }[tone]
}

function getPostStatusBadgeClassName(status: string) {
  if (status === "PENDING") {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }

  if (status === "OFFLINE") {
    return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }

  if (status === "LOCKED") {
    return "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
  }

  return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}

function getCommentStatusBadgeClassName(status: string) {
  if (status === "NORMAL") {
    return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
  }

  if (status === "PENDING") {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }

  if (status === "HIDDEN") {
    return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }

  return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}

function getCommentStatusLabel(status: string) {
  if (status === "NORMAL") {
    return "正常"
  }

  if (status === "PENDING") {
    return "待审核"
  }

  if (status === "HIDDEN") {
    return "已隐藏"
  }

  return status
}
