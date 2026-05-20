import type { Prisma } from "@/db/types"
import { normalizeExpiredUserRestrictionByUsername } from "@/db/user-status-queries"

export const sessionActorSelect = {
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
  sessionInvalidBefore: true,
} satisfies Prisma.UserSelect

export type SessionActor = Prisma.UserGetPayload<{ select: typeof sessionActorSelect }>

export function findSessionActorByUsername(username: string) {
  return normalizeExpiredUserRestrictionByUsername(username, sessionActorSelect)
}
