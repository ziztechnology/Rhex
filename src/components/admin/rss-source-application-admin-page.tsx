"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { formatDateTime } from "@/lib/formatters"
import type { RssSourceApplicationAdminListItem, RssSourceApplicationAdminPageData } from "@/lib/rss-source-application-admin"

interface RssSourceApplicationAdminPageProps {
  initialData: RssSourceApplicationAdminPageData
}

const pageSizeOptions = [20, 50, 100]

export function RssSourceApplicationAdminPage({ initialData }: RssSourceApplicationAdminPageProps) {
  const router = useRouter()
  const [reviewTarget, setReviewTarget] = useState<RssSourceApplicationAdminListItem | null>(null)
  const [reviewAction, setReviewAction] = useState<"approve-source-application" | "reject-source-application" | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const baseQuery = useMemo(() => new URLSearchParams({
    keyword: initialData.filters.keyword,
    status: initialData.filters.status,
    pageSize: String(initialData.pagination.pageSize),
  }), [initialData.filters.keyword, initialData.filters.status, initialData.pagination.pageSize])

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("page", String(page))
    return `/admin/apps/rss-harvest/applications?${query.toString()}`
  }

  function openReviewModal(application: RssSourceApplicationAdminListItem, action: "approve-source-application" | "reject-source-application") {
    setReviewTarget(application)
    setReviewAction(action)
    setReviewNote(application.reviewNote ?? "")
  }

  function closeReviewModal() {
    if (isPending) {
      return
    }

    setReviewTarget(null)
    setReviewAction(null)
    setReviewNote("")
  }

  function submitReview() {
    if (!reviewTarget || !reviewAction) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/rss-harvest/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: reviewAction,
            applicationId: reviewTarget.id,
            reviewNote,
          }),
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? "操作失败")
        }

        toast.success(result.message ?? "操作成功", "操作成功")
        closeReviewModal()
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "操作失败", "操作失败")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">RSS 收录申请</h3>
            <p className="mt-1 text-sm text-muted-foreground">审核用户提交的 RSS 源，通过后会自动创建并启用抓取任务。</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/apps/rss-harvest">
              <Button type="button" variant="outline">返回抓取中心</Button>
            </Link>
            <Button type="button" variant="outline" onClick={() => router.refresh()}>刷新</Button>
          </div>
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(180px,1fr)_160px_120px_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索申请</span>
          <input name="keyword" defaultValue={initialData.filters.keyword} placeholder="博客名称 / 描述 / RSS 地址 / 申请人" className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
        </label>
        <CompactSelect name="status" label="审核状态" value={initialData.filters.status} options={[{ value: "ALL", label: "全部状态" }, { value: "PENDING", label: "待审核" }, { value: "APPROVED", label: "已通过" }, { value: "REJECTED", label: "已拒绝" }]} />
        <CompactSelect name="pageSize" label="每页" value={String(initialData.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">筛选</button>
          <Link href="/admin/apps/rss-harvest/applications" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">重置</Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="总申请" value={initialData.summary.total} />
        <StatCard label="待审核" value={initialData.summary.pending} />
        <StatCard label="已通过" value={initialData.summary.approved} />
        <StatCard label="已拒绝" value={initialData.summary.rejected} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
          <span>第 {initialData.pagination.page} / {initialData.pagination.totalPages} 页，共 {initialData.pagination.total} 条</span>
        </div>

        {initialData.applications.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有收录申请。</div> : null}

        <div className="divide-y divide-border">
          {initialData.applications.map((application) => (
            <article key={application.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1.5fr)_220px_130px_210px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{application.siteName}</span>
                  <ApplicationStatusBadge status={application.status} />
                </div>
                <p className="mt-2 break-all text-sm font-medium text-foreground">{application.feedUrl}</p>
                {application.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{application.description}</p> : null}
                {application.reviewNote ? <p className="mt-2 text-xs text-amber-700">审核备注：{application.reviewNote}</p> : null}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>申请人：{application.applicantName}</p>
                <p>提交时间：{formatDateTime(application.createdAt)}</p>
                <p>更新时间：{formatDateTime(application.updatedAt)}</p>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>审核人：{application.reviewerName ?? "暂无"}</p>
                <p>审核时间：{application.reviewedAt ? formatDateTime(application.reviewedAt) : "暂无"}</p>
                <p className="break-all">源 ID：{application.sourceId ?? "暂无"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {application.status === "PENDING" ? (
                  <>
                    <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => openReviewModal(application, "approve-source-application")}>通过</Button>
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => openReviewModal(application, "reject-source-application")}>拒绝</Button>
                  </>
                ) : null}
                {application.sourceId ? (
                  <Link href={`/admin/apps/rss-harvest?sourceId=${application.sourceId}`} className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-xs transition-colors hover:bg-accent hover:text-accent-foreground">
                    查看源
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {initialData.pagination.page} / {initialData.pagination.totalPages} 页</span>
            <span>每页 {initialData.pagination.pageSize} 条</span>
            <span>共 {initialData.pagination.total} 条申请</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={initialData.pagination.hasPrevPage ? buildPageHref(initialData.pagination.page - 1) : "#"} aria-disabled={!initialData.pagination.hasPrevPage} className={initialData.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "pointer-events-none inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40"}>上一页</Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{initialData.pagination.page}</span>
            <Link href={initialData.pagination.hasNextPage ? buildPageHref(initialData.pagination.page + 1) : "#"} aria-disabled={!initialData.pagination.hasNextPage} className={initialData.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "pointer-events-none inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40"}>下一页</Link>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(reviewTarget)}
        title={reviewAction === "approve-source-application" ? "通过收录申请" : "拒绝收录申请"}
        description={reviewTarget ? `处理 ${reviewTarget.siteName} 的 RSS 收录申请。` : undefined}
        size="md"
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        onClose={closeReviewModal}
        footer={(
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" disabled={isPending} onClick={closeReviewModal}>取消</Button>
            <Button type="button" disabled={isPending || !reviewTarget} onClick={submitReview}>{isPending ? "处理中..." : reviewAction === "approve-source-application" ? "通过" : "拒绝"}</Button>
          </div>
        )}
      >
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">审核备注</span>
          <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={5} className="w-full rounded-[16px] border border-border bg-background px-4 py-3 text-sm outline-hidden" />
        </label>
      </Modal>
    </div>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-hidden">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function ApplicationStatusBadge({ status }: { status: string }) {
  const className = status === "APPROVED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "REJECTED"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700"
  const label = status === "APPROVED" ? "已通过" : status === "REJECTED" ? "已拒绝" : "待审核"

  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{label}</span>
}
