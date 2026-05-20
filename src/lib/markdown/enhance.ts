import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

import { MarkdownLinkIndicator } from "@/components/markdown-link-indicator"
import { copyTextToClipboard } from "@/lib/clipboard"
import { buildMarkdownLinkAriaLabel, getMarkdownLinkHint } from "@/lib/markdown/link-hint"
import { escapeHtml } from "@/lib/markdown/shared"

export interface LightboxImage {
  src: string
  alt: string
}

interface MarkdownEnhancementOptions {
  collapseLongCodeBlocks?: boolean
}

interface Base64SegmentMatch {
  start: number
  end: number
  value: string
  decoded: string
}

interface MarkdownLinkIndicatorHost extends HTMLSpanElement {
  __mdLinkIndicatorRoot?: Root
}

const BASE64_CANDIDATE_PATTERN = /[A-Za-z0-9+/]+={0,2}/g
const BASE64_MIN_LENGTH = 16
const BASE64_TEXT_NODE_EXCLUDE_SELECTOR = "a, button, code, pre, input, textarea, script, style, .md-copy-button, .md-base64-token, .md-heading-anchor, .katex, .hljs, .mermaid"
const CODE_BLOCK_COLLAPSE_LINE_THRESHOLD = 24
const CODE_BLOCK_COLLAPSE_HEIGHT_THRESHOLD = 520
let codeBlockToggleBindingSequence = 0

function getLightboxImageElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLImageElement>("img"))
    .filter((image) => image.dataset.imageError !== "true" && !image.closest(".md-emoji-image"))
}

function getLightboxImages(container: HTMLElement) {
  return getLightboxImageElements(container)
    .map((img) => ({ src: img.getAttribute("src")?.trim() ?? "", alt: img.getAttribute("alt") ?? "" }))
    .filter((img) => img.src)
}

export function bindImageLightbox(container: HTMLElement, onOpen: (images: LightboxImage[], index: number) => void) {
  const imageEls = getLightboxImageElements(container)

  for (const image of imageEls) {
    image.classList.add("cursor-zoom-in", "transition-opacity", "hover:opacity-90")
    image.setAttribute("role", "button")
    image.setAttribute("tabindex", "0")
    image.setAttribute("aria-label", image.getAttribute("alt")?.trim() || "点击放大图片")
  }

  const handleContainerClick = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return
    if (target.closest(".md-emoji-image")) return
    const src = target.getAttribute("src")?.trim()
    if (!src) return
    if (target.dataset.imageError === "true") return
    const images = getLightboxImages(container)
    const index = images.findIndex((img) => img.src === src)
    if (index === -1) return
    onOpen(images, index)
  }

  const handleContainerKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return
    const target = keyboardEvent.target
    if (!(target instanceof HTMLImageElement)) return
    if (target.closest(".md-emoji-image")) return
    const src = target.getAttribute("src")?.trim()
    if (!src) return
    if (target.dataset.imageError === "true") return
    const images = getLightboxImages(container)
    const index = images.findIndex((img) => img.src === src)
    if (index === -1) return
    keyboardEvent.preventDefault()
    onOpen(images, index)
  }

  container.addEventListener("click", handleContainerClick)
  container.addEventListener("keydown", handleContainerKeyDown)

  return () => {
    container.removeEventListener("click", handleContainerClick)
    container.removeEventListener("keydown", handleContainerKeyDown)
  }
}

function createMarkdownLinkIndicatorHost(href: string) {
  const host = document.createElement("span") as MarkdownLinkIndicatorHost
  host.className = "md-link-indicator inline-flex shrink-0"

  const root = createRoot(host)
  host.__mdLinkIndicatorRoot = root
  root.render(createElement(MarkdownLinkIndicator, { href }))

  return host
}

function disposeMarkdownLinkIndicatorHost(host: MarkdownLinkIndicatorHost) {
  const root = host.__mdLinkIndicatorRoot
  host.__mdLinkIndicatorRoot = undefined
  host.remove()

  if (!root) {
    return
  }

  // Defer unmounting the ad-hoc root to avoid conflicting with the current render.
  setTimeout(() => {
    root.unmount()
  }, 0)
}

