"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface AdminUserStatusModalProps {
  userId: number
  username: string
  action: "mute" | "ban"
}

export function AdminUserStatusModal({ userId, username, action }: AdminUserStatusModalProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [statusExpiresAt, setStatusExpiresAt] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const actionText = action === "ban" ? "拉黑" : "禁言"

  return (
    <>
      <Button type="button" variant={action === "ban" ? "default" : "outline"} className={action === "ban" ? "h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" : "h-7 rounded-full px-2.5 text-xs"} onClick={() => setOpen(true)}>
        {actionText}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`确认${actionText}用户`}
        description={`当前操作用户：@${username}`}
        footer={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={isPending}
              className={action === "ban" ? "h-9 rounded-full bg-red-600 px-4 text-xs text-white hover:bg-red-500" : "h-9 rounded-full px-4 text-xs"}
              onClick={() => {
                startTransition(async () => {
                  const response = await fetch("/api/admin/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: action === "ban" ? "user.ban" : "user.mute",
                      targetId: String(userId),
                      message,
                      statusExpiresAt: statusExpiresAt || null,
                      statusExpiresAtTimezoneOffsetMinutes: statusExpiresAt ? new Date().getTimezoneOffset() : null,
                    }),
                  })
                  if (response.ok) {
                    setOpen(false)
                    setStatusExpiresAt("")
                    router.refresh()
                  }
                })
              }}
            >
              {isPending ? "处理中..." : `确认${actionText}`}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">自动解除时间</span>
            <Input
              type="datetime-local"
              value={statusExpiresAt}
              onChange={(event) => setStatusExpiresAt(event.target.value)}
              className="h-10 rounded-full bg-background"
            />
            <span className="text-xs text-muted-foreground">不填写则永久{actionText}。</span>
          </label>
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`填写${actionText}原因（可选）`} className="min-h-[120px] rounded-xl bg-background px-4 py-3" />
        </div>
      </Modal>
    </>
  )
}

