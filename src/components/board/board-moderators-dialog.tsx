"use client"

import Link from "next/link"
import { Settings, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user/user-avatar"
import type { BoardModeratorItem } from "@/lib/boards"
import { getPublicUserRoleBadgeLabel } from "@/lib/user-presentation"

interface BoardModeratorsActionsProps {
  boardName: string
  zoneModerators: BoardModeratorItem[]
  boardModerators: BoardModeratorItem[]
  managementHref?: string
}

function ModeratorPermissionBadges({ moderator }: { moderator: BoardModeratorItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline">{moderator.canEditSettings ? "可改设置" : "不可改设置"}</Badge>
      <Badge variant="outline">{moderator.canWithdrawTreasury ? "可提金库" : "不可提金库"}</Badge>
    </div>
  )
}

function ModeratorGroup({
  title,
  emptyText,
  moderators,
}: {
  title: string
  emptyText: string
  moderators: BoardModeratorItem[]
}) {
  return (
    <section className="rounded-xl border border-border/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <Badge variant="secondary" className="rounded-full">{moderators.length}</Badge>
      </div>
      {moderators.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {moderators.map((moderator) => {
            const roleLabel = getPublicUserRoleBadgeLabel(moderator)

            return (
              <Link
                key={`${moderator.source}-${moderator.id}`}
                href={`/users/${moderator.username}`}
                className="flex flex-col gap-3 rounded-[16px] border border-border px-3 py-2 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={moderator.displayName} avatarPath={moderator.avatarPath} size="xs" isVip={moderator.vipLevel > 0} vipLevel={moderator.vipLevel} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{moderator.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{moderator.username}{roleLabel ? ` · ${roleLabel}` : ""}
                    </p>
                  </div>
                </div>
                <ModeratorPermissionBadges moderator={moderator} />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function BoardModeratorsActions({
  boardName,
  zoneModerators,
  boardModerators,
  managementHref,
}: BoardModeratorsActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Dialog>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full"
              aria-label={`查看 ${boardName} 的版主`}
              title="查看版主"
            />
          }
        >
          <UsersRound data-icon="inline-start" />
          <span className="sr-only">查看版主</span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{boardName} 版主</DialogTitle>
            <DialogDescription>
              分区版主会继承管理当前节点，节点版主仅作用于当前节点。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <ModeratorGroup
              title="分区版主"
              emptyText="当前节点没有可继承的分区版主。"
              moderators={zoneModerators}
            />
            <ModeratorGroup
              title="节点版主"
              emptyText="当前节点暂未设置节点版主。"
              moderators={boardModerators}
            />
          </div>
        </DialogContent>
      </Dialog>
      {managementHref ? (
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href={managementHref} />}
          aria-label="进入后台管理当前节点"
          title="后台管理"
        >
          <Settings data-icon="inline-start" />
          <span className="sr-only">后台管理</span>
        </Button>
      ) : null}
    </div>
  )
}
