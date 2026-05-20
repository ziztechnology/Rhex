import type { CurrentUserRecord } from "@/db/current-user"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { triggerAiMention } from "@/lib/ai/mention-trigger"
import { apiError } from "@/lib/api-route"
import { createCommentFlow } from "@/lib/comment-create-service"
import { buildCommentCreationNotifications } from "@/lib/comment-notifications"
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { enqueuePostFollowCommentNotifications } from "@/lib/follow-notifications"
import { handleCommentCreateSideEffects } from "@/lib/interaction-side-effects"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { enqueueEvaluateUserLevelProgress } from "@/lib/level-system"
import { enqueueNotifications } from "@/lib/notification-writes"
import { logRequestSucceeded } from "@/lib/request-log"
import { recordApprovedCommentTaskEvent } from "@/lib/task-center-service"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { getCurrentSessionActor } from "@/lib/auth"

type CommentExecutionActor = Pick<CurrentUserRecord, "id" | "username" | "nickname" | "status">

interface ExecuteCommentCreationOptions {
  request: Request
  author?: CommentExecutionActor | null
  log?: {
    scope: string
    action: string
    extra?: Record<string, unknown>
  }
}

async function resolveCommentAuthor(author?: CommentExecutionActor | null) {
  if (author) {
    return author
  }

  const currentUser = await getCurrentSessionActor()
  if (!currentUser) {
    apiError(401, "请先登录后再评论")
  }

  return currentUser
}

function assertCommentAuthorStatus(author: CommentExecutionActor) {
  if (author.status === "ACTIVE") {
    return
  }

  if (author.status === "MUTED") {
    apiError(403, "账号已被禁言，暂不可回复")
  }

  if (author.status === "BANNED") {
    apiError(403, "账号已被拉黑，无法回复")
  }

  apiError(403, "当前账号状态不可执行该操作")
}

export async function executeCommentCreation(body: unknown, options: ExecuteCommentCreationOptions) {
  const author = await resolveCommentAuthor(options.author)
  assertCommentAuthorStatus(author)

  const requestUrl = new URL(options.request.url)

  await executeAddonActionHook("comment.create.before", {
    authorId: author.id,
    authorUsername: author.username,
    body,
  }, {
    request: options.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const result = await createCommentFlow({
    body,
    currentUser: {
      id: author.id,
      username: author.username,
      nickname: author.nickname,
    },
  })

  void enqueueEvaluateUserLevelProgress(author.id, { notifyOnUpgrade: true })

  await handleCommentCreateSideEffects({
    postId: result.postId,
    userId: author.id,
    commentId: result.created.id,
  })

  if (options.log) {
    logRequestSucceeded({
      scope: options.log.scope,
      action: options.log.action,
      userId: author.id,
      targetId: result.created.id,
    }, {
      postId: result.postId,
      page: result.targetPage,
      reviewRequired: result.reviewRequired,
      ...(options.log.extra ?? {}),
    })
  }

  revalidateUserSurfaceCache(author.id)
  if (!result.reviewRequired) {
    revalidateContentListCaches()
    revalidateHomeSidebarStatsCache()
    void recordApprovedCommentTaskEvent({
      type: "APPROVED_COMMENT",
      userId: author.id,
      commentId: result.created.id,
      postId: result.postId,
      boardId: result.boardId,
    }).catch((error) => {
      console.warn("[comment-create-execution] failed to record task progress", error)
    })
  }

  if (!result.reviewRequired) {
    const notifications = buildCommentCreationNotifications({
      authorId: author.id,
      postAuthorId: result.postAuthorId,
      commentId: result.created.id,
      content: result.created.content,
      senderName: result.senderName,
      isRootComment: result.isRootComment,
      normalizedReplyToUserId: result.normalizedReplyToUserId,
      privateRecipientUserId: result.privateRecipientUserId,
      mentionUserIds: result.mentionUserIds,
    })

    if (notifications.length > 0) {
      void enqueueNotifications(notifications)
    }

    if (!result.privateRecipientUserId) {
      void enqueuePostFollowCommentNotifications({
        commentId: result.created.id,
        excludeUserIds: [
          ...(result.isRootComment ? [result.postAuthorId] : []),
          ...(typeof result.normalizedReplyToUserId === "number"
            ? [result.normalizedReplyToUserId]
            : []),
          ...result.mentionUserIds,
        ],
      })

      void triggerAiMention({
        kind: "comment",
        postId: result.postId,
        commentId: result.created.id,
        triggerUserId: author.id,
        mentionedUserIds: result.mentionUserIds,
      })
    }
  }

  await executeAddonActionHook("comment.create.after", {
    commentId: result.created.id,
    postId: result.postId,
    authorId: author.id,
    status: result.created.status,
    parentId: result.created.parentId ?? null,
  }, {
    request: options.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

  return result
}
