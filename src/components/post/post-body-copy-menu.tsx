"use client"

import { useMemo, useState, type PointerEvent, type ReactNode } from "react"
import { Copy, Ellipsis, Eye, Flag } from "lucide-react"

import { FollowToggleButton } from "@/components/follow-toggle-button"
import { ReportDialog } from "@/components/post/report-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { copyTextToClipboard } from "@/lib/clipboard"
import { getPostPath } from "@/lib/post-links"
import type { PostLinkDisplayMode } from "@/lib/site-settings"
import { cn } from "@/lib/utils"

interface PostBodyCopyMenuProps {
  post: {
    id: string
    slug: string
  }
  postLinkDisplayMode?: PostLinkDisplayMode
  canReport?: boolean
  reportTargetId?: string
  reportLabel?: string
  initialFollowed?: boolean
  viewCount?: number
  children: ReactNode
}

export function PostBodyCopyMenu({ post, postLinkDisplayMode = "SLUG", canReport = false, reportTargetId, reportLabel = "当前帖子", initialFollowed, viewCount, children }: PostBodyCopyMenuProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const copyPath = useMemo(
    () => getPostPath(post, { mode: postLinkDisplayMode }),
    [post, postLinkDisplayMode],
  )
  const copyLink = useMemo(() => {
    if (typeof window === "undefined") {
      return copyPath
    }

    return `${window.location.origin}${copyPath}`
  }, [copyPath])

  async function handleCopyLink() {
    if (await copyTextToClipboard(copyLink)) {
      toast.success("已复制帖子链接", "复制成功")
      setIsMenuOpen(false)
      return
    }
    toast.error("复制失败，请手动复制", "复制失败")
  }

  function isProfilePreviewTrigger(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false
    }

    return Boolean(target.closest('[data-user-profile-preview-trigger="true"]'))
  }

  function handlePointerEnter(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") {
      return
    }

    setIsHovered(true)
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") {
      return
    }

    setIsHovered(false)
    setIsMenuOpen(false)
  }

  function handlePointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") {
      return
    }

    if (isProfilePreviewTrigger(event.target)) {
      setIsHovered(false)
      setIsMenuOpen(false)
      return
    }

    setIsHovered(true)
  }

  return (
    <div
      className="relative"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDownCapture={handlePointerDownCapture}
    >
      <div
        className={cn(
          "absolute right-4 top-4 z-20 flex items-start gap-1 rounded-full transition-opacity duration-150",
          isHovered ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {isMenuOpen ? (
          <div className="flex min-w-28 flex-col items-stretch gap-1 rounded-2xl border border-border bg-background/95 p-1 shadow-sm backdrop-blur-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="h-7 justify-start rounded-full px-2 text-xs"
            >
              <Copy data-icon="inline-start" />
              <span>复制链接</span>
            </Button>
            {typeof initialFollowed === "boolean" ? (
              <FollowToggleButton
                targetType="post"
                targetId={post.id}
                initialFollowed={initialFollowed}
                activeLabel="已关注帖子"
                inactiveLabel="关注帖子"
                showLabel
                variant="ghost"
                size="sm"
                className="h-7 justify-start rounded-full px-2 text-xs"
              />
            ) : null}
            {canReport && reportTargetId ? (
              <ReportDialog
                targetType="POST"
                targetId={reportTargetId}
                targetLabel={reportLabel}
                buttonText="举报帖子"
                icon={<Flag data-icon="inline-start" />}
                showLabelWithIcon
                buttonSize="sm"
                buttonClassName="h-7 justify-start rounded-full px-2 text-xs"
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="帖子操作"
            title="帖子操作"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((current) => !current)}
            className="rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm backdrop-blur-xs hover:text-foreground"
          >
            <Ellipsis />
          </Button>
          {typeof viewCount === "number" ? (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary/80 px-2.5 text-xs text-muted-foreground shadow-sm backdrop-blur-xs">
              <Eye className="h-3.5 w-3.5" />
              {viewCount}
            </span>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  )
}
