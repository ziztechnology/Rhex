"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"

import { LevelIcon } from "@/components/level-icon"
import type { SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"
import { cn } from "@/lib/utils"

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

function isActiveHref(pathname: string, href: string) {
  if (isExternalHref(href)) {
    return false
  }

  const normalizedHref = href.split(/[?#]/)[0] || "/"
  if (normalizedHref === "/") {
    return pathname === "/"
  }

  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`)
}

export function HeaderTopAppNavigation({ links }: { links: SiteHeaderAppLinkItem[] }) {
  const pathname = usePathname()

  if (links.length === 0) {
    return null
  }

  return (
    <nav aria-label="顶部应用导航" className="hidden min-w-0 max-w-[min(44vw,460px)] items-center gap-2 overflow-hidden lg:flex">
      {links.map((item) => {
        const external = isExternalHref(item.href)
        const active = isActiveHref(pathname, item.href)
        const hasIcon = item.icon.trim().length > 0
        const foregroundColor = active
          ? item.activeTextColor || item.textColor
          : item.textColor
        const linkStyle: CSSProperties = {
          ...(foregroundColor ? { color: foregroundColor } : {}),
          ...(active && item.activeBackgroundColor ? { backgroundColor: item.activeBackgroundColor } : {}),
          ...(item.bold ? { fontWeight: 700 } : {}),
          ...(item.fontSizePx ? { fontSize: `${item.fontSizePx}px` } : {}),
        }
        const iconStyle: CSSProperties = {
          color: item.iconColor || foregroundColor || "currentColor",
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer noopener" : undefined}
            className={cn(
              "inline-flex h-10 max-w-40 shrink-0 items-center gap-2 rounded-xl px-3 text-base font-medium leading-none text-foreground transition-colors hover:bg-muted",
              active ? "bg-muted" : "bg-transparent",
            )}
            style={linkStyle}
            aria-current={active ? "page" : undefined}
          >
            {hasIcon ? (
              <span className="inline-flex size-5 shrink-0 items-center justify-center text-foreground" style={iconStyle}>
                <LevelIcon icon={item.icon} className="size-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name} />
              </span>
            ) : null}
            <span className="min-w-0 truncate">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
