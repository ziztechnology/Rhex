import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AddonsHostAdminPage } from "@/components/admin/addons-host-admin-page"
import { AdminShell } from "@/components/admin/admin-shell"
import { getAddonsAdminData } from "@/addons-host/management"
import { getAdminActorPermissionState } from "@/lib/admin-page-auth"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `插件宿主 - ${settings.siteName}`,
  }
}

export default async function AdminAddonsPage() {
  const auth = await getAdminActorPermissionState("admin.addons.manage")
  if (!auth.actor) {
    redirect("/login?redirect=/admin/addons")
  }
  if (!auth.authorized) {
    redirect("/admin")
  }
  const { actor: admin, tier: adminTier } = auth

  const data = await getAddonsAdminData()

  return (
    <AdminShell
      currentKey="addons"
      adminName={admin.nickname ?? admin.username}
      adminRole={admin.role}
      adminTier={adminTier}
      effectivePermissions={auth.effectivePermissions}
      headerDescription="查看已安装的插件、页面、API、Provider、Hook 和挂载状态。"
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "插件管理" },
      ]}
    >
      <AddonsHostAdminPage initialData={data} />
    </AdminShell>
  )
}
