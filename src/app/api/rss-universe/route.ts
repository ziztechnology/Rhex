import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getSessionActorFromRequest } from "@/lib/auth"
import { getRssHomeDisplaySettings } from "@/lib/rss-harvest"
import { getRssUniverseFeedPage } from "@/lib/rss-public-feed"

function parsePage(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1")
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

function parseSourceIds(request: Request) {
  const rawValue = new URL(request.url).searchParams.get("sourceIds") ?? ""
  if (!rawValue.trim()) {
    return []
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

export const GET = createRouteHandler(async ({ request }) => {
  const page = parsePage(request)
  const sourceIds = parseSourceIds(request)
  const [settings, currentUser] = await Promise.all([
    getRssHomeDisplaySettings(),
    getSessionActorFromRequest(request),
  ])
  const data = await getRssUniverseFeedPage(page, settings.homePageSize, sourceIds, currentUser?.id)

  return apiSuccess(data)
}, {
  errorMessage: "获取宇宙栏目失败",
  logPrefix: "[api/rss-universe] unexpected error",
})
