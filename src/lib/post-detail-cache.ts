import "server-only"

import { createHash } from "node:crypto"
import { revalidateTag, unstable_cache } from "next/cache"

import { renderAddonPostContentHtml } from "@/lib/addon-post-content-render"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { MARKDOWN_RENDER_OUTPUT_VERSION } from "@/lib/markdown/render"
import { getConfiguredSiteOrigin, normalizeSiteOrigin } from "@/lib/site-origin-config"
import type { PostLinkDisplayMode } from "@/lib/site-settings"

export const POST_SEO_CACHE_TAG = "post-seo"
export const POST_DETAIL_DATA_CACHE_TAG = "post-detail-data"
export const POST_COMMENT_LIST_CACHE_TAG = "post-comment-list"
export const POST_SIDEBAR_CACHE_TAG = "post-sidebar"
export const POST_RENDERED_CONTENT_CACHE_TAG = "post-rendered-content"
export const POST_VIEWER_CACHE_TAG = "post-viewer"

export const POST_DETAIL_CACHE_REVALIDATE_SECONDS = 60 * 60
export const POST_PERSONALIZED_CACHE_REVALIDATE_SECONDS = 5 * 60

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

function stableJson(value: unknown) {
  return JSON.stringify(value) ?? "null"
}

function normalizeAllowedOrigins(origins: readonly string[]) {
  const normalizedOrigins: string[] = []

  for (const origin of origins) {
    try {
      const normalized = normalizeSiteOrigin(origin)
      const url = new URL(normalized)
      if ((url.protocol === "http:" || url.protocol === "https:") && !normalizedOrigins.includes(normalized)) {
        normalizedOrigins.push(normalized)
      }
    } catch {
      // Ignore invalid origin values from request-derived context.
    }
  }

  return normalizedOrigins
}

export function getPostSeoCacheTag(slug: string) {
  return `${POST_SEO_CACHE_TAG}:${digest(slug)}`
}

export function getPostDetailDataCacheTag(postId: string) {
  return `${POST_DETAIL_DATA_CACHE_TAG}:${postId}`
}

export function getPostDetailSlugCacheTag(slug: string) {
  return `${POST_DETAIL_DATA_CACHE_TAG}:slug:${digest(slug)}`
}

export function getPostCommentListCacheTag(postId: string) {
  return `${POST_COMMENT_LIST_CACHE_TAG}:${postId}`
}

export function getPostSidebarCacheTag(postId: string) {
  return `${POST_SIDEBAR_CACHE_TAG}:${postId}`
}

export function getPostRenderedContentCacheTag(postId: string) {
  return `${POST_RENDERED_CONTENT_CACHE_TAG}:${postId}`
}

export function getPostViewerCacheTag(userId: number) {
  return `${POST_VIEWER_CACHE_TAG}:${userId}`
}

function isMissingRevalidateStoreError(error: unknown) {
  return error instanceof Error
    && error.message.startsWith("Invariant: static generation store missing in revalidateTag")
}

function isRenderPhaseRevalidateError(error: unknown) {
  return error instanceof Error
    && error.message.includes('used "revalidateTag ')
    && error.message.includes("during render which is unsupported")
}

function revalidatePostDetailTag(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 })
  } catch (error) {
    if (isMissingRevalidateStoreError(error) || isRenderPhaseRevalidateError(error)) {
      return
    }

    throw error
  }
}

export function revalidatePostDetailCache(input: { postId?: string | null; slug?: string | null }) {
  if (input.slug) {
    revalidatePostDetailTag(getPostSeoCacheTag(input.slug))
    revalidatePostDetailTag(getPostDetailSlugCacheTag(input.slug))
  }

  if (input.postId) {
    revalidatePostDetailTag(getPostDetailDataCacheTag(input.postId))
    revalidatePostDetailTag(getPostCommentListCacheTag(input.postId))
    revalidatePostDetailTag(getPostSidebarCacheTag(input.postId))
    revalidatePostDetailTag(getPostRenderedContentCacheTag(input.postId))
  }
}

export function revalidatePostDataCache(input: { postId?: string | null; slug?: string | null }) {
  if (input.slug) {
    revalidatePostDetailTag(getPostDetailSlugCacheTag(input.slug))
  }

  if (input.postId) {
    revalidatePostDetailTag(getPostDetailDataCacheTag(input.postId))
    revalidatePostDetailTag(getPostSidebarCacheTag(input.postId))
  }
}

export function revalidatePostCommentCache(input: { postId?: string | null; slug?: string | null }) {
  if (input.slug) {
    revalidatePostDetailTag(getPostDetailSlugCacheTag(input.slug))
  }

  if (input.postId) {
    revalidatePostDetailTag(getPostDetailDataCacheTag(input.postId))
    revalidatePostDetailTag(getPostCommentListCacheTag(input.postId))
  }
}

export function revalidatePostSidebarCache(input: { postId?: string | null; slug?: string | null }) {
  if (input.slug) {
    revalidatePostDetailTag(getPostDetailSlugCacheTag(input.slug))
  }

  if (input.postId) {
    revalidatePostDetailTag(getPostSidebarCacheTag(input.postId))
  }
}

export function revalidatePostViewerCache(userId?: number | null) {
  if (typeof userId === "number" && Number.isSafeInteger(userId)) {
    revalidatePostDetailTag(getPostViewerCacheTag(userId))
  }
}

export async function renderCachedPostContentHtml(input: {
  postId: string
  blockId: string
  content: string
  markdownEmojiMap: MarkdownEmojiItem[]
  pathname?: string
  searchParams?: URLSearchParams | string
  allowedOrigins?: readonly string[]
  postLinkDisplayMode?: PostLinkDisplayMode
}) {
  const pathname = input.pathname ?? ""
  const searchParamsString = typeof input.searchParams === "string"
    ? input.searchParams
    : (input.searchParams?.toString() ?? "")
  const postLinkDisplayMode = input.postLinkDisplayMode ?? "ID"
  const configuredSiteOrigin = getConfiguredSiteOrigin()
  const allowedOrigins = normalizeAllowedOrigins([
    ...(configuredSiteOrigin ? [configuredSiteOrigin] : []),
    ...(input.allowedOrigins ?? []),
  ])
  const contentDigest = digest(input.content)
  const emojiDigest = digest(stableJson(input.markdownEmojiMap))
  const requestContextDigest = digest(`${pathname}\n${searchParamsString}\n${stableJson(allowedOrigins)}\n${postLinkDisplayMode}`)

  return unstable_cache(
    async () => renderAddonPostContentHtml({
      content: input.content,
      markdownEmojiMap: input.markdownEmojiMap,
      pathname: pathname || undefined,
      searchParams: searchParamsString ? new URLSearchParams(searchParamsString) : undefined,
      allowedOrigins,
      currentPostId: input.postId,
      postLinkDisplayMode,
    }),
    [
      POST_RENDERED_CONTENT_CACHE_TAG,
      input.postId,
      input.blockId,
      contentDigest,
      emojiDigest,
      requestContextDigest,
      MARKDOWN_RENDER_OUTPUT_VERSION,
    ],
    {
      tags: [POST_RENDERED_CONTENT_CACHE_TAG, getPostRenderedContentCacheTag(input.postId)],
      revalidate: POST_DETAIL_CACHE_REVALIDATE_SECONDS,
    },
  )()
}
