import { isVipActive } from "@/lib/vip-status"

const PERMANENT_EDIT_WINDOW_MINUTES = -1
const MAX_POST_EDIT_WINDOW_RULES = 50

export type PostEditWindowRuleSubject = "vip" | "level" | "verification" | "badge"

export interface PostEditWindowRule {
  subject: PostEditWindowRuleSubject
  threshold?: number
  targetId?: string
  minutes: number
}

export interface PostEditWindowUser {
  level?: number | null
  vipLevel?: number | null
  vipExpiresAt?: Date | string | null
  grantedBadgeIds?: string[] | null
  approvedVerificationTypeIds?: string[] | null
  userBadges?: Array<{ badgeId: string }> | null
  verificationApplications?: Array<{ typeId: string }> | null
}

export function isPermanentPostEditWindow(editableMinutes: number) {
  return editableMinutes === PERMANENT_EDIT_WINDOW_MINUTES
}

export function normalizePostEditableMinutes(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  const minutes = Math.floor(numericValue)
  return minutes < 0 ? PERMANENT_EDIT_WINDOW_MINUTES : minutes
}

function normalizePostEditWindowRuleSubject(value: unknown): PostEditWindowRuleSubject | null {
  return value === "vip" || value === "level" || value === "verification" || value === "badge"
    ? value
    : null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizePositiveThreshold(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return 1
  }

  return Math.max(1, Math.floor(numberValue))
}

function normalizeTargetId(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizePostEditWindowRules(value: unknown): PostEditWindowRule[] {
  const payload = readRecord(value)
  const rawRules = Array.isArray(value)
    ? value
    : Array.isArray(payload?.rules)
      ? payload.rules
      : []

  return rawRules.slice(0, MAX_POST_EDIT_WINDOW_RULES).reduce<PostEditWindowRule[]>((rules, item) => {
    const record = readRecord(item)
    const subject = normalizePostEditWindowRuleSubject(record?.subject)

    if (!record || !subject) {
      return rules
    }

    const minutes = normalizePostEditableMinutes(record.minutes, PERMANENT_EDIT_WINDOW_MINUTES)

    if (subject === "vip" || subject === "level") {
      rules.push({
        subject,
        threshold: normalizePositiveThreshold(record.threshold),
        minutes,
      })
      return rules
    }

    const targetId = normalizeTargetId(record.targetId)
    if (targetId) {
      rules.push({
        subject,
        targetId,
        minutes,
      })
    }

    return rules
  }, [])
}

export function serializePostEditWindowRulesJson(value: unknown) {
  const rules = normalizePostEditWindowRules(value)

  return rules.length > 0 ? { rules } : null
}

function getGrantedBadgeIds(user: PostEditWindowUser | null | undefined) {
  return new Set([
    ...(user?.grantedBadgeIds ?? []),
    ...(user?.userBadges?.map((item) => item.badgeId) ?? []),
  ])
}

function getApprovedVerificationTypeIds(user: PostEditWindowUser | null | undefined) {
  return new Set([
    ...(user?.approvedVerificationTypeIds ?? []),
    ...(user?.verificationApplications?.map((item) => item.typeId) ?? []),
  ])
}

function doesPostEditWindowRuleMatch(rule: PostEditWindowRule, user: PostEditWindowUser | null | undefined) {
  if (!user) {
    return false
  }

  if (rule.subject === "vip") {
    return isVipActive(user) && (user.vipLevel ?? 0) >= (rule.threshold ?? 1)
  }

  if (rule.subject === "level") {
    return (user.level ?? 0) >= (rule.threshold ?? 1)
  }

  if (rule.subject === "verification") {
    return getApprovedVerificationTypeIds(user).has(rule.targetId ?? "")
  }

  return getGrantedBadgeIds(user).has(rule.targetId ?? "")
}

export function resolvePostEditWindowMinutes(
  defaultEditableMinutes: number,
  rules: readonly PostEditWindowRule[] | null | undefined,
  user?: PostEditWindowUser | null,
) {
  const fallbackMinutes = normalizePostEditableMinutes(defaultEditableMinutes, 10)
  const matchedMinutes = (rules ?? [])
    .filter((rule) => doesPostEditWindowRuleMatch(rule, user))
    .map((rule) => normalizePostEditableMinutes(rule.minutes, fallbackMinutes))

  if (matchedMinutes.length === 0) {
    return fallbackMinutes
  }

  if (matchedMinutes.some(isPermanentPostEditWindow)) {
    return PERMANENT_EDIT_WINDOW_MINUTES
  }

  return Math.max(...matchedMinutes)
}

export function resolvePostEditableUntil(createdAt: Date | string, editableMinutes: number) {
  if (isPermanentPostEditWindow(editableMinutes)) {
    return null
  }

  const createdAtTime = new Date(createdAt).getTime()
  if (!Number.isFinite(createdAtTime) || createdAtTime <= 0) {
    return null
  }

  return new Date(createdAtTime + Math.max(0, editableMinutes) * 60 * 1000)
}

export function isPostStillEditable(createdAt: Date | string, editableMinutes: number, now = Date.now()) {
  if (isPermanentPostEditWindow(editableMinutes)) {
    return true
  }

  const editableUntil = resolvePostEditableUntil(createdAt, editableMinutes)
  return editableUntil ? editableUntil.getTime() > now : false
}

export function formatPostEditWindowLabel(editableMinutes: number) {
  return isPermanentPostEditWindow(editableMinutes)
    ? "永久"
    : `${Math.max(0, editableMinutes)} 分钟`
}
