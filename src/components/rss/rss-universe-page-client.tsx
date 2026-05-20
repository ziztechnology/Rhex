"use client"

import Image from "next/image"
import { ArrowLeft, FileText, Globe2, Plus, Rss } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"

import { RssUniverseFeedView } from "@/components/rss/rss-universe-feed-view"
import { FormModal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { getAvatarUrl } from "@/lib/avatar"
import { formatRelativeTime } from "@/lib/formatters"
import { buildHomeFeedHref } from "@/lib/home-feed-route"
import type { RssUniverseFeedPageData } from "@/lib/rss-public-feed"
import { cn } from "@/lib/utils"

type UniverseTab = "articles" | "sources"

function buildPageTokens(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)
  const result: Array<number | "ellipsis"> = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? result.at(-1) as number : null
    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }
    result.push(current)
  }

  return result
}

function buildUniverseApiUrl(page: number, sourceId: string | null) {
  const searchParams = new URLSearchParams({
    page: String(Math.max(1, Math.trunc(page))),
  })

  if (sourceId) {
    searchParams.set("sourceIds", sourceId)
  }

  return `/api/rss-universe?${searchParams.toString()}`
}

async function readUniverseFeedPage(page: number, sourceId: string | null) {
  const response = await fetch(buildUniverseApiUrl(page, sourceId), {
    method: "GET",
    cache: "no-store",
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message ?? "宇宙栏目加载失败")
  }

  return result.data as RssUniverseFeedPageData
}

function buildUniversePageHref(page: number, sourceId: string | null) {
  const baseHref = buildHomeFeedHref("universe", page)
  if (!sourceId) {
    return baseHref
  }

  const separator = baseHref.includes("?") ? "&" : "?"
  return `${baseHref}${separator}source=${encodeURIComponent(sourceId)}`
}

function syncUniversePageUrl(page: number, sourceId: string | null) {
  if (typeof window === "undefined") {
    return
  }

  window.history.replaceState(window.history.state, "", buildUniversePageHref(page, sourceId))
}

