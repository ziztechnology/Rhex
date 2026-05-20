"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, type CSSProperties } from "react"

import { ExternalSearchOptions } from "@/components/external-search-options"
import { LevelIcon } from "@/components/level-icon"
import type { SiteSearchSettings } from "@/lib/site-search-settings"
import { normalizeHeaderAppIconName, type SiteHeaderAppIconItem, type SiteHeaderAppLinkItem, HEADER_APP_ICON_OPTIONS } from "@/lib/site-header-app-links"



interface SearchFormProps {
  defaultValue?: string
  compact?: boolean
  appLinks?: SiteHeaderAppLinkItem[]
  appIconName?: string
  search?: SiteSearchSettings
  externalOptionsInline?: boolean
  onNavigate?: () => void
  onExternalSearchSelect?: () => void
}

function HeaderAppTriggerIcon({ name, className }: { name: string; className?: string }) {
  const normalizedName = normalizeHeaderAppIconName(name)
  const matchedOption = HEADER_APP_ICON_OPTIONS.find((item: SiteHeaderAppIconItem) => item.value === normalizedName)
  const Icon = matchedOption?.icon ?? HEADER_APP_ICON_OPTIONS[0]!.icon
  return <Icon className={className} />
}

export function SearchForm({
  defaultValue = "",
  compact = false,
  appLinks = [],
  appIconName = "grid",
  search = {
    enabled: true,
    externalEngines: [],
  },
  externalOptionsInline = false,
  onNavigate,
  onExternalSearchSelect,
}: SearchFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const desktopAppsMenuRef = useRef<HTMLDivElement | null>(null)
  const externalSearchMenuRef = useRef<HTMLDivElement | null>(null)
  const [keyword, setKeyword] = useState(defaultValue)
  const [desktopAppsMenuOpen, setDesktopAppsMenuOpen] = useState(false)
  const [externalSearchMenuOpen, setExternalSearchMenuOpen] = useState(false)
  const hasDesktopApps = compact && appLinks.length > 0
  const searchEnabled = search.enabled
  const externalSearchEngines = search.externalEngines


  useEffect(() => {
    if (!desktopAppsMenuOpen && !externalSearchMenuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!desktopAppsMenuRef.current?.contains(target)) {
        setDesktopAppsMenuOpen(false)
      }
      if (!externalSearchMenuRef.current?.contains(target)) {
        setExternalSearchMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDesktopAppsMenuOpen(false)
        setExternalSearchMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [desktopAppsMenuOpen, externalSearchMenuOpen])

  function handleKeywordChange(nextValue: string) {
    setKeyword(nextValue)

    if (!searchEnabled) {
      setDesktopAppsMenuOpen(false)
      setExternalSearchMenuOpen(Boolean(nextValue.trim()))
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault()

    const nextKeyword = keyword.trim()
    const params = new URLSearchParams(searchParams.toString())
    params.delete("after")
    params.delete("before")
    params.delete("page")

    if (!nextKeyword) {
      setExternalSearchMenuOpen(false)
      params.delete("q")
      onNavigate?.()
      router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`)
      return
    }

    if (!searchEnabled) {
      setDesktopAppsMenuOpen(false)
      setExternalSearchMenuOpen(true)
      return
    }

    setExternalSearchMenuOpen(false)
    params.set("q", nextKeyword)
    onNavigate?.()
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`)
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "relative w-full" : "relative w-full max-w-2xl"}>
      <div className={compact ? "relative" : "flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-foreground transition-colors focus-within:border-foreground/20"}>
        {compact ? (
          <>
            {hasDesktopApps ? (
              <div ref={desktopAppsMenuRef} className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2">
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => {
                    setExternalSearchMenuOpen(false)
                    setDesktopAppsMenuOpen((current) => !current)
                  }}
                  aria-expanded={desktopAppsMenuOpen}
                  aria-haspopup="menu"
                  aria-label="打开应用菜单"
                >
                  <HeaderAppTriggerIcon name={appIconName} className="h-4 w-4" />
                </button>
                {desktopAppsMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] w-64 rounded-2xl border border-border bg-background p-2 shadow-2xl">
                    <div className="px-3 pb-2 pt-1 text-xs font-medium text-muted-foreground">应用入口</div>
                    <div className="grid gap-1">
                      {appLinks.map((item) => {
                        const isExternal = /^https?:\/\//i.test(item.href)
                        const hasIcon = item.icon.trim().length > 0
                        const linkStyle: CSSProperties = {
                          ...(item.textColor ? { color: item.textColor } : {}),
                          ...(item.bold ? { fontWeight: 700 } : {}),
                          ...(item.fontSizePx ? { fontSize: `${item.fontSizePx}px` } : {}),
                        }
                        const iconStyle: CSSProperties = {
                          color: item.iconColor || item.textColor || "currentColor",
                        }


                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noreferrer noopener" : undefined}
                            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
                            style={linkStyle}
                            onClick={() => setDesktopAppsMenuOpen(false)}
                          >
                            {hasIcon ? (
                              <span className="flex size-8 items-center justify-center rounded-xl bg-muted text-muted-foreground" style={iconStyle}>
                                <LevelIcon icon={item.icon} className="size-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name} />
                              </span>
                            ) : null}

                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${hasDesktopApps ? "left-10" : "left-3"}`} />
            <input
              value={keyword}
              onChange={(event) => handleKeywordChange(event.target.value)}
              className={`h-9 w-full rounded-full border border-border bg-muted/50 py-2 pr-4 text-sm focus:outline-hidden focus:ring-primary ${hasDesktopApps ? "pl-16" : "pl-10"}`}
              placeholder={searchEnabled ? "搜索节点、帖子、用户..." : "输入关键词后选择 Google 或 Bing"}
              maxLength={50}
              type="search"
            />
          </>
        ) : (

          <>
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(event) => handleKeywordChange(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
              placeholder={searchEnabled ? "搜索节点、帖子、作者" : "输入关键词后选择 Google 或 Bing"}
              maxLength={50}
              type="search"
            />
            <button type="submit" className="shrink-0 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              {searchEnabled ? "搜索" : "继续搜索"}
            </button>
          </>
        )}
      </div>
      {!searchEnabled && externalSearchMenuOpen ? (
        <div
          ref={externalSearchMenuRef}
          className={externalOptionsInline
            ? (compact
                ? "mt-2 rounded-2xl border border-border bg-background p-2 shadow-2xl"
                : "mt-3 rounded-xl border border-border bg-background p-3 shadow-soft")
            : (compact
                ? "absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-border bg-background p-2 shadow-2xl"
                : "absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-xl border border-border bg-background p-3 shadow-soft")}
        >
          <div className={compact ? "px-3 pb-2 pt-1 text-xs font-medium text-muted-foreground" : "px-2 pb-3 text-xs font-medium text-muted-foreground"}>
            站内搜索已关闭，请选择外部搜索引擎
          </div>
          <ExternalSearchOptions
            keyword={keyword}
            engines={externalSearchEngines}
            onSelect={() => {
              setExternalSearchMenuOpen(false)
              onExternalSearchSelect?.()
            }}
            variant={compact ? "menu" : "panel"}
          />
        </div>
      ) : null}
    </form>
  )
}
