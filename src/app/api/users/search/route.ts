import { UserRole, UserStatus } from "@/db/types"
import { prisma } from "@/db/client"

import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"

const USER_SEARCH_LIMIT = 20

function normalizeQuery(request: Request) {
  return (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 40)
}

function normalizePostId(request: Request) {
  return (new URL(request.url).searchParams.get("postId") ?? "").trim().slice(0, 80)
}

function buildDisplayName(user: { username: string; nickname: string | null }) {
  return user.nickname?.trim() || user.username
}

function getMatchScore(user: { username: string; nickname: string | null }, query: string) {
  if (!query) {
    return 0
  }

  const normalizedQuery = query.toLowerCase()
  const username = user.username.toLowerCase()
  const nickname = user.nickname?.toLowerCase() ?? ""

  if (username === normalizedQuery || nickname === normalizedQuery) {
    return 0
  }

  if (username.startsWith(normalizedQuery) || nickname.startsWith(normalizedQuery)) {
    return 1
  }

  if (username.includes(normalizedQuery)) {
    return 2
  }

  if (nickname.includes(normalizedQuery)) {
    return 3
  }

  return 4
}

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const query = normalizeQuery(request)
  const postId = normalizePostId(request)
  const post = postId
    ? await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      })
    : null
  const postAuthorId = post?.authorId ?? null
  const queryMatchWhere = query
    ? {
        OR: [
          { username: { contains: query, mode: "insensitive" as const } },
          { nickname: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {}
  const priorityUsers = await prisma.user.findMany({
    where: {
      id: {
        not: currentUser.id,
      },
      status: UserStatus.ACTIVE,
      OR: [
        ...(postAuthorId ? [{ id: postAuthorId }] : []),
        { role: UserRole.ADMIN },
      ],
      ...(query ? { AND: [queryMatchWhere] } : {}),
    },
    take: USER_SEARCH_LIMIT,
    select: {
      id: true,
      username: true,
      nickname: true,
      role: true,
      level: true,
    },
  })
  const matchedUsers = await prisma.user.findMany({
    where: {
      id: {
        not: currentUser.id,
      },
      status: UserStatus.ACTIVE,
      ...queryMatchWhere,
    },
    orderBy: query
      ? [{ level: "desc" }, { id: "asc" }]
      : [{ id: "asc" }],
    take: query ? 50 : USER_SEARCH_LIMIT,
    select: {
      id: true,
      username: true,
      nickname: true,
      role: true,
      level: true,
    },
  })
  const usersById = new Map<number, (typeof matchedUsers)[number]>()
  for (const user of [...priorityUsers, ...matchedUsers]) {
    usersById.set(user.id, user)
  }
  const users = Array.from(usersById.values())

  return apiSuccess({
    users: users
      .sort((left, right) => {
        const leftPostAuthorScore = left.id === postAuthorId ? 0 : 1
        const rightPostAuthorScore = right.id === postAuthorId ? 0 : 1
        if (leftPostAuthorScore !== rightPostAuthorScore) {
          return leftPostAuthorScore - rightPostAuthorScore
        }

        const leftAdminScore = left.role === UserRole.ADMIN ? 0 : 1
        const rightAdminScore = right.role === UserRole.ADMIN ? 0 : 1
        if (leftAdminScore !== rightAdminScore) {
          return leftAdminScore - rightAdminScore
        }

        const scoreDelta = getMatchScore(left, query) - getMatchScore(right, query)
        if (scoreDelta !== 0) {
          return scoreDelta
        }

        if (right.level !== left.level) {
          return right.level - left.level
        }

        return left.id - right.id
      })
      .slice(0, USER_SEARCH_LIMIT)
      .map((user) => ({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        displayName: buildDisplayName(user),
        role: user.role,
        isPostAuthor: user.id === postAuthorId,
      })),
  })
}, {
  errorMessage: "用户搜索失败",
  logPrefix: "[api/users/search] unexpected error",
  unauthorizedMessage: "请先登录后再搜索用户",
})
