export interface UserDisplayNameSource {
  username: string
  nickname?: string | null
  status?: string | null
}

const MASKED_NAME_SEPARATOR = "*****"

export function shouldMaskBannedUser(status: string | null | undefined) {
  return status === "BANNED"
}

export function maskUserName(value: string | null | undefined, fallback = "用户") {
  const chars = Array.from(value?.trim() || fallback)
  const first = chars[0] ?? "*"
  const last = chars.length > 1 ? chars[chars.length - 1] : first
  return `${first}${MASKED_NAME_SEPARATOR}${last}`
}

export function getBaseUserDisplayName(user: UserDisplayNameSource | null | undefined, fallback = "") {
  if (!user) {
    return fallback
  }

  if (shouldMaskBannedUser(user.status)) {
    return maskUserName(user.nickname?.trim() || user.username || fallback)
  }

  const nickname = user.nickname?.trim()
  return nickname || user.username || fallback
}

export function getUserAvatarPath(user: { avatarPath?: string | null; status?: string | null } | null | undefined) {
  if (!user || shouldMaskBannedUser(user.status)) {
    return null
  }

  return user.avatarPath ?? null
}
