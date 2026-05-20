import "server-only"

import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedStringValue } from "@/lib/addon-hook-values"
import {
  buildHookableUserPresentationKey,
  collectHookableBadgeCodes,
  normalizeHookedAvatarPath,
  type HookableUserBadge,
} from "@/lib/user-presentation"
import { maskUserName, shouldMaskBannedUser } from "@/lib/user-display"

interface HookableUserPresentationInput {
  userId?: number | null
  username?: string | null
  displayName: string
  avatarPath?: string | null
  role?: string | null
  status?: string | null
  badges?: readonly HookableUserBadge[] | null
}

interface HookedUserPresentationResult {
  displayName: string
  avatarPath: string | null
}

async function resolveHookedUserPresentation(
  input: HookableUserPresentationInput,
): Promise<HookedUserPresentationResult> {
  if (shouldMaskBannedUser(input.status)) {
    return {
      displayName: maskUserName(input.displayName || input.username),
      avatarPath: null,
    }
  }

  const badgeCodes = collectHookableBadgeCodes(input.badges)
  const payload = {
    ...(typeof input.userId === "number" ? { userId: input.userId } : {}),
    ...(input.username?.trim() ? { username: input.username.trim() } : {}),
    ...(input.role?.trim() ? { role: input.role.trim() } : {}),
    ...(badgeCodes.length > 0 ? { badges: badgeCodes } : {}),
  }

  const [displayResult, avatarResult] = await Promise.all([
    executeAddonWaterfallHook("user.displayName.value", input.displayName, {
      payload,
    }),
    executeAddonWaterfallHook("user.avatar.url.value", input.avatarPath?.trim() ?? "", {
      payload,
    }),
  ])

  return {
    displayName: resolveHookedStringValue(input.displayName, displayResult.value).value,
    avatarPath: normalizeHookedAvatarPath(avatarResult.value),
  }
}

async function buildHookedUserPresentationMap(
  inputs: HookableUserPresentationInput[],
) {
  const uniqueInputs = [...new Map(
    inputs
      .filter((input) => input.displayName.trim())
      .map((input) => [buildHookableUserPresentationKey(input), input]),
  ).entries()]

  const resolved = await Promise.all(
    uniqueInputs.map(async ([key, input]) => [key, await resolveHookedUserPresentation(input)] as const),
  )

  return new Map<string, HookedUserPresentationResult>(resolved)
}

interface HookableSitePostItem {
  author: string
  authorId?: number
  authorUsername?: string
  authorAvatarPath?: string | null
  authorStatus?: string
  authorDisplayedBadges?: readonly HookableUserBadge[]
  isAnonymous?: boolean
  latestReplyAuthorName?: string | null
  latestReplyAuthorUsername?: string | null
}

export async function applyHookedUserPresentationToSitePosts<
  TItem extends HookableSitePostItem,
>(items: readonly TItem[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    if (!item.isAnonymous && item.author.trim()) {
      inputs.push({
        userId: item.authorId,
        username: item.authorUsername,
        displayName: item.author,
        avatarPath: item.authorAvatarPath,
        status: item.authorStatus,
        badges: item.authorDisplayedBadges,
      })
    }

    if (item.latestReplyAuthorName?.trim() && item.latestReplyAuthorUsername?.trim()) {
      inputs.push({
        username: item.latestReplyAuthorUsername,
        displayName: item.latestReplyAuthorName,
      })
    }
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => {
    const authorKey = !item.isAnonymous && item.author.trim()
      ? buildHookableUserPresentationKey({
          userId: item.authorId,
          username: item.authorUsername,
          displayName: item.author,
          avatarPath: item.authorAvatarPath,
          status: item.authorStatus,
          badges: item.authorDisplayedBadges,
        })
      : null
    const latestReplyKey = item.latestReplyAuthorName?.trim() && item.latestReplyAuthorUsername?.trim()
      ? buildHookableUserPresentationKey({
          username: item.latestReplyAuthorUsername,
          displayName: item.latestReplyAuthorName,
        })
      : null
    const hookedAuthor = authorKey ? hookedMap.get(authorKey) : null
    const hookedLatestReply = latestReplyKey ? hookedMap.get(latestReplyKey) : null

    return {
      ...item,
      ...(hookedAuthor
        ? {
            author: hookedAuthor.displayName,
            authorAvatarPath: hookedAuthor.avatarPath,
          }
        : {}),
      ...(hookedLatestReply
        ? {
            latestReplyAuthorName: hookedLatestReply.displayName,
          }
        : {}),
    }
  })
}

interface HookableCommentEntry {
  author: string
  authorId: number
  authorUsername: string
  authorAvatarPath?: string | null
  authorRole?: string
  authorStatus?: string
  authorIsAnonymous?: boolean
  authorDisplayedBadges?: readonly HookableUserBadge[]
}

