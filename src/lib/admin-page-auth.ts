import type { AdminPermissionKey } from "@/lib/admin-permission-policy"
import { resolveAdminPermissionState } from "@/lib/admin-permission-overrides"
import { requireAdminActor } from "@/lib/moderator-permissions"

export async function requireAdminActorWithPermission(
  permission: AdminPermissionKey,
) {
  const state = await getAdminActorPermissionState(permission)
  return state.authorized ? state : null
}

export async function getAdminActorPermissionState(
  permission: AdminPermissionKey,
) {
  const admin = await requireAdminActor()

  if (!admin) {
    return {
      actor: null,
      tier: "USER" as const,
      authorized: false,
      reason: "unauthenticated" as const,
      effectivePermissions: [] as AdminPermissionKey[],
    }
  }

  const permissionState = await resolveAdminPermissionState(admin)
  const tier = permissionState.tier
  if (!permissionState.effectivePermissions.includes(permission)) {
    return {
      actor: admin,
      tier,
      authorized: false,
      reason: "forbidden" as const,
      effectivePermissions: permissionState.effectivePermissions,
    }
  }

  return {
    actor: admin,
    tier,
    authorized: true,
    reason: null,
    effectivePermissions: permissionState.effectivePermissions,
  }
}
