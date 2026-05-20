function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function isWeChatBrowser() {
  return typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent)
}

function copyTextWithSelectionFallback(text: string) {
  if (!canUseDom() || !document.body) {
    return false
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const selection = document.getSelection()
  const selectedRanges: Range[] = []
  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      selectedRanges.push(selection.getRangeAt(index))
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "-9999px"
  textarea.style.opacity = "0"
  textarea.style.pointerEvents = "none"

  try {
    document.body.appendChild(textarea)
    textarea.focus({ preventScroll: true })
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    textarea.remove()
    if (selection) {
      try {
        selection.removeAllRanges()
        selectedRanges.forEach((range) => selection.addRange(range))
      } catch {}
    }
    if (activeElement && document.contains(activeElement)) {
      try {
        activeElement.focus({ preventScroll: true })
      } catch {}
    }
  }
}

export async function copyTextToClipboard(text: string) {
  if (!text || !canUseDom()) {
    return false
  }

  if (isWeChatBrowser() && copyTextWithSelectionFallback(text)) {
    return true
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return copyTextWithSelectionFallback(text)
    }
  }

  return copyTextWithSelectionFallback(text)
}
