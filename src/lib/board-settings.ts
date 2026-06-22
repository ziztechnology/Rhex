import type { Board, Zone } from "@/db/types"

import { normalizePostTypes, type LocalPostType } from "@/lib/post-types"
import {
  normalizePostEditWindowRules,
  resolvePostEditWindowMinutes,
  type PostEditWindowRule,
} from "@/lib/post-edit-window"
import { isVipActive } from "@/lib/vip-status"

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(
    value
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean),
  ))
}

export interface EffectiveBoardSettings {
  postPointDelta: number
  replyPointDelta: number
  postIntervalSeconds: number
  replyIntervalSeconds: number
  allowedPostTypes: LocalPostType[]
  allowUserPost: boolean
  allowUserReply: boolean
  allowPostAuthorOfflineComment: boolean
  allowUserOfflineOwnComment: boolean
  requirePostReview: boolean
  requireCommentReview: boolean
  minViewPoints: number
  minViewLevel: number
  minPostPoints: number
  minPostLevel: number
  minReplyPoints: number
  minReplyLevel: number
  minViewVipLevel: number
  minPostVipLevel: number
  minReplyVipLevel: number
  postRequiredVerificationTypeIds: string[]
  postRequiredBadgeIds: string[]
  replyRequiredVerificationTypeIds: string[]
  replyRequiredBadgeIds: string[]
  postEditRules?: PostEditWindowRule[]
  showInHomeFeed: boolean
  moderatorsCanWithdrawBoardTreasury?: boolean
}


