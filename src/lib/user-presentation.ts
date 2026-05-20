export interface HookableUserBadge {
  code?: string | null
  name: string
}

export interface HookableUserPresentationKeyInput {
  userId?: number | null
  username?: string | null
  displayName: string
  avatarPath?: string | null
  role?: string | null
  status?: string | null
  badges?: readonly HookableUserBadge[] | null
}

export function collectHookableBadgeCodes(
  badges?: readonly HookableUserBadge[] | null,
) {
  return [...new Set(
    (badges ?? [])
      .flatMap((badge) => {
        const code = badge.code?.trim()
        const name = badge.name.trim().toLowerCase()
        return [code, name].filter(Boolean)
      }),
  )]
}

export function normalizeHookedAvatarPath(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

export function buildHookableUserPresentationKey(
  input: HookableUserPresentationKeyInput,
) {
  return JSON.stringify([
    input.userId ?? null,
    input.username?.trim() || null,
    input.displayName.trim(),
    input.avatarPath?.trim() || null,
    input.role?.trim() || null,
    input.status?.trim() || null,
    collectHookableBadgeCodes(input.badges),
  ])
}
