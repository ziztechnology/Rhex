import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getSessionActorFromRequest } from "@/lib/auth"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { getCommentsByPostId } from "@/lib/comments"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { checkPostAccessPermission, mergeAccessPermissions, resolvePostAccessRequirements } from "@/lib/post-access"
import { isPublicReadablePostStatus } from "@/lib/post-types"
import { getSiteSettings } from "@/lib/site-settings"
import { canManageBoard, resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"

function readPage(searchParams: URLSearchParams) {
  const page = Number(searchParams.get("page") ?? "1")
  return Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1
}

function readSort(searchParams: URLSearchParams): "oldest" | "newest" {
  return searchParams.get("sort") === "newest" ? "newest" : "oldest"
}

function readViewMode(searchParams: URLSearchParams): "tree" | "flat" {
  return searchParams.get("view") === "flat" ? "flat" : "tree"
}

export const GET = createRouteHandler(async ({ request }) => {
  const requestUrl = new URL(request.url)
  const postId = requestUrl.searchParams.get("postId")?.trim() ?? ""

  if (!postId) {
    apiError(400, "缺少帖子参数")
  }

  const [currentUser, settings, boardAccessContext] = await Promise.all([
    getSessionActorFromRequest(request),
    getSiteSettings(),
    getBoardAccessContextByPostId(postId),
  ])

  if (!boardAccessContext) {
    apiError(404, "帖子不存在")
  }

  const adminActor = await resolveAdminActorFromSessionUser(currentUser)
  const canManageThisPost = Boolean(adminActor && canManageBoard(adminActor, boardAccessContext.board.id, boardAccessContext.board.zoneId))
  const isPostOwner = currentUser?.id === boardAccessContext.post.authorId
  const isOwnerOrManager = Boolean(isPostOwner || canManageThisPost)

  if (!isPublicReadablePostStatus(boardAccessContext.post.status) && !isOwnerOrManager) {
    apiError(404, "帖子不存在")
  }

  const canViewComments = Boolean(currentUser) || settings.guestCanViewComments
  if (!canViewComments) {
    apiError(403, "当前站点已关闭游客查看评论")
  }

  const viewPermission = checkBoardPermission(currentUser, boardAccessContext.settings, "view")
  const postViewPermission = checkPostAccessPermission(currentUser, resolvePostAccessRequirements(boardAccessContext.post))
  const mergedViewPermission = mergeAccessPermissions(viewPermission, postViewPermission)
  const canViewRestrictedPost = isPublicReadablePostStatus(boardAccessContext.post.status) && (mergedViewPermission.allowed || isOwnerOrManager)

  if (!canViewRestrictedPost && !isOwnerOrManager) {
    apiError(403, mergedViewPermission.message || "无权查看该帖评论")
  }

  const anonymousPostAuthor = boardAccessContext.post.isAnonymous
    ? await getAnonymousMaskDisplayIdentity()
    : null
  const result = await getCommentsByPostId(postId, {
    sort: readSort(requestUrl.searchParams),
    page: readPage(requestUrl.searchParams),
    pageSize: settings.commentPageSize,
    viewMode: readViewMode(requestUrl.searchParams),
  }, {
    userId: currentUser?.id,
    isAdmin: canManageThisPost,
    postAuthorId: boardAccessContext.post.authorId,
    postIsAnonymous: boardAccessContext.post.isAnonymous,
    commentsVisibleToAuthorOnly: boardAccessContext.post.commentsVisibleToAuthorOnly,
    anonymousPostAuthor,
  })

  return apiSuccess({
    items: result.items,
    flatItems: result.flatItems,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    viewMode: result.viewMode,
    hasNextPage: result.page * result.pageSize < result.total,
  })
}, {
  errorMessage: "评论加载失败",
  logPrefix: "[api/comments/list] unexpected error",
})
