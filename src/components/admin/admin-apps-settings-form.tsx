"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { SettingsInputField, SettingsSection, SettingsToggleField } from "@/components/admin/admin-settings-fields"
import { IconPicker } from "@/components/ui/icon-picker"
import { ColorPicker } from "@/components/ui/color-picker"
import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import { HEADER_APP_ICON_OPTIONS, type SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"


type AppNavigationSettingsTab = "search" | "top"
type AppLinkEditableKey =
  | "name"
  | "href"
  | "icon"
  | "textColor"
  | "iconColor"
  | "activeTextColor"
  | "activeBackgroundColor"
  | "bold"
  | "fontSizePx"

interface AdminAppsSettingsFormProps {
  initialLinks: SiteHeaderAppLinkItem[]
  initialIconName: string
  initialTopLinks: SiteHeaderAppLinkItem[]
}

const TOP_NAV_COLOR_PRESETS = ["#111827", "#374151", "#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]
const TOP_NAV_BACKGROUND_PRESETS = ["#f3f4f6", "#e5e7eb", "#fee2e2", "#ffedd5", "#fef3c7", "#dcfce7", "#e0f2fe", "#dbeafe", "#ede9fe", "#fce7f3"]

function createEmptyAppLink(index: number, prefix = "app-link"): SiteHeaderAppLinkItem {
  return {
    id: `${prefix}-${index + 1}`,
    name: "",
    href: "",
    icon: "",
  }
}


export function AdminAppsSettingsForm({ initialLinks, initialIconName, initialTopLinks }: AdminAppsSettingsFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AppNavigationSettingsTab>("search")
  const [headerAppIconName, setHeaderAppIconName] = useState(initialIconName)
  const [searchLinks, setSearchLinks] = useState<SiteHeaderAppLinkItem[]>(initialLinks.length > 0 ? initialLinks : [createEmptyAppLink(0, "search-app-link")])
  const [topLinks, setTopLinks] = useState<SiteHeaderAppLinkItem[]>(initialTopLinks.length > 0 ? initialTopLinks : [createEmptyAppLink(0, "top-app-link")])
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const normalizedSearchPreview = useMemo(() => normalizePreviewLinks(searchLinks), [searchLinks])
  const normalizedTopPreview = useMemo(() => normalizePreviewLinks(topLinks), [topLinks])

  function updateSearchLink(index: number, key: AppLinkEditableKey, value: string | boolean) {
    setSearchLinks((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)))
  }

  function updateTopLink(index: number, key: AppLinkEditableKey, value: string | boolean) {
    setTopLinks((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)))
  }

  function addSearchLink() {
    setSearchLinks((current) => [...current, createEmptyAppLink(current.length, "search-app-link")])
  }

  function addTopLink() {
    setTopLinks((current) => [...current, createEmptyAppLink(current.length, "top-app-link")])
  }

  function removeSearchLink(index: number) {
    setSearchLinks((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyAppLink(0, "search-app-link")]
    })
  }

  function removeTopLink(index: number) {
    setTopLinks((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyAppLink(0, "top-app-link")]
    })
  }

  function renderLinkRows(
    items: SiteHeaderAppLinkItem[],
    updateLink: (index: number, key: AppLinkEditableKey, value: string | boolean) => void,
    removeLink: (index: number) => void,
    options: { appearance?: boolean } = {},
  ) {
    return (
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={`${item.id}-${index}`} className="rounded-2xl bg-muted/35 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1fr)_minmax(280px,1.45fr)_auto] xl:items-end">
              <div className="flex flex-col gap-2">
                <IconPicker
                  label="图标"
                  value={item.icon}
                  onChange={(value) => updateLink(index, "icon", value)}
                  popoverTitle="选择应用图标"
                  containerClassName="flex flex-col gap-2"
                  triggerClassName="flex h-11 w-full items-center gap-3 rounded-[18px] border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                  textareaRows={5}
                  placeholder="可留空，或输入 emoji / SVG / 图片 URL"
                  description="支持留空、emoji、符号，或粘贴完整 SVG。"
                  allowEmpty
                />
              </div>
              <SettingsInputField label="显示名称" value={item.name} onChange={(value) => updateLink(index, "name", value)} placeholder="如 每日幸运刮刮乐" />
              <SettingsInputField label="跳转地址" value={item.href} onChange={(value) => updateLink(index, "href", value)} placeholder="如 /apps/scratch-card 或 https://example.com" />
              <div className="flex items-end xl:pb-0.5">
                <Button type="button" variant="outline" onClick={() => removeLink(index)} className="h-11 rounded-full px-4">删除</Button>
              </div>
            </div>
            {options.appearance ? (
              <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 md:grid-cols-2 xl:grid-cols-6">
                <ColorPicker
                  label="文字颜色"
                  value={item.textColor ?? ""}
                  onChange={(value) => updateLink(index, "textColor", value)}
                  presets={TOP_NAV_COLOR_PRESETS}
                  fallbackColor="#111827"
                  placeholder="默认"
                  allowClear
                />
                <ColorPicker
                  label="图标颜色"
                  value={item.iconColor ?? ""}
                  onChange={(value) => updateLink(index, "iconColor", value)}
                  presets={TOP_NAV_COLOR_PRESETS}
                  fallbackColor="#111827"
                  placeholder="跟随文字"
                  allowClear
                />
                <ColorPicker
                  label="激活文字"
                  value={item.activeTextColor ?? ""}
                  onChange={(value) => updateLink(index, "activeTextColor", value)}
                  presets={TOP_NAV_COLOR_PRESETS}
                  fallbackColor="#111827"
                  placeholder="默认"
                  allowClear
                />
                <ColorPicker
                  label="激活背景"
                  value={item.activeBackgroundColor ?? ""}
                  onChange={(value) => updateLink(index, "activeBackgroundColor", value)}
                  presets={TOP_NAV_BACKGROUND_PRESETS}
                  fallbackColor="#f3f4f6"
                  placeholder="默认"
                  allowClear
                />
                <SettingsInputField
                  label="字号(px)"
                  value={item.fontSizePx ?? ""}
                  onChange={(value) => updateLink(index, "fontSizePx", value)}
                  placeholder="默认 16"
                  type="number"
                />
                <SettingsToggleField
                  label="文字加粗"
                  checked={Boolean(item.bold)}
                  onChange={(checked) => updateLink(index, "bold", checked)}
                  className="min-h-20"
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  function renderPreview(items: SiteHeaderAppLinkItem[]) {
    return (
      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-xs font-medium text-foreground">菜单预览</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {items.length > 0 ? items.map((item) => {
            const hasIcon = item.icon.trim().length > 0

            return (
              <div key={`${item.id}-${item.name}-${item.href}`} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
                {hasIcon ? (
                  <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <LevelIcon icon={item.icon} className="size-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name || "应用图标预览"} />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.name || "未命名应用"}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{item.href || "未配置链接"}</div>
                </div>
              </div>
            )
          }) : <span className="text-sm text-muted-foreground">暂无可展示应用</span>}

        </div>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const result = await saveAdminSiteSettings({
            section: "site-apps",
            headerAppIconName,
            headerAppLinks: searchLinks,
            topHeaderAppLinks: topLinks,
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AppNavigationSettingsTab)}
        className="w-full flex-col"
      >
        <TabsList className="self-start">
          <TabsTrigger value="search">PC 搜索框应用入口</TabsTrigger>
          <TabsTrigger value="top">顶部应用导航</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <SettingsSection
            title="PC 搜索框应用入口"
            description="配置 PC 端搜索框左侧应用图标及下拉菜单项。支持站内路径与完整外链，前台会自动读取并展示。"
          >

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">触发图标</span>
                <Select value={headerAppIconName} onValueChange={setHeaderAppIconName}>
                  <SelectTrigger className="h-11 rounded-xl bg-background px-4 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                  {HEADER_APP_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            {renderLinkRows(searchLinks, updateSearchLink, removeSearchLink, { appearance: true })}


            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={addSearchLink} className="rounded-full">新增搜索框应用</Button>
            </div>

            {renderPreview(normalizedSearchPreview)}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <SettingsSection
            title="顶部应用导航"
            description="配置桌面端顶部栏、主题切换按钮左侧的应用入口。适合放常用工具、活动页和独立应用。"
          >
            {renderLinkRows(topLinks, updateTopLink, removeTopLink, { appearance: true })}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={addTopLink} className="rounded-full">新增顶部导航</Button>
            </div>

            {renderPreview(normalizedTopPreview)}
          </SettingsSection>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存当前导航设置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}

function normalizePreviewLinks(items: SiteHeaderAppLinkItem[]) {
  return items
    .map((item) => ({ ...item, name: item.name.trim(), href: item.href.trim() }))
    .filter((item) => item.name || item.href)
}
