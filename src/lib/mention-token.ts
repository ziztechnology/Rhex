const USER_LINK_PATTERN = /\[userLink:([^\]\r\n:]+):([^\]\r\n:]+)\]/gu

export function createUserLinkToken(displayName: string, username: string) {
  const normalizedDisplayName = displayName.trim().replace(/[\]\r\n:]/g, "")
  const normalizedUsername = username.trim().replace(/[\]\r\n:]/g, "")

  if (!normalizedDisplayName || !normalizedUsername) {
    return ""
  }

  return `[userLink:${normalizedDisplayName}:${normalizedUsername}]`
}

export function isUserLinkToken(value: string) {
  USER_LINK_PATTERN.lastIndex = 0
  return USER_LINK_PATTERN.test(value)
}

export function stripUserLinkTokens(content: string) {
  USER_LINK_PATTERN.lastIndex = 0
  return content.replace(USER_LINK_PATTERN, (_matched, displayName: string) => `@${displayName}`)
}

export function renderUserLinkTokens(content: string) {
  USER_LINK_PATTERN.lastIndex = 0
  return content.replace(USER_LINK_PATTERN, (_matched, displayName: string, username: string) => `[@${displayName}](/users/${encodeURIComponent(username)})`)
}

export function getUserLinkRanges(content: string) {
  const ranges: Array<{ start: number; end: number }> = []
  let match: RegExpExecArray | null

  USER_LINK_PATTERN.lastIndex = 0
  while ((match = USER_LINK_PATTERN.exec(content)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  USER_LINK_PATTERN.lastIndex = 0
  return ranges
}
