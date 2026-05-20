import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { getBaseUserDisplayName, type UserDisplayNameSource } from "@/lib/user-display-shared"

export function getUserDisplayName(user: UserDisplayNameSource | null | undefined, fallback = "") {
  return getBaseUserDisplayName(user, fallback)
}

/**
 * 异步版：在同步 getUserDisplayName 基础上叠加 `user.displayName.value` waterfall hook,
 * 允许插件对最终展示名进行二次加工（脱敏、徽章前缀等）。调用方需在 async 上下文主动使用。
 */
export async function getUserDisplayNameWithAddons(
  user: UserDisplayNameSource | null | undefined,
  fallback = "",
) {
  const base = getUserDisplayName(user, fallback)
  const { value } = await executeAddonWaterfallHook("user.displayName.value", base)
  return value
}

export {
  getUserAvatarPath,
  maskUserName,
  shouldMaskBannedUser,
  type UserDisplayNameSource,
} from "@/lib/user-display-shared"
