"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/rbutton"
import { cn } from "@/lib/utils"

interface NotificationListItemProps {
  id: string
  href: string
  isRead: boolean
  typeLabel: string
  title: string
  content: string
  senderName: string
  createdAt: string
}

export function NotificationListItem({ id, href, isRead, typeLabel, title, content, senderName, createdAt }: NotificationListItemProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    if (isRead || isPending) {
      return
    }

    event.preventDefault()

    setIsPending(true)

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: id }),
      })

      if (!response.ok) {
        return
      }

      window.location.assign(href)
    } finally {
      setIsPending(false)
    }
  }

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch("/api/notifications/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: id }),
      })

      if (!response.ok) {
        return
      }

      router.refresh()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <article
      className={cn(
        "rounded-xl border p-4 transition-colors hover:bg-accent/40",
        isRead
          ? "border-border bg-card"
          : "border-emerald-200/70 bg-emerald-50/45 dark:border-emerald-500/15 dark:bg-emerald-500/[0.07] dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/[0.1]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">{typeLabel}</span>
          {!isRead ? <span className="rounded-full bg-rose-100/90 px-2 py-1 text-xs text-rose-700 dark:bg-rose-400/12 dark:text-rose-200">未读</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{createdAt}</span>
          <Button type="button" variant="ghost" size="icon-sm" disabled={isDeleting} aria-label="删除通知" title="删除通知" onClick={handleDelete}>
            <Trash2 data-icon="inline-start" />
          </Button>
        </div>
      </div>
      <a href={href} onClick={handleClick} className="mt-3 block rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{content}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>来源：{senderName}</span>
          <span>{isDeleting ? "删除中..." : isPending ? "跳转中..." : "点击查看详情"}</span>
        </div>
      </a>
    </article>
  )
}