export function resolveBoardSettings(zone?: Partial<Zone> | null, board?: Partial<Board> | null): EffectiveBoardSettings {
  const zoneAdvanced = zone as (Partial<Zone> & {
    postPointDelta?: number | null
    replyPointDelta?: number | null
    postIntervalSeconds?: number | null
    replyIntervalSeconds?: number | null
    allowedPostTypes?: string | null
    allowUserPost?: boolean | null
    allowUserReply?: boolean | null
    allowPostAuthorOfflineComment?: boolean | null
    allowUserOfflineOwnComment?: boolean | null
    minViewPoints?: number | null
    minViewLevel?: number | null
    minPostPoints?: number | null
    minPostLevel?: number | null
    minReplyPoints?: number | null
    minReplyLevel?: number | null
    postRequiredVerificationTypeIds?: string[] | null
    postRequiredBadgeIds?: string[] | null
    replyRequiredVerificationTypeIds?: string[] | null
    replyRequiredBadgeIds?: string[] | null
    postEditRulesJson?: unknown
  }) | null | undefined
  const boardConfig = board as (Partial<Board> & {
    configJson?: unknown
    postIdentityGateInherit?: boolean | null
    replyIdentityGateInherit?: boolean | null
    postRequiredVerificationTypeIds?: string[] | null
    postRequiredBadgeIds?: string[] | null
    replyRequiredVerificationTypeIds?: string[] | null
    replyRequiredBadgeIds?: string[] | null
    postEditRulesJson?: unknown
  }) | null | undefined
  const configJson = boardConfig?.configJson
  const boardTreasury = configJson && typeof configJson === "object" && !Array.isArray(configJson)
    ? (configJson as { boardTreasury?: unknown }).boardTreasury
    : null


  return {
    postPointDelta: board?.postPointDelta ?? zoneAdvanced?.postPointDelta ?? 0,
    replyPointDelta: board?.replyPointDelta ?? zoneAdvanced?.replyPointDelta ?? 0,
    postIntervalSeconds: board?.postIntervalSeconds ?? zoneAdvanced?.postIntervalSeconds ?? 120,
    replyIntervalSeconds: board?.replyIntervalSeconds ?? zoneAdvanced?.replyIntervalSeconds ?? 3,
    allowedPostTypes: normalizePostTypes(board?.allowedPostTypes ?? zoneAdvanced?.allowedPostTypes),
    allowUserPost: board?.allowUserPost ?? zoneAdvanced?.allowUserPost ?? true,
    allowUserReply: board?.allowUserReply ?? zoneAdvanced?.allowUserReply ?? true,
    allowPostAuthorOfflineComment: board?.allowPostAuthorOfflineComment ?? zoneAdvanced?.allowPostAuthorOfflineComment ?? false,
    allowUserOfflineOwnComment: board?.allowUserOfflineOwnComment ?? zoneAdvanced?.allowUserOfflineOwnComment ?? false,

    requirePostReview: board?.requirePostReview ?? zone?.requirePostReview ?? false,
    requireCommentReview: board?.requireCommentReview ?? zone?.requireCommentReview ?? false,
    minViewPoints: board?.minViewPoints ?? (zone as { minViewPoints?: number | null } | null | undefined)?.minViewPoints ?? 0,
    minViewLevel: board?.minViewLevel ?? (zone as { minViewLevel?: number | null } | null | undefined)?.minViewLevel ?? 0,
    minPostPoints: board?.minPostPoints ?? (zone as { minPostPoints?: number | null } | null | undefined)?.minPostPoints ?? 0,
    minPostLevel: board?.minPostLevel ?? (zone as { minPostLevel?: number | null } | null | undefined)?.minPostLevel ?? 0,
    minReplyPoints: board?.minReplyPoints ?? (zone as { minReplyPoints?: number | null } | null | undefined)?.minReplyPoints ?? 0,
    minReplyLevel: board?.minReplyLevel ?? (zone as { minReplyLevel?: number | null } | null | undefined)?.minReplyLevel ?? 0,
    minViewVipLevel: board?.minViewVipLevel ?? zone?.minViewVipLevel ?? 0,
    minPostVipLevel: board?.minPostVipLevel ?? zone?.minPostVipLevel ?? 0,
    minReplyVipLevel: board?.minReplyVipLevel ?? zone?.minReplyVipLevel ?? 0,
    postRequiredVerificationTypeIds: normalizeStringList(boardConfig?.postIdentityGateInherit === true ? zoneAdvanced?.postRequiredVerificationTypeIds : boardConfig?.postRequiredVerificationTypeIds ?? zoneAdvanced?.postRequiredVerificationTypeIds),
    postRequiredBadgeIds: normalizeStringList(boardConfig?.postIdentityGateInherit === true ? zoneAdvanced?.postRequiredBadgeIds : boardConfig?.postRequiredBadgeIds ?? zoneAdvanced?.postRequiredBadgeIds),
    replyRequiredVerificationTypeIds: normalizeStringList(boardConfig?.replyIdentityGateInherit === true ? zoneAdvanced?.replyRequiredVerificationTypeIds : boardConfig?.replyRequiredVerificationTypeIds ?? zoneAdvanced?.replyRequiredVerificationTypeIds),
    replyRequiredBadgeIds: normalizeStringList(boardConfig?.replyIdentityGateInherit === true ? zoneAdvanced?.replyRequiredBadgeIds : boardConfig?.replyRequiredBadgeIds ?? zoneAdvanced?.replyRequiredBadgeIds),
    postEditRules: normalizePostEditWindowRules(boardConfig?.postEditRulesJson ?? zoneAdvanced?.postEditRulesJson),
    showInHomeFeed: board?.showInHomeFeed ?? zone?.showInHomeFeed ?? true,
    moderatorsCanWithdrawBoardTreasury: Boolean(
      boardTreasury
      && typeof boardTreasury === "object"
      && !Array.isArray(boardTreasury)
      && (boardTreasury as { moderatorsCanWithdrawTreasury?: unknown }).moderatorsCanWithdrawTreasury === true,
    ),

  }
}

type BoardPermissionUser = {
  points: number
  level: number
  vipLevel?: number | null
  vipExpiresAt?: Date | string | null
  role?: "USER" | "MODERATOR" | "ADMIN" | null
  grantedBadgeIds?: string[] | null
  approvedVerificationTypeIds?: string[] | null
}

function resolvePointName(pointName?: string | null) {
  return typeof pointName === "string" && pointName.trim() ? pointName.trim() : "积分"
}