function applyHookedPresentationToCommentEntry<TEntry extends HookableCommentEntry>(
  entry: TEntry,
  hookedMap: Map<string, HookedUserPresentationResult>,
) {
  if (entry.authorIsAnonymous || !entry.author.trim()) {
    return entry
  }

  const key = buildHookableUserPresentationKey({
    userId: entry.authorId,
    username: entry.authorUsername,
    displayName: entry.author,
    avatarPath: entry.authorAvatarPath,
    role: entry.authorRole,
    status: entry.authorStatus,
    badges: entry.authorDisplayedBadges,
  })
  const hooked = hookedMap.get(key)

  if (!hooked) {
    return entry
  }

  return {
    ...entry,
    author: hooked.displayName,
    authorAvatarPath: hooked.avatarPath,
  }
}

export async function applyHookedUserPresentationToCommentThreads<
  TReply extends HookableCommentEntry,
  TComment extends HookableCommentEntry & { replies?: TReply[] },
>(items: readonly TComment[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    if (!item.authorIsAnonymous && item.author.trim()) {
      inputs.push({
        userId: item.authorId,
        username: item.authorUsername,
        displayName: item.author,
        avatarPath: item.authorAvatarPath,
        role: item.authorRole,
        status: item.authorStatus,
        badges: item.authorDisplayedBadges,
      })
    }

    for (const reply of item.replies ?? []) {
      if (!reply.authorIsAnonymous && reply.author.trim()) {
        inputs.push({
          userId: reply.authorId,
          username: reply.authorUsername,
          displayName: reply.author,
          avatarPath: reply.authorAvatarPath,
          role: reply.authorRole,
          status: reply.authorStatus,
          badges: reply.authorDisplayedBadges,
        })
      }
    }
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => ({
    ...applyHookedPresentationToCommentEntry(item, hookedMap),
    replies: (item.replies ?? []).map((reply) => applyHookedPresentationToCommentEntry(reply, hookedMap)),
  }))
}

type FlatCommentEntry =
  | { type: "comment"; comment: HookableCommentEntry }
  | { type: "reply"; reply: HookableCommentEntry }

export async function applyHookedUserPresentationToFlatCommentItems<
  TItem extends FlatCommentEntry,
>(items: readonly TItem[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    const entry = item.type === "comment" ? item.comment : item.reply
    if (entry.authorIsAnonymous || !entry.author.trim()) {
      continue
    }

    inputs.push({
      userId: entry.authorId,
      username: entry.authorUsername,
      displayName: entry.author,
      avatarPath: entry.authorAvatarPath,
      role: entry.authorRole,
      status: entry.authorStatus,
      badges: entry.authorDisplayedBadges,
    })
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => {
    if (item.type === "comment") {
      return {
        ...item,
        comment: applyHookedPresentationToCommentEntry(item.comment, hookedMap),
      }
    }

    return {
      ...item,
      reply: applyHookedPresentationToCommentEntry(item.reply, hookedMap),
    }
  })
}

export async function applyHookedUserPresentationToNamedItem<
  TItem extends {
    displayName: string
    username: string
    avatarPath?: string | null
    role?: string | null
    status?: string | null
    displayedBadges?: readonly HookableUserBadge[]
    id?: number
  },
>(item: TItem) {
  const hooked = await resolveHookedUserPresentation({
    userId: item.id,
    username: item.username,
    displayName: item.displayName,
    avatarPath: item.avatarPath,
    role: item.role,
    status: item.status,
    badges: item.displayedBadges,
  })

  return {
    ...item,
    displayName: hooked.displayName,
    avatarPath: hooked.avatarPath,
  }
}

export async function applyHookedUserPresentationToHomeSidebarItems<
  TItem extends {
    authorName: string
    authorId?: number
    authorUsername?: string
    authorAvatarPath?: string | null
    lastReplyAuthorName?: string | null
    lastReplyAuthorUsername?: string | null
  },
>(items: readonly TItem[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    if (item.authorName.trim()) {
      inputs.push({
        userId: item.authorId,
        username: item.authorUsername,
        displayName: item.authorName,
        avatarPath: item.authorAvatarPath,
      })
    }

    if (item.lastReplyAuthorName?.trim() && item.lastReplyAuthorUsername?.trim()) {
      inputs.push({
        username: item.lastReplyAuthorUsername,
        displayName: item.lastReplyAuthorName,
      })
    }
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => {
    const authorKey = item.authorName.trim()
      ? buildHookableUserPresentationKey({
          userId: item.authorId,
          username: item.authorUsername,
          displayName: item.authorName,
          avatarPath: item.authorAvatarPath,
        })
      : null
    const replyKey = item.lastReplyAuthorName?.trim() && item.lastReplyAuthorUsername?.trim()
      ? buildHookableUserPresentationKey({
          username: item.lastReplyAuthorUsername,
          displayName: item.lastReplyAuthorName,
        })
      : null
    const hookedAuthor = authorKey ? hookedMap.get(authorKey) : null
    const hookedReply = replyKey ? hookedMap.get(replyKey) : null

    return {
      ...item,
      ...(hookedAuthor
        ? {
            authorName: hookedAuthor.displayName,
            authorAvatarPath: hookedAuthor.avatarPath,
          }
        : {}),
      ...(hookedReply
        ? {
            lastReplyAuthorName: hookedReply.displayName,
          }
        : {}),
    }
  })
}
