"use client"

import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { copyTextToClipboard } from "@/lib/clipboard"

interface InviteLinkCopyButtonProps {
  path: string
}

function subscribeToOrigin() {
  return () => {}
}

function getOriginSnapshot() {
  return window.location.origin
}

export function InviteLinkCopyButton({ path }: InviteLinkCopyButtonProps) {
  const origin = useSyncExternalStore(subscribeToOrigin, getOriginSnapshot, () => "")
  const link = origin ? new URL(path, origin).toString() : path

  async function handleCopy() {
    try {
      const copyValue = origin ? link : new URL(path, window.location.origin).toString()
      if (await copyTextToClipboard(copyValue)) {
        toast.success("已复制邀请链接", "复制成功")
        return
      }
    } catch {
      // Fall through to the shared failure toast.
    }
    toast.error("复制失败，请手动复制", "复制失败")
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="break-all text-xs text-muted-foreground">{link}</span>
      <Button type="button" onClick={handleCopy} className="rounded-full">
        复制邀请链接
      </Button>
    </div>
  )
}
