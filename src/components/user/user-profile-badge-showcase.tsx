import Link from "next/link"
import { Trophy } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface UserProfileBadgeShowcaseItem {
  id: string
  code: string
  name: string
  description?: string | null
  color: string
  iconText?: string | null
}

interface UserProfileBadgeShowcaseProps {
  badges: UserProfileBadgeShowcaseItem[]
  className?: string
}

export function UserProfileBadgeShowcase({ badges, className }: UserProfileBadgeShowcaseProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-foreground">
        <Trophy className="h-4 w-4" />
        <h2 className="text-[15px] font-semibold">勋章</h2>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
          暂无可展示勋章
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-x-3 gap-y-4">
          {badges.map((badge) => (
            <Tooltip
              key={badge.id}
              side="top"
              content={
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="inline-flex size-5 items-center justify-center text-[13px]"
                      style={{ color: badge.color }}
                    >
                      <LevelIcon
                        icon={badge.iconText}
                        color={badge.color}
                        className="size-3.5 text-[14px]"
                        emojiClassName="text-inherit"
                        svgClassName="[&>svg]:block"
                      />
                    </span>
                    <span>{badge.name}</span>
                  </div>
                  <p className="text-[12px] font-medium leading-5">
                    {badge.description?.trim() || "该勋章暂未填写介绍。"}
                  </p>
                </div>
              }
              contentClassName="max-w-[240px]"
            >
              <Link href={`/badges/${badge.code}`} className="flex min-w-0 flex-col items-center gap-2 text-center">
                <div
                  className="flex size-12 shrink-0 items-center justify-center text-lg transition-transform hover:scale-[1.03]"
                  style={{ color: badge.color }}
                >
                  <LevelIcon
                    icon={badge.iconText}
                    color={badge.color}
                    className="size-7 text-[28px]"
                    emojiClassName="text-inherit"
                    svgClassName="[&>svg]:block"
                  />
                </div>
                <p className="w-full min-w-0 truncate text-[10px] font-semibold leading-4 text-muted-foreground">
                  {badge.name}
                </p>
              </Link>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  )
}
