import { countRootCommentsByPostId, countVisibleCommentsByPostId, createCommentWithRelations, findCommentAuthorByUserId, findCommentParentById, findPrivateCommentRecipientById, findRootCommentPageById } from "@/db/comment-queries"
import { findAnonymousMaskUserById } from "@/db/anonymous-post-queries"

import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedStringValue } from "@/lib/addon-hook-values"
import { apiError } from "@/lib/api-route"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { extractMentionTexts, findMentionUsers, resolveMentionsInText } from "@/lib/comment-mentions"
import { enforceSensitiveText } from "@/lib/content-safety"
import { enforceInteractionGate } from "@/lib/interaction-gates"
import { prepareScopedPointDelta } from "@/lib/point-center"
import { canUseAnonymousIdentityForPostReply } from "@/lib/post-anonymous"
import { getSiteSettings } from "@/lib/site-settings"
import { ensureUsersCanInteract } from "@/lib/user-blocks"
import { validateCommentPayload } from "@/lib/validators"

export async function createCommentFlow(input: {
  body: unknown
  currentUser: {
    id: number
    username: string
    nickname: string | null
  }
}) {
  const settings = await getSiteSettings()
  const validated = validateCommentPayload(input.body, {
    contentMinLength: settings.commentContentMinLength,
    contentMaxLength: settings.commentContentMaxLength,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { postId, content, parentId, replyToUserName, replyToCommentId, privateRecipientUserId, useAnonymousIdentity: requestedAnonymousIdentity, commentView } = validated.data
  const contentHookResult = await executeAddonWaterfallHook("comment.content.value", content, {
    payload: {
      mode: "create",
      postId,
    },
  })
  const { value: hookedContent, changed: contentHookAdjusted } = resolveHookedStringValue(content, contentHookResult.value)
  const contentSafety = await enforceSensitiveText({ scene: "comment.content", text: hookedContent })
  const mentionTexts = extractMentionTexts(contentSafety.sanitizedText)

  const [postContext, dbUser, parentComment, replyTargetComment, privateRecipient, mentionUsers] = await Promise.all([
    getBoardAccessContextByPostId(postId),
    findCommentAuthorByUserId(input.currentUser.id),
    parentId ? findCommentParentById(parentId) : Promise.resolve(null),
    replyToCommentId ? findCommentParentById(replyToCommentId) : Promise.resolve(null),
    privateRecipientUserId ? findPrivateCommentRecipientById(privateRecipientUserId) : Promise.resolve(null),
    findMentionUsers(mentionTexts),
  ])

  if (!postContext || !dbUser || postContext.post.status !== "NORMAL") {
    if (postContext?.post.status === "LOCKED") {
      apiError(403, "帖子已关闭回复")
    }

    apiError(404, "帖子不存在或暂不可评论")
  }

  if (privateRecipientUserId) {
    if (!privateRecipient || privateRecipient.status !== "ACTIVE") {
      apiError(400, "私密回复可见人不存在或不可用")
    }

    if (privateRecipient.id === input.currentUser.id) {
      apiError(400, "私密回复不能选择自己作为可见人")
    }

    await ensureUsersCanInteract({
      actorId: input.currentUser.id,
      targetUserId: privateRecipient.id,
      blockedMessage: "你已拉黑该用户，无法发送私密回复",
      blockedByMessage: "对方已将你拉黑，无法发送私密回复",
    })
  }

  if (postContext.post.authorId !== input.currentUser.id) {
    await ensureUsersCanInteract({
      actorId: input.currentUser.id,
      targetUserId: postContext.post.authorId,
      blockedMessage: "你已拉黑该用户，无法在对方帖子下回复",
      blockedByMessage: "对方已将你拉黑，无法在其帖子下回复",
    })
  }

  const permission = checkBoardPermission(dbUser, postContext.settings, "reply")
  if (!permission.allowed) {
    apiError(403, permission.message || "当前没有回复权限")
  }

  enforceInteractionGate({
    action: "COMMENT_CREATE",
    settings: settings.interactionGates,
    user: dbUser,
  })

  if (postContext.settings.replyIntervalSeconds > 0 && dbUser.lastCommentAt) {
    const waitSeconds = postContext.settings.replyIntervalSeconds - Math.floor((Date.now() - new Date(dbUser.lastCommentAt).getTime()) / 1000)
    if (waitSeconds > 0) {
      apiError(429, `回复过于频繁，请 ${waitSeconds} 秒后再试`)
    }
  }

  const replyPointDeltaPrepared = await prepareScopedPointDelta({
    scopeKey: "COMMENT_CREATE",
    baseDelta: postContext.settings.replyPointDelta ?? 0,
    userId: input.currentUser.id,
  })

  const requiredPoints = Math.max(0, -replyPointDeltaPrepared.finalDelta)
  if (dbUser.points < requiredPoints) {
    apiError(400, `当前${settings.pointName}不足，无法在该节点回复`)
  }

  const canReplyAsAnonymous = canUseAnonymousIdentityForPostReply({
    post: postContext.post,
    currentUserId: input.currentUser.id,
  })
  const useAnonymousIdentity = canReplyAsAnonymous
    ? (settings.anonymousPostAllowReplySwitch ? requestedAnonymousIdentity : settings.anonymousPostDefaultReplyAnonymous)
    : false
  const anonymousMaskUser = postContext.post.isAnonymous && settings.anonymousPostMaskUserId
    ? await findAnonymousMaskUserById(settings.anonymousPostMaskUserId)
    : null
  const senderName = useAnonymousIdentity
    ? (anonymousMaskUser?.nickname ?? anonymousMaskUser?.username ?? "匿名用户")
    : (input.currentUser.nickname ?? input.currentUser.username)

  if (useAnonymousIdentity && !anonymousMaskUser) {
    apiError(400, "匿名账号不存在或未配置，暂时不能匿名回复")
  }

  let normalizedParentId = ""
  let normalizedReplyToUserId: number | null = null
  let normalizedReplyToUserName = replyToUserName
  let normalizedReplyToCommentId = ""

  if (parentComment) {
    if (parentComment.postId !== postId || parentComment.status !== "NORMAL") {
      apiError(400, "回复目标不存在或不可用")
    }

    normalizedParentId = parentComment.parentId ?? parentComment.id
  }

  if (replyTargetComment) {
    if (replyTargetComment.postId !== postId || replyTargetComment.status !== "NORMAL") {
      apiError(400, "被回复评论不存在或不可用")
    }

    const replyTargetRootId = replyTargetComment.parentId ?? replyTargetComment.id
    if (normalizedParentId && normalizedParentId !== replyTargetRootId) {
      apiError(400, "回复链路不一致，请刷新后重试")
    }

    normalizedParentId = normalizedParentId || replyTargetRootId
    normalizedReplyToCommentId = replyTargetComment.id
    normalizedReplyToUserId = replyTargetComment.userId
    normalizedReplyToUserName = postContext.post.isAnonymous && replyTargetComment.useAnonymousIdentity
      ? (anonymousMaskUser?.nickname ?? anonymousMaskUser?.username ?? "匿名用户")
      : (replyTargetComment.user.nickname ?? replyTargetComment.user.username)
  } else if (parentComment) {
    normalizedReplyToCommentId = parentComment.id
    normalizedReplyToUserId = parentComment.userId
    normalizedReplyToUserName = postContext.post.isAnonymous && parentComment.useAnonymousIdentity
      ? (anonymousMaskUser?.nickname ?? anonymousMaskUser?.username ?? "匿名用户")
      : (parentComment.user.nickname ?? parentComment.user.username)
  }

  if (normalizedReplyToUserId && normalizedReplyToUserId !== input.currentUser.id) {
    await ensureUsersCanInteract({
      actorId: input.currentUser.id,
      targetUserId: normalizedReplyToUserId,
      blockedMessage: "你已拉黑该用户，无法继续回复",
      blockedByMessage: "对方已将你拉黑，无法继续回复",
    })
  }

  const resolvedComment = resolveMentionsInText(contentSafety.sanitizedText, mentionUsers)
  const effectiveMentionUsers = privateRecipientUserId
    ? resolvedComment.mentions.filter((mention) => mention.id === privateRecipientUserId)
    : resolvedComment.mentions
  const reviewRequired = Boolean(postContext.settings.requireCommentReview)
  const reviewNote = postContext.settings.requireCommentReview
    ? "当前节点开启回帖审核，评论已进入审核"
    : null

  const created = await createCommentWithRelations({
    postId,
    userId: input.currentUser.id,
    content: resolvedComment.content,
    status: reviewRequired ? "PENDING" : "NORMAL",
    reviewNote,
    useAnonymousIdentity,
    parentId: normalizedParentId || undefined,
    replyToUserId: normalizedReplyToUserId ?? undefined,
    replyToCommentId: normalizedReplyToCommentId || undefined,
    privateRecipientUserId: privateRecipientUserId ?? undefined,
    replyPointDelta: postContext.settings.replyPointDelta ?? 0,
    replyPointDeltaPrepared,
    pointName: settings.pointName,
    senderName,
    postAuthorId: postContext.post.authorId,
    mentionUsers: effectiveMentionUsers,
    normalizedParentId: normalizedParentId || undefined,
    normalizedReplyToUserId,
    boardId: postContext.post.boardId,
  })

  const pageSize = Math.min(50, Math.max(1, settings.commentPageSize || 15))
  const totalRootComments = normalizedParentId
    ? null
    : await countRootCommentsByPostId({
        postId,
        viewerUserId: input.currentUser.id,
        includePendingOwn: reviewRequired,
      })
  const targetPage = commentView === "flat"
    ? Math.max(1, Math.ceil((await countVisibleCommentsByPostId({
        postId,
        viewerUserId: input.currentUser.id,
        includePendingOwn: reviewRequired,
      })) / pageSize))
    : normalizedParentId
      ? await findRootCommentPageById({
          postId,
          rootCommentId: normalizedParentId,
          pageSize,
          sort: "oldest",
        })
      : Math.max(1, Math.ceil((totalRootComments ?? 0) / pageSize))

  return {
    postId,
    boardId: postContext.post.boardId,
    postAuthorId: postContext.post.authorId,
    settings,
    created,
    targetPage,
    commentView,
    isRootComment: !normalizedParentId,
    normalizedReplyToUserId,
    normalizedReplyToUserName,
    privateRecipientUserId,
    privateRecipientName: privateRecipient ? (privateRecipient.nickname ?? privateRecipient.username) : null,
    mentionUserIds: effectiveMentionUsers.map((mention) => mention.id),
    senderName,
    contentSafety,
    contentAdjusted: contentHookAdjusted || contentSafety.wasReplaced,
    reviewRequired,
  }
}