function enhanceMarkdownLinks(container: HTMLElement) {
  const cleanups: Array<() => void> = []
  const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"))

  for (const link of links) {
    if (
      link.classList.contains("md-heading-anchor")
      || link.classList.contains("footnote-ref")
      || link.classList.contains("footnote-backref")
      || link.querySelector("img")
    ) {
      continue
    }

    link.classList.add("inline-flex", "flex-wrap", "items-center", "gap-1", "align-baseline")

    const href = link.getAttribute("href")?.trim() ?? ""
    const hint = getMarkdownLinkHint(href)
    const existingIndicator = link.querySelector<MarkdownLinkIndicatorHost>(":scope > .md-link-indicator")

    link.removeAttribute("title")

    if (!hint) {
      if (existingIndicator) {
        disposeMarkdownLinkIndicatorHost(existingIndicator)
      }

      continue
    }

    link.setAttribute("aria-label", buildMarkdownLinkAriaLabel(link.textContent, hint))

    if (existingIndicator) {
      continue
    }

    const indicatorHost = createMarkdownLinkIndicatorHost(href)
    link.append(indicatorHost)
    cleanups.push(() => {
      disposeMarkdownLinkIndicatorHost(indicatorHost)
    })
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

function createBrokenImagePlaceholder(image: HTMLImageElement) {
  const placeholder = document.createElement("div")
  placeholder.className = "md-image-fallback my-4 rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/80 px-4 py-5 text-sm text-amber-900 shadow-xs dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-100"

  const title = document.createElement("p")
  title.className = "font-medium"
  title.textContent = "图片加载失败"

  const description = document.createElement("p")
  description.className = "mt-1 text-xs leading-6 text-amber-800/90 dark:text-amber-200/90"
  description.textContent = image.getAttribute("alt")?.trim()
    ? `图片“${image.getAttribute("alt")?.trim()}”暂时无法显示，可能已被删除或链接失效。`
    : "该图片暂时无法显示，可能已被删除或链接失效。"

  const source = image.currentSrc || image.getAttribute("src")?.trim()

  placeholder.append(title, description)

  if (source) {
    const link = document.createElement("a")
    link.className = "mt-3 inline-flex text-xs font-medium text-amber-900 underline underline-offset-4 transition-opacity hover:opacity-80 dark:text-amber-100"
    link.href = source
    link.target = "_blank"
    link.rel = "noreferrer noopener"
    link.textContent = "打开图片链接"
    placeholder.append(link)
  }

  return placeholder
}

function setBrokenImageState(image: HTMLImageElement) {
  if (image.dataset.imageError === "true") {
    return
  }

  image.dataset.imageError = "true"
  image.classList.add("hidden")
  image.classList.remove("cursor-zoom-in", "transition-opacity", "hover:opacity-90")
  image.removeAttribute("role")
  image.removeAttribute("tabindex")
  image.removeAttribute("aria-label")

  const nextSibling = image.nextElementSibling
  if (!(nextSibling instanceof HTMLElement) || !nextSibling.classList.contains("md-image-fallback")) {
    image.insertAdjacentElement("afterend", createBrokenImagePlaceholder(image))
  }
}

function clearBrokenImageState(image: HTMLImageElement) {
  image.dataset.imageError = "false"
  image.classList.remove("hidden")

  const nextSibling = image.nextElementSibling
  if (nextSibling instanceof HTMLElement && nextSibling.classList.contains("md-image-fallback")) {
    nextSibling.remove()
  }
}

export function bindBrokenImagePlaceholders(container: HTMLElement) {
  const imageEls = Array.from(container.querySelectorAll<HTMLImageElement>("img"))
  const cleanups = imageEls.map((image) => {
    const handleLoad = () => {
      clearBrokenImageState(image)
    }

    const handleError = () => {
      setBrokenImageState(image)
    }

    image.addEventListener("load", handleLoad)
    image.addEventListener("error", handleError)

    if (image.complete) {
      if (image.naturalWidth > 0) {
        clearBrokenImageState(image)
      } else {
        setBrokenImageState(image)
      }
    }

    return () => {
      image.removeEventListener("load", handleLoad)
      image.removeEventListener("error", handleError)
    }
  })

  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

function isBase64BoundaryCharacter(char: string | undefined) {
  return Boolean(char && /[A-Za-z0-9+/=]/.test(char))
}

function isLikelyReadableDecodedText(value: string) {
  const normalized = value.replace(/^\uFEFF/, "").trim()
  if (!normalized) {
    return false
  }

  let invalidControlCount = 0
  for (const char of normalized) {
    const code = char.charCodeAt(0)
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || (code >= 127 && code <= 159)) {
      invalidControlCount += 1
    }
  }

  return invalidControlCount === 0
}

function decodeBase64Utf8(value: string) {
  if (
    value.length < BASE64_MIN_LENGTH
    || value.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    return null
  }

  const firstPaddingIndex = value.indexOf("=")
  if (firstPaddingIndex !== -1 && !/^=+$/.test(value.slice(firstPaddingIndex))) {
    return null
  }

  try {
    const binary = window.atob(value)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "")
    return isLikelyReadableDecodedText(decoded) ? decoded : null
  } catch {
    return null
  }
}

function findBase64SegmentMatches(text: string) {
  const matches: Base64SegmentMatch[] = []

  for (const match of text.matchAll(BASE64_CANDIDATE_PATTERN)) {
    const value = match[0]
    const start = match.index ?? -1
    const end = start + value.length

    if (
      start < 0
      || value.length < BASE64_MIN_LENGTH
      || isBase64BoundaryCharacter(text[start - 1])
      || isBase64BoundaryCharacter(text[end])
    ) {
      continue
    }

    const decoded = decodeBase64Utf8(value)
    if (!decoded) {
      continue
    }

    matches.push({ start, end, value, decoded })
  }

  return matches
}

function createBase64TokenElement(original: string, decoded: string) {
  const wrapper = document.createElement("span")
  wrapper.dataset.base64Token = "true"
  wrapper.dataset.base64State = "collapsed"
  wrapper.className = "md-base64-token my-1 inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle"

  const collapsedView = document.createElement("span")
  collapsedView.dataset.base64View = "collapsed"
  collapsedView.className = "inline-flex max-w-full flex-wrap items-center gap-1.5"

  const source = document.createElement("code")
  source.className = "max-w-full break-all bg-transparent p-0 font-mono text-[12px] leading-6 text-muted-foreground"
  source.textContent = original

  const decodeButton = document.createElement("button")
  decodeButton.type = "button"
  decodeButton.dataset.base64Action = "decode"
  decodeButton.className = "inline-flex shrink-0 items-center text-[12px] leading-6 text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
  decodeButton.textContent = "原文"
  decodeButton.title = "查看原文"

  const collapsedSeparator = document.createElement("span")
  collapsedSeparator.className = "shrink-0 text-[12px] leading-6 text-muted-foreground/55"
  collapsedSeparator.textContent = "|"

  collapsedView.append(source, collapsedSeparator, decodeButton)

  const decodedView = document.createElement("span")
  decodedView.dataset.base64View = "decoded"
  decodedView.className = "inline-flex max-w-full flex-wrap items-center gap-1.5"
  decodedView.hidden = true

  const restoreButton = document.createElement("button")
  restoreButton.type = "button"
  restoreButton.dataset.base64Action = "restore"
  restoreButton.className = "inline-flex shrink-0 items-center text-[12px] leading-6 text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
  restoreButton.textContent = "恢复"
  restoreButton.title = "恢复为 Base64"

  const copyButton = document.createElement("button")
  copyButton.type = "button"
  copyButton.dataset.base64Action = "copy"
  copyButton.className = "inline-flex shrink-0 items-center text-[12px] leading-6 text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
  copyButton.textContent = "复制"
  copyButton.title = "复制解密内容"

  const decodedSeparator = document.createElement("span")
  decodedSeparator.className = "shrink-0 text-[12px] leading-6 text-muted-foreground/55"
  decodedSeparator.textContent = "|"

  const restoreSeparator = document.createElement("span")
  restoreSeparator.className = "shrink-0 text-[12px] leading-6 text-muted-foreground/55"
  restoreSeparator.textContent = "|"

  const decodedContent = document.createElement("span")
  decodedContent.dataset.base64Decoded = "true"
  decodedContent.className = "max-w-full whitespace-pre-wrap break-all text-[13px] leading-6 text-foreground"
  decodedContent.textContent = decoded

  decodedView.append(decodedContent, decodedSeparator, copyButton, restoreSeparator, restoreButton)
  wrapper.append(collapsedView, decodedView)
  return wrapper
}

function replaceBase64SegmentsInTextNode(textNode: Text) {
  const text = textNode.nodeValue ?? ""
  const matches = findBase64SegmentMatches(text)

  if (matches.length === 0 || !textNode.parentNode) {
    return
  }

  const fragment = document.createDocumentFragment()
  let cursor = 0

  for (const match of matches) {
    if (match.start > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, match.start)))
    }

    fragment.append(createBase64TokenElement(match.value, match.decoded))
    cursor = match.end
  }

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)))
  }

  textNode.parentNode.replaceChild(fragment, textNode)
}

