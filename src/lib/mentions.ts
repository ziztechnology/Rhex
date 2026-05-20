import { findUsersByMentionTexts } from "@/db/mention-queries"
import {
  createUserLinkToken,
  getUserLinkRanges,
  isUserLinkToken,
  renderUserLinkTokens,
  stripUserLinkTokens,
} from "@/lib/mention-token"

const MENTION_BOUNDARY_CJK = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}"
const MENTION_PATTERN = new RegExp(`(^|[^\\S\\r\\n]|[\\p{P}\\p{S}]|[${MENTION_BOUNDARY_CJK}])@([^\\s@]{1,20})`, "gu")
export {
  createUserLinkToken,
  isUserLinkToken,
  renderUserLinkTokens,
  stripUserLinkTokens,
}

export interface MentionUser {
  id: number
  username: string
  nickname: string | null
}

export interface ResolvedMention {
  id: number
  username: string
  nickname: string | null
  matchedText: string
  displayName: string
  token: string
}

function normalizeMentionText(value: string) {
  return value.trim()
}

function isInsideRanges(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some((range) => index >= range.start && index < range.end)
}

export function extractMentionTexts(content: string) {
  const mentionTexts = new Set<string>()
  const userLinkRanges = getUserLinkRanges(content)
  let match: RegExpExecArray | null

  MENTION_PATTERN.lastIndex = 0
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    const mentionStart = match.index + (match[1]?.length ?? 0)
    if (isInsideRanges(mentionStart, userLinkRanges)) {
      continue
    }

    const mentionText = normalizeMentionText(match[2] ?? "")
    if (mentionText) {
      mentionTexts.add(mentionText)
    }
  }

  return [...mentionTexts]
}

function buildMentionUserLookup(users: MentionUser[]) {
  const lookup = new Map<string, MentionUser>()

  for (const user of users) {
    lookup.set(user.username, user)
    if (user.nickname) {
      lookup.set(user.nickname, user)
    }
  }

  return lookup
}

export async function findMentionUsersByContent(content: string) {
  return findUsersByMentionTexts(extractMentionTexts(content))
}

export async function findMentionUsers(mentionTexts: string[]) {
  return findUsersByMentionTexts(mentionTexts)
}

export function resolveMentionsInText(content: string, users: MentionUser[]) {
  const userLookup = buildMentionUserLookup(users)
  const resolvedMentions: ResolvedMention[] = []
  const seenUserIds = new Set<number>()
  const userLinkRanges = getUserLinkRanges(content)

  MENTION_PATTERN.lastIndex = 0
  const transformedContent = content.replace(MENTION_PATTERN, (matched, prefix: string, rawMentionText: string, offset: number) => {
    const mentionStart = offset + prefix.length
    if (isInsideRanges(mentionStart, userLinkRanges)) {
      return matched
    }

    const mentionText = normalizeMentionText(rawMentionText)
    const matchedUser = userLookup.get(mentionText)

    if (!matchedUser) {
      return matched
    }

    const token = createUserLinkToken(mentionText, matchedUser.username)
    if (!token) {
      return matched
    }

    if (!seenUserIds.has(matchedUser.id)) {
      seenUserIds.add(matchedUser.id)
      resolvedMentions.push({
        id: matchedUser.id,
        username: matchedUser.username,
        nickname: matchedUser.nickname,
        matchedText: mentionText,
        displayName: mentionText,
        token,
      })
    }

    return `${prefix}${token}`
  })

  return {
    content: transformedContent,
    mentions: resolvedMentions,
  }
}

export async function resolveMentionsByContent(content: string) {
  const mentionTexts = extractMentionTexts(content)
  const users = await findMentionUsers(mentionTexts)
  return resolveMentionsInText(content, users)
}
