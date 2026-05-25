import "server-only"

import { findPostCardEmbedSourceByRouteSegment } from "@/db/post-card-embed-queries"
import { buildPostCardEmbedToken, extractInternalPostUrlFromLine, type EmbeddedPostCardSnapshot } from "@/lib/post-card-embed"
import { extractSummaryFromContent } from "@/lib/content"
import { getAllPostContentText } from "@/lib/post-content"
import { getUserAvatarPath, getUserDisplayName } from "@/lib/user-display"
import { resolvePostCoverImage } from "@/lib/post-cover"
import { getPostPath } from "@/lib/post-links"

const MAX_POST_CARD_EMBEDS_PER_CONTENT = 20

interface ProcessInternalPostCardEmbedsOptions {
  requestUrl?: string
  currentPostId?: string
}

function buildPostCardSummary(post: { summary?: string | null; content: string }) {
  const summary = post.summary?.trim() || extractSummaryFromContent(getAllPostContentText(post.content))
  return summary ? summary.slice(0, 160) : null
}

function buildPostCardSnapshot(post: Awaited<ReturnType<typeof findPostCardEmbedSourceByRouteSegment>>): EmbeddedPostCardSnapshot | null {
  if (!post) {
    return null
  }

  const publishedAt = post.publishedAt ?? post.createdAt

  return {
    version: 1,
    postId: post.id,
    slug: post.slug,
    url: getPostPath({ id: post.id, slug: post.slug }, "ID"),
    title: post.title,
    authorName: getUserDisplayName(post.author, "用户"),
    authorAvatarPath: getUserAvatarPath(post.author),
    publishedAt: publishedAt.toISOString(),
    coverImage: resolvePostCoverImage(post.content, post.coverPath),
    summary: buildPostCardSummary(post),
    commentCount: post.commentCount,
    likeCount: post.likeCount,
    viewCount: post.viewCount,
  }
}

export async function processInternalPostCardEmbeds(content: string, options: ProcessInternalPostCardEmbedsOptions = {}) {
  const normalizedContent = content.replace(/\r\n/g, "\n")
  const lines = normalizedContent.split("\n")
  const routeSegments = new Set<string>()
  let inFence = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }

    if (inFence || routeSegments.size >= MAX_POST_CARD_EMBEDS_PER_CONTENT) {
      continue
    }

    const matched = extractInternalPostUrlFromLine(trimmed, options.requestUrl)
    if (matched) {
      routeSegments.add(matched.routeSegment)
    }
  }

  if (routeSegments.size === 0) {
    return content
  }

  const tokenByRouteSegment = new Map<string, string>()
  await Promise.all(Array.from(routeSegments).map(async (routeSegment) => {
    const post = await findPostCardEmbedSourceByRouteSegment(routeSegment)
    if (!post || post.id === options.currentPostId) {
      return
    }

    const snapshot = buildPostCardSnapshot(post)
    if (!snapshot) {
      return
    }

    tokenByRouteSegment.set(routeSegment, buildPostCardEmbedToken(snapshot))
  }))

  if (tokenByRouteSegment.size === 0) {
    return content
  }

  inFence = false
  return lines
    .map((line) => {
      const trimmed = line.trim()
      if (/^```/.test(trimmed)) {
        inFence = !inFence
        return line
      }

      if (inFence) {
        return line
      }

      const matched = extractInternalPostUrlFromLine(trimmed, options.requestUrl)
      if (!matched) {
        return line
      }

      return tokenByRouteSegment.get(matched.routeSegment) ?? line
    })
    .join("\n")
}