export function bindBase64Inspector(container: HTMLElement) {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const textNode = node as Text
      const value = textNode.nodeValue ?? ""
      const parentElement = textNode.parentElement

      if (!parentElement || !value.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      if (parentElement.closest(BASE64_TEXT_NODE_EXCLUDE_SELECTOR)) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  for (const textNode of textNodes) {
    replaceBase64SegmentsInTextNode(textNode)
  }

  const handleClick = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const button = target.closest<HTMLButtonElement>("button[data-base64-action]")
    if (!button || !container.contains(button)) {
      return
    }

    const token = button.closest<HTMLElement>("[data-base64-token='true']")
    if (!token) {
      return
    }

    const collapsedView = token.querySelector<HTMLElement>("[data-base64-view='collapsed']")
    const decodedView = token.querySelector<HTMLElement>("[data-base64-view='decoded']")
    const decodedContent = token.querySelector<HTMLElement>("[data-base64-decoded='true']")
    const copyButton = token.querySelector<HTMLButtonElement>("button[data-base64-action='copy']")

    if (!collapsedView || !decodedView || !decodedContent || !copyButton) {
      return
    }

    if (button.dataset.base64Action === "decode") {
      collapsedView.hidden = true
      decodedView.hidden = false
      token.dataset.base64State = "decoded"
      return
    }

    if (button.dataset.base64Action === "copy") {
      const rawText = decodedContent.textContent ?? ""
      if (!rawText) {
        return
      }

      void copyTextToClipboard(rawText).then((copied) => {
        const previousText = copyButton.textContent
        copyButton.textContent = copied ? "已复制" : "复制失败"
        window.setTimeout(() => {
          copyButton.textContent = previousText
        }, 1500)
      })
      return
    }

    decodedView.hidden = true
    collapsedView.hidden = false
    token.dataset.base64State = "collapsed"
  }

  container.addEventListener("click", handleClick)
  return () => {
    container.removeEventListener("click", handleClick)
  }
}

