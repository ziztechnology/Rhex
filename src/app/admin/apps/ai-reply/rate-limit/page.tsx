import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { AiReplyRateLimitPage } from "@/components/admin/ai-reply-rate-limit-page"
import { getAdminActorPermissionState } from "@/lib/admin-page-auth"

export const metadata: Metadata = {
  title: "AI 回复 · 日调用上限",
}

export default async function AdminAiReplyRateLimitPage() {
  const auth = await getAdminActorPermissionState("admin.apps.manage")
  if (!auth.actor) {
    redirect("/login?redirect=/admin/apps/ai-reply/rate-limit")
  }
  if (!auth.authorized) {
    redirect("/admin")
  }
  const { actor: admin, tier: adminTier } = auth

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      adminRole={admin.role}
      adminTier={adminTier}
      effectivePermissions={auth.effectivePermissions}
      headerDescription="查看并调整 AI 回复每日调用上限。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "内置应用", href: "/admin/apps" },
        { label: "AI 回复", href: "/admin/apps/ai-reply" },
        { label: "日调用上限" },
      ]}
    >
      <div className="space-y-6">
        <AiReplyRateLimitPage />
      </div>
    </AdminShell>
  )
}