function isStaffUser(user: Pick<BoardPermissionUser, "role"> | null) {
  return user?.role === "ADMIN" || user?.role === "MODERATOR"
}

export function canUserAccess(user: BoardPermissionUser | null, settings: EffectiveBoardSettings, action: "view" | "post" | "reply", pointName?: string | null) {
  if (action === "post" && !settings.allowUserPost && !isStaffUser(user)) {
    return { allowed: false, message: "当前仅管理员和版主可发帖" }
  }

  if (action === "reply" && !settings.allowUserReply && !isStaffUser(user)) {
    return { allowed: false, message: "当前仅管理员和版主可回复" }
  }

  const minPoints = action === "view" ? settings.minViewPoints : action === "post" ? settings.minPostPoints : settings.minReplyPoints
  const minLevel = action === "view" ? settings.minViewLevel : action === "post" ? settings.minPostLevel : settings.minReplyLevel
  const minVipLevel = action === "view" ? settings.minViewVipLevel : action === "post" ? settings.minPostVipLevel : settings.minReplyVipLevel
  const currentVipLevel = isVipActive(user) ? (user?.vipLevel ?? 0) : 0
  const normalizedPointName = resolvePointName(pointName)

  if (minVipLevel > 0 && currentVipLevel < minVipLevel) {

    return { allowed: false, message: `当前需要至少 VIP ${minVipLevel}` }
  }

  if ((user?.points ?? 0) < minPoints) {
    return { allowed: false, message: `当前需要至少 ${minPoints} ${normalizedPointName}` }
  }


  if ((user?.level ?? 0) < minLevel) {
    return { allowed: false, message: `当前需要至少 Lv.${minLevel}` }
  }

  if (!isStaffUser(user) && (action === "post" || action === "reply")) {
    const requiredVerificationTypeIds = action === "post" ? settings.postRequiredVerificationTypeIds : settings.replyRequiredVerificationTypeIds
    const requiredBadgeIds = action === "post" ? settings.postRequiredBadgeIds : settings.replyRequiredBadgeIds
    const hasIdentityGate = requiredVerificationTypeIds.length > 0 || requiredBadgeIds.length > 0

    if (hasIdentityGate) {
      const userVerificationTypeIds = new Set(user?.approvedVerificationTypeIds ?? [])
      const userBadgeIds = new Set(user?.grantedBadgeIds ?? [])
      const hasRequiredVerification = requiredVerificationTypeIds.some((id) => userVerificationTypeIds.has(id))
      const hasRequiredBadge = requiredBadgeIds.some((id) => userBadgeIds.has(id))

      if (!hasRequiredVerification && !hasRequiredBadge) {
        return { allowed: false, message: action === "post" ? "当前需要指定认证或勋章才可发帖" : "当前需要指定认证或勋章才可回复" }
      }
    }
  }

  return { allowed: true, message: "" }
}

export function resolveBoardPostEditWindowMinutes(
  settings: Pick<EffectiveBoardSettings, "postEditRules">,
  defaultEditableMinutes: number,
  user?: BoardPermissionUser | null,
) {
  return resolvePostEditWindowMinutes(defaultEditableMinutes, settings.postEditRules ?? [], user ? {
    ...user,
    grantedBadgeIds: user.grantedBadgeIds ?? [],
    approvedVerificationTypeIds: user.approvedVerificationTypeIds ?? [],
  } : null)
}

export function canUserOfflineComment(
  userId: number | null | undefined,
  settings: EffectiveBoardSettings,
  target: {
    postAuthorId: number
    commentAuthorId: number
  },
) {
  if (!userId) {
    return { allowed: false, message: "请先登录" }
  }

  if (userId === target.commentAuthorId) {
    return settings.allowUserOfflineOwnComment
      ? { allowed: true, message: "" }
      : { allowed: false, message: "当前不允许用户下线自己的评论" }
  }

  if (userId === target.postAuthorId) {
    return settings.allowPostAuthorOfflineComment
      ? { allowed: true, message: "" }
      : { allowed: false, message: "当前不允许楼主下线用户评论" }
  }

  return { allowed: false, message: "无权下线该评论" }
}

