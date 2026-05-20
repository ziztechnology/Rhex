import { UserStatus } from "@/db/types"

export type RestrictiveStatus = typeof UserStatus.MUTED | typeof UserStatus.BANNED

export interface UserStatusSource {
  status: UserStatus | string
  statusExpiresAt?: Date | string | null
}

export function isRestrictiveUserStatus(status: UserStatus | string | null | undefined): status is RestrictiveStatus {
  return status === UserStatus.MUTED || status === UserStatus.BANNED
}

export function isUserStatusExpired(user: UserStatusSource, now = new Date()) {
  if (!isRestrictiveUserStatus(user.status)) {
    return false
  }

  if (!user.statusExpiresAt) {
    return false
  }

  const expiresAt = user.statusExpiresAt instanceof Date
    ? user.statusExpiresAt
    : new Date(user.statusExpiresAt)

  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()
}

export function resolveEffectiveUserStatus<TStatus extends UserStatus | string>(
  user: { status: TStatus; statusExpiresAt?: Date | string | null },
  now = new Date(),
) {
  return isUserStatusExpired(user, now) ? UserStatus.ACTIVE : user.status
}

export function formatUserStatusExpiresAt(expiresAt: Date | string | null | undefined) {
  if (!expiresAt) {
    return "永久"
  }

  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  return Number.isNaN(date.getTime()) ? "永久" : date.toISOString()
}