function appendHeadingAnchors(container: HTMLElement) {
  const headingSelectors = "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
  for (const heading of Array.from(container.querySelectorAll<HTMLElement>(headingSelectors))) {
    if (heading.querySelector(":scope > a.md-heading-anchor")) {
      continue
    }

    const anchor = document.createElement("a")
    anchor.className = "md-heading-anchor"
    anchor.href = `#${heading.id}`
    anchor.setAttribute("aria-label", `链接到 ${heading.textContent ?? "标题"}`)
    anchor.textContent = "#"
    heading.appendChild(anchor)
  }
}

function appendCodeCopyButtons(container: HTMLElement) {
  for (const codeBlock of Array.from(container.querySelectorAll<HTMLElement>("pre.md-code-block"))) {
    const header = codeBlock.querySelector<HTMLElement>(":scope > .md-code-header")
    if (!header || header.querySelector(".md-copy-button")) {
      continue
    }

    const button = document.createElement("button")
    button.type = "button"
    button.className = "md-copy-button"
    button.textContent = "复制"
    button.addEventListener("click", async () => {
      const code = codeBlock.querySelector("code")?.textContent ?? ""
      if (!code) {
        return
      }

      button.textContent = await copyTextToClipboard(code) ? "已复制" : "失败"
      window.setTimeout(() => {
        button.textContent = "复制"
      }, 1500)
    })
    header.appendChild(button)
  }
}

