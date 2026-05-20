import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

import { getCurrentSessionActor } from "@/lib/auth"
import { apiError } from "@/lib/api-route"


export const currentUserRecordSelect = {
  id: true,
  username: true,
  nickname: true,
  avatarPath: true,
  role: true,
  status: true,
  statusExpiresAt: true,
  level: true,
  points: true,
  vipLevel: true,
  vipExpiresAt: true,
  createdAt: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  lastPostAt: true,
  lastCommentAt: true,
} satisfies Prisma.UserSelect

export type CurrentUserRecord = Prisma.UserGetPayload<{ select: typeof currentUserRecordSelect }>

export async function getCurrentUserRecord(): Promise<CurrentUserRecord | null> {
  const actor = await getCurrentSessionActor()

  if (!actor) {
    return null
  }

  return prisma.user.findUnique({
    where: { id: actor.id },
    select: currentUserRecordSelect,
  })
}

export async function requireCurrentUserRecord(): Promise<CurrentUserRecord> {
  const user = await getCurrentUserRecord()

  if (!user) {
    apiError(401, "当前登录用户不存在")
  }

  return user
}

export async function requireActiveCurrentUserRecord(): Promise<CurrentUserRecord> {
  const user = await requireCurrentUserRecord()

  if (user.status !== "ACTIVE") {
    apiError(403, "当前账号状态不可执行该操作")
  }

  return user
}


