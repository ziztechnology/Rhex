"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition, type CSSProperties } from "react"

import { SettingsInputField, SettingsSection, SettingsToggleField } from "@/components/admin/admin-settings-fields"
import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { IconPicker } from "@/components/ui/icon-picker"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import type { FooterLinkItem } from "@/lib/site-settings"

interface AdminFooterLinksSettingsFormProps {
  initialLinks: FooterLinkItem[]
}

type FooterLinkEditableKey = keyof Pick<
  FooterLinkItem,
  "label" | "href" | "icon" | "textColor" | "iconColor" | "bold" | "fontSizePx"
>

const FOOTER_LINK_COLOR_PRESETS = ["#111827", "#374151", "#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

function createEmptyLink(): FooterLinkItem {
  return { label: "", href: "", icon: "" }
}

export function AdminFooterLinksSettingsForm({ initialLinks }: AdminFooterLinksSettingsFormProps) {
  const router = useRouter()
  const [links, setLinks] = useState<FooterLinkItem[]>(initialLinks.length > 0 ? initialLinks : [createEmptyLink()])
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const normalizedPreview = useMemo(
    () => links
      .map((item) => ({ ...item, label: item.label.trim(), href: item.href.trim(), icon: (item.icon ?? "").trim() }))
      .filter((item) => item.label || item.href),
    [links],
  )

  function updateLink(index: number, key: FooterLinkEditableKey, value: string | boolean) {
    setLinks((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)))
  }

  function addLink() {
    setLinks((current) => [...current, createEmptyLink()])
  }

  function removeLink(index: number) {
    setLinks((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyLink()]
    })
  }

  function getPreviewStyle(item: FooterLinkItem): CSSProperties {
    return {
      ...(item.textColor ? { color: item.textColor } : {}),
      ...(item.bold ? { fontWeight: 700 } : {}),
      ...(item.fontSizePx ? { fontSize: `${item.fontSizePx}px` } : {}),
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const result = await saveAdminSiteSettings({
            section: "site-footer-links",
            footerLinks: links,
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <SettingsSection
        title="页脚导航链接"
        description="用于控制前台页脚的链接名称、跳转地址、图标与外观样式。支持站内路径，也支持完整外链地址。"
      >

        <div className="flex flex-col gap-3">
          {links.map((item, index) => (
            <div key={`footer-link-${index}`} className="rounded-2xl bg-muted/35 p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1fr)_minmax(280px,1.45fr)_auto] xl:items-end">
                <IconPicker
                  label="图标"
                  value={item.icon ?? ""}
                  onChange={(value) => updateLink(index, "icon", value)}
                  popoverTitle="选择页脚图标"
                  containerClassName="flex flex-col gap-2"
                  triggerClassName="flex h-11 w-full items-center gap-3 rounded-[18px] border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                  textareaRows={5}
                  placeholder="可留空，或输入 emoji / SVG / 图片 URL"
                  description="支持留空、emoji、符号，或粘贴完整 SVG。"
                  allowEmpty
                />
                <SettingsInputField label="显示名称" value={item.label} onChange={(value) => updateLink(index, "label", value)} placeholder="如 关于我们" />
                <SettingsInputField label="跳转地址" value={item.href} onChange={(value) => updateLink(index, "href", value)} placeholder="如 /about 或 https://example.com/about" />
                <div className="flex items-end xl:pb-0.5">
                  <Button type="button" variant="outline" onClick={() => removeLink(index)} className="h-11 rounded-full px-4">删除</Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 md:grid-cols-2 xl:grid-cols-4">
                <ColorPicker
                  label="文字颜色"
                  value={item.textColor ?? ""}
                  onChange={(value) => updateLink(index, "textColor", value)}
                  presets={FOOTER_LINK_COLOR_PRESETS}
                  fallbackColor="#6b7280"
                  placeholder="默认"
                  allowClear
                />
                <ColorPicker
                  label="图标颜色"
                  value={item.iconColor ?? ""}
                  onChange={(value) => updateLink(index, "iconColor", value)}
                  presets={FOOTER_LINK_COLOR_PRESETS}
                  fallbackColor="#6b7280"
                  placeholder="跟随文字"
                  allowClear
                />
                <SettingsInputField
                  label="字号(px)"
                  value={item.fontSizePx ?? ""}
                  onChange={(value) => updateLink(index, "fontSizePx", value)}
                  placeholder="默认 14"
                  type="number"
                />
                <SettingsToggleField
                  label="文字加粗"
                  checked={Boolean(item.bold)}
                  onChange={(checked) => updateLink(index, "bold", checked)}
                  className="min-h-20"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={addLink} className="rounded-full">新增链接</Button>
        </div>

        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-medium text-foreground">预览</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {normalizedPreview.length > 0 ? normalizedPreview.map((item) => {
              const hasIcon = item.icon.trim().length > 0
              const iconStyle: CSSProperties = {
                color: item.iconColor || item.textColor || "currentColor",
              }

              return (
                <span key={`${item.label}-${item.href}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground" style={getPreviewStyle(item)}>
                  {hasIcon ? (
                    <span className="inline-flex size-4 shrink-0 items-center justify-center" style={iconStyle}>
                      <LevelIcon icon={item.icon} className="size-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.label || "页脚图标预览"} />
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </span>
              )
            }) : <span>暂无可展示链接</span>}
          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存页脚导航"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}