function bindLongCodeBlockToggles(container: HTMLElement) {
  const cleanups: Array<() => void> = []

  for (const codeBlock of Array.from(container.querySelectorAll<HTMLElement>("pre.md-code-block"))) {
    const header = codeBlock.querySelector<HTMLElement>(":scope > .md-code-header")
    const code = codeBlock.querySelector<HTMLElement>(":scope > code")

    if (!header || !code) {
      continue
    }

    header.querySelector(".md-code-toggle-button")?.remove()
    codeBlock.querySelector(".md-code-bottom-toggle-button")?.remove()
    delete codeBlock.dataset.codeCollapsible
    delete codeBlock.dataset.codeExpanded
    delete codeBlock.dataset.codeToggleBinding

    const source = code.textContent ?? ""
    const lineCount = source.split(/\r\n|\r|\n/).length
    const shouldCollapse = lineCount >= CODE_BLOCK_COLLAPSE_LINE_THRESHOLD || code.scrollHeight >= CODE_BLOCK_COLLAPSE_HEIGHT_THRESHOLD

    if (!shouldCollapse) {
      continue
    }

    const button = document.createElement("button")
    button.type = "button"
    button.className = "md-code-toggle-button"
    button.setAttribute("aria-expanded", "false")
    button.textContent = "展开代码"

    const bottomButton = document.createElement("button")
    bottomButton.type = "button"
    bottomButton.className = "md-code-bottom-toggle-button"
    bottomButton.setAttribute("aria-expanded", "false")
    const bindingId = String(++codeBlockToggleBindingSequence)
    bottomButton.textContent = "展开代码"

    const setExpanded = (expanded: boolean) => {
      codeBlock.dataset.codeExpanded = String(expanded)
      button.setAttribute("aria-expanded", String(expanded))
      bottomButton.setAttribute("aria-expanded", String(expanded))
      button.textContent = expanded ? "收起代码" : "展开代码"
      bottomButton.textContent = expanded ? "收起代码" : "展开代码"
      bottomButton.hidden = expanded
    }

    const handleClick = () => {
      setExpanded(codeBlock.dataset.codeExpanded !== "true")
    }

    codeBlock.dataset.codeCollapsible = "true"
    codeBlock.dataset.codeToggleBinding = bindingId
    setExpanded(false)
    button.addEventListener("click", handleClick)
    bottomButton.addEventListener("click", handleClick)
    header.appendChild(button)
    codeBlock.appendChild(bottomButton)
    cleanups.push(() => {
      button.removeEventListener("click", handleClick)
      bottomButton.removeEventListener("click", handleClick)
      if (codeBlock.dataset.codeToggleBinding !== bindingId) {
        return
      }

      button.remove()
      bottomButton.remove()
      delete codeBlock.dataset.codeCollapsible
      delete codeBlock.dataset.codeExpanded
      delete codeBlock.dataset.codeToggleBinding
    })
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

async function renderMermaidBlocks(container: HTMLElement) {
  const mermaidBlocks = Array.from(container.querySelectorAll<HTMLElement>("[data-mermaid]"))
  if (mermaidBlocks.length === 0) {
    return
  }

  const { default: mermaid } = await import("mermaid")

  const isDark = document.documentElement.classList.contains("dark")
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: isDark ? "dark" : "default",
    flowchart: {
      htmlLabels: false,
    },
  })

  await Promise.all(
    mermaidBlocks.map(async (block) => {
      if (block.dataset.processed === "true") {
        return
      }

      const source = block.dataset.mermaid ?? ""
      if (!source.trim()) {
        return
      }

      try {
        const parsed = await mermaid.parse(source, { suppressErrors: true })
        if (!parsed) {
          throw new Error("Invalid Mermaid syntax")
        }

        block.classList.add("mermaid")
        block.textContent = source
        await mermaid.run({
          nodes: [block],
          suppressErrors: false,
        })
        block.dataset.processed = "true"
      } catch {
        block.innerHTML = `<pre class="my-0 overflow-x-auto rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><code>${escapeHtml(source)}</code></pre><p class="mt-3 text-sm text-rose-700 dark:text-rose-300">Mermaid 图表渲染失败，请检查语法。</p>`
      }
    }),
  )
}

async function highlightCodeBlocks(container: HTMLElement) {
  const codeBlocks = Array.from(container.querySelectorAll<HTMLElement>("pre.md-code-block code[class*='language-']"))
    .filter((codeBlock) => !codeBlock.closest("[data-mermaid]") && codeBlock.dataset.highlighted !== "true")

  if (codeBlocks.length === 0) {
    return
  }

  const { default: hljs } = await import("highlight.js")

  for (const codeBlock of codeBlocks) {
    const languageClass = Array.from(codeBlock.classList).find((className) => className.startsWith("language-"))
    const languageName = languageClass?.slice("language-".length) ?? ""
    const source = codeBlock.textContent ?? ""

    try {
      const highlighted = languageName && hljs.getLanguage(languageName)
        ? hljs.highlight(source, { language: languageName, ignoreIllegals: true }).value
        : hljs.highlightAuto(source).value

      codeBlock.innerHTML = highlighted
      codeBlock.dataset.highlighted = "true"
    } catch {
      codeBlock.textContent = source
    }
  }
}

export async function enhanceMarkdown(container: HTMLElement, options: MarkdownEnhancementOptions = {}) {
  const removeMarkdownLinkIndicators = enhanceMarkdownLinks(container)
  appendHeadingAnchors(container)
  appendCodeCopyButtons(container)
  const removeLongCodeBlockToggles = options.collapseLongCodeBlocks
    ? bindLongCodeBlockToggles(container)
    : () => {}
  await Promise.all([
    highlightCodeBlocks(container),
    renderMermaidBlocks(container),
  ])
  return () => {
    removeMarkdownLinkIndicators()
    removeLongCodeBlockToggles()
  }
}