function RssUniverseLoading() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-4">
          <div className="flex gap-3">
            <div className="size-11 rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-4/5 rounded-full bg-muted" />
              <div className="h-3 w-2/5 rounded-full bg-muted" />
              <div className="h-3 w-full rounded-full bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function RssUniversePageClient({
  initialPage,
  initialSourceId,
}: {
  initialPage: number
  initialSourceId?: string | null
}) {
  const [data, setData] = useState<RssUniverseFeedPageData | null>(null)
  const [activeTab, setActiveTab] = useState<UniverseTab>("articles")
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [applicationDraft, setApplicationDraft] = useState({ siteName: "", description: "", feedUrl: "" })
  const [isPending, startTransition] = useTransition()
  const initializedRef = useRef(false)

  const activeSource = useMemo(
    () => selectedSourceId ? data?.availableSources.find((source) => source.id === selectedSourceId) ?? null : null,
    [data?.availableSources, selectedSourceId],
  )

  const loadPage = useCallback(async (page: number, sourceId: string | null, options?: { scrollToTop?: boolean }) => {
    setLoading(true)
    setErrorMessage("")
    try {
      const nextData = await readUniverseFeedPage(page, sourceId)
      const nextSourceId = nextData.activeSource?.id ?? null
      setData(nextData)
      setSelectedSourceId(nextSourceId)
      syncUniversePageUrl(nextData.pagination.page, nextSourceId)
      if (options?.scrollToTop !== false && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "宇宙栏目加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current) {
      return
    }

    initializedRef.current = true
    void loadPage(initialPage, initialSourceId?.trim() || null, { scrollToTop: false })
  }, [initialPage, initialSourceId, loadPage])

  function openSource(sourceId: string) {
    setActiveTab("articles")
    void loadPage(1, sourceId)
  }

  function resetSource() {
    void loadPage(1, null)
  }

  function submitApplication() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/rss-universe/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(applicationDraft),
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? "提交失败")
        }

        setApplicationOpen(false)
        setApplicationDraft({ siteName: "", description: "", feedUrl: "" })
        toast.success(result.message ?? "申请已提交，等待后台审核", "提交成功")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "提交失败，请稍后重试", "提交失败")
      }
    })
  }

  if (!data) {
    return (
      <>
        <RssUniverseLoading />
        {errorMessage ? (
          <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
      </>
    )
  }

  const pageTokens = buildPageTokens(data.pagination.page, data.pagination.totalPages)

  return (
    <>
      <div className="border-b border-border bg-background px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              <button
                type="button"
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-colors", activeTab === "articles" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setActiveTab("articles")}
              >
                <FileText data-icon="inline-start" />
                文章
              </button>
              <button
                type="button"
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-colors", activeTab === "sources" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setActiveTab("sources")}
              >
                <Rss data-icon="inline-start" />
                入驻博客
              </button>
            </div>
            <Button type="button" className="h-9 rounded-full px-3 text-xs" onClick={() => setApplicationOpen(true)}>
              <Plus data-icon="inline-start" />
              申请收录
            </Button>
          </div>

          {activeSource ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe2 data-icon="inline-start" />
                  <span>{activeSource.siteName}</span>
                </div>
                {activeSource.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{activeSource.description}</p> : null}
              </div>
              <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={loading} onClick={resetSource}>
                <ArrowLeft data-icon="inline-start" />
                查看全部
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn("py-4 transition-opacity", loading ? "opacity-70" : "opacity-100")}>
        {activeTab === "articles" ? (
          <>
            <RssUniverseFeedView items={data.items} support={data.support} />

            {data.items.length === 0 ? (
              <div className="mx-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">
                {activeSource ? "这个 RSS 源还没有可展示的采集内容。" : "宇宙栏目还没有可展示的采集内容。"}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mx-4 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {data.pagination.totalPages > 1 ? (
              <nav className="flex flex-col items-center gap-3 pt-5" aria-label="pagination">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" variant="outline" className="h-9 px-4 text-xs" disabled={!data.pagination.hasPrevPage || loading} onClick={() => void loadPage(data.pagination.page - 1, selectedSourceId)}>上一页</Button>
                  {pageTokens.map((token, index) => token === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={token}
                      type="button"
                      variant={token === data.pagination.page ? "default" : "outline"}
                      className="h-9 min-w-9 px-3 text-xs"
                      disabled={loading || token === data.pagination.page}
                      onClick={() => void loadPage(token, selectedSourceId)}
                    >
                      {token}
                    </Button>
                  ))}
                  <Button type="button" variant="outline" className="h-9 px-4 text-xs" disabled={!data.pagination.hasNextPage || loading} onClick={() => void loadPage(data.pagination.page + 1, selectedSourceId)}>下一页</Button>
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <div className="grid gap-3 px-4 sm:grid-cols-2">
            {data.availableSources.map((source) => {
              const logoUrl = getAvatarUrl(source.logoPath, source.siteName)
              const latest = source.latestEntryAt ? formatRelativeTime(source.latestEntryAt) : "暂无文章"

              return (
                <article key={source.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                      <Image src={logoUrl} alt={`${source.siteName} logo`} fill sizes="44px" className="object-cover" unoptimized />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="truncate text-sm font-semibold">{source.siteName}</h2>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{source.entryCount} 篇</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">最近更新 {latest}</p>
                      {source.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{source.description}</p> : null}
                      <Button type="button" variant="outline" className="mt-4 h-8 rounded-full px-3 text-xs" disabled={loading} onClick={() => openSource(source.id)}>
                        查看文章
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <FormModal
        open={applicationOpen}
        title="申请收录 RSS"
        description="提交后进入后台审核，通过后会创建并启用 RSS 抓取源。"
        size="lg"
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        onClose={() => setApplicationOpen(false)}
        onSubmit={(event) => {
          event.preventDefault()
          submitApplication()
        }}
        footer={({ formId }) => (
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setApplicationOpen(false)}>取消</Button>
            <Button type="submit" form={formId} disabled={isPending}>{isPending ? "提交中..." : "提交申请"}</Button>
          </div>
        )}
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">博客名称</span>
            <input value={applicationDraft.siteName} onChange={(event) => setApplicationDraft((current) => ({ ...current, siteName: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 outline-hidden" />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">描述</span>
            <textarea value={applicationDraft.description} onChange={(event) => setApplicationDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-lg border border-border bg-background px-3 py-2 outline-hidden" />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">RSS 地址</span>
            <input type="url" value={applicationDraft.feedUrl} onChange={(event) => setApplicationDraft((current) => ({ ...current, feedUrl: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 outline-hidden" />
          </label>
        </div>
      </FormModal>
    </>
  )
}
