function stringToHue(input: string) {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = input.charCodeAt(index) + ((hash << 5) - hash)
  }

  return Math.abs(hash) % 360
}

export function getAvatarFallback(name: string) {
  const trimmed = name.trim()
  if (!trimmed) {
    return "U"
  }

  const characters = Array.from(trimmed.replace(/\s+/g, ""))
  const fallback = characters[0]

  return (fallback || "U").toUpperCase()
}

export function getAvatarColor(name: string) {
  const hue = stringToHue(name)
  return {
    background: `hsl(${hue} 72% 92%)`,
    foreground: `hsl(${hue} 48% 28%)`,
  }
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function createGeneratedAvatarDataUrl(name: string) {
  const fallback = escapeSvgText(getAvatarFallback(name))
  const colors = getAvatarColor(name)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${fallback}">
      <rect width="96" height="96" rx="24" fill="${colors.background}" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="${colors.foreground}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="34" font-weight="700" letter-spacing="1">${fallback}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function getAvatarUrl(avatarPath: string | null | undefined, name: string) {
  if (avatarPath && avatarPath.trim()) {
    return avatarPath
  }

  return createGeneratedAvatarDataUrl(name)
}
