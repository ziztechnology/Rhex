import type { BoardSidebarLinkItem } from "@/lib/board-sidebar-config"
import type { BoardItem, ZoneItem } from "@/lib/admin-structure-management"
import type { PostEditWindowRuleSubject } from "@/lib/post-edit-window"

export interface BoardApplicationZoneOption {
  id: string
  name: string
  slug: string
}

export interface StructureManagerProps {
  zones: ZoneItem[]
  boards: BoardItem[]
  permissions: {
    canCreateZone: boolean
    canCreateBoard: boolean
    canDeleteZone: boolean
    canDeleteBoard: boolean
  }
  canReviewBoardApplications: boolean
  pendingBoardApplicationCount: number
  verificationTypes: Array<{
    id: string
    name: string
    slug: string
    status: boolean
  }>
  badges: Array<{
    id: string
    name: string
    code: string
    status: boolean
  }>
  initialFilters: {
    keyword: string
    zoneId: string
    boardStatus: string
    posting: string
  }
}

export interface BoardApplicationItem {
  id: string
  applicantId: number
  zoneId: string
  boardId: string | null
  name: string
  slug: string
  description: string
  icon: string
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reviewNote: string
  reviewedAt: string | null
  createdAt: string
  applicant: {
    id: number
    username: string
    displayName: string
    role: "USER" | "MODERATOR" | "ADMIN"
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  }
  reviewer: {
    id: number
    displayName: string
  } | null
  zone: {
    id: string
    name: string
    slug: string
  }
  board: {
    id: string
    name: string
    slug: string
    treasuryPoints: number
  } | null
}

export interface AdminBoardApplicationManagerProps {
  zones: BoardApplicationZoneOption[]
  boardApplications: BoardApplicationItem[]
  canReviewBoardApplications: boolean
}

export type ModalMode =
  | { kind: "create-zone" }
  | { kind: "create-board"; zoneId?: string }
  | { kind: "edit-zone"; item: ZoneItem }
  | { kind: "edit-board"; item: BoardItem }
  | null

export interface BoardApplicationReviewFormState {
  zoneId: string
  name: string
  slug: string
  description: string
  icon: string
  reason: string
  reviewNote: string
}

export type BoardSidebarLinkDraft = BoardSidebarLinkItem

export interface PostEditRuleDraft {
  subject: PostEditWindowRuleSubject
  threshold: string
  targetId: string
  minutes: string
}

export interface StructureFormState {
  name: string
  slug: string
  description: string
  icon: string
  sidebarLinks: BoardSidebarLinkDraft[]
  rulesMarkdown: string
  moderatorsCanWithdrawTreasury: boolean
  sortOrder: string
  hiddenFromSidebar: boolean
  zoneId: string
  postPointDelta: string
  replyPointDelta: string
  postIntervalSeconds: string
  replyIntervalSeconds: string
  allowedPostTypes: string[]
  allowUserPost: string
  allowUserReply: string
  allowPostAuthorOfflineComment: string
  allowUserOfflineOwnComment: string
  minViewPoints: string
  minViewLevel: string
  minPostPoints: string
  minPostLevel: string
  minReplyPoints: string
  minReplyLevel: string
  minViewVipLevel: string
  minPostVipLevel: string
  minReplyVipLevel: string
  postIdentityGateMode: "inherit" | "custom"
  replyIdentityGateMode: "inherit" | "custom"
  postRequiredVerificationTypeIds: string[]
  postRequiredBadgeIds: string[]
  replyRequiredVerificationTypeIds: string[]
  replyRequiredBadgeIds: string[]
  postEditRuleMode: "inherit" | "custom"
  postEditRules: PostEditRuleDraft[]
  requirePostReview: boolean
  requireCommentReview: boolean
  showInHomeFeed: string
  postListDisplayMode: string
  postListLoadMode: string
  feedback: string
  feedbackTone: "error" | "success"
}

export type StructureFormTab = "basic" | "content" | "policy" | "access" | "moderators"

export interface SelectFieldOption {
  value: string
  label: string
}
