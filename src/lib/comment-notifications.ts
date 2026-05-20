import { NotificationType, type RelatedType } from "@/db/types"

export interface CommentNotificationDraft {
  userId: number
  type: NotificationType
  senderId: number
  relatedType: RelatedType
  relatedId: string
  title: string
  content: string
}

export function buildCommentCreationNotifications(params: {
  authorId: number
  postAuthorId: number
  commentId: string
  content: string
  senderName: string
  isRootComment: boolean
  normalizedReplyToUserId: number | null
  privateRecipientUserId?: number | null
  mentionUserIds: number[]
}): CommentNotificationDraft[] {
  const notifications: CommentNotificationDraft[] = []
  const replyNotificationRecipients = new Set<number>()

  if (params.privateRecipientUserId && params.privateRecipientUserId !== params.authorId) {
    notifications.push({
      userId: params.privateRecipientUserId,
      type: NotificationType.REPLY_COMMENT,
      senderId: params.authorId,
      relatedType: "COMMENT",
      relatedId: params.commentId,
      title: "你收到一条私密回复",
      content: `${params.senderName} 给你发送了私密回复：${params.content.slice(0, 80)}`,
    })
    replyNotificationRecipients.add(params.privateRecipientUserId)
    return notifications
  }

  if (params.isRootComment && params.postAuthorId !== params.authorId) {
    replyNotificationRecipients.add(params.postAuthorId)
    notifications.push({
      userId: params.postAuthorId,
      type: NotificationType.REPLY_POST,
      senderId: params.authorId,
      relatedType: "COMMENT",
      relatedId: params.commentId,
      title: "你的帖子有了新回复",
      content: `${params.senderName} 回复了你的帖子：${params.content.slice(0, 80)}`,
    })
  }

  if (params.normalizedReplyToUserId && params.normalizedReplyToUserId !== params.authorId) {
    replyNotificationRecipients.add(params.normalizedReplyToUserId)
    notifications.push({
      userId: params.normalizedReplyToUserId,
      type: NotificationType.REPLY_COMMENT,
      senderId: params.authorId,
      relatedType: "COMMENT",
      relatedId: params.commentId,
      title: "你的评论有了新回复",
      content: `${params.senderName} 回复了你的评论：${params.content.slice(0, 80)}`,
    })
  }

  const mentionTargets = [...new Set(params.mentionUserIds)].filter(
    (userId) => userId !== params.authorId && !replyNotificationRecipients.has(userId),
  )
  notifications.push(
    ...mentionTargets.map((userId) => ({
      userId,
      type: NotificationType.MENTION,
      senderId: params.authorId,
      relatedType: "COMMENT" as const,
      relatedId: params.commentId,
      title: "你被提及了",
      content: `${params.senderName} 在评论中提到了你：${params.content.slice(0, 80)}`,
    })),
  )

  return notifications
}
