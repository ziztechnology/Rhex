import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { RssSourceApplicationAdminPage } from "@/components/admin/rss-source-application-admin-page"
import { Button } from "@/components/ui/rbutton"
import { getAdminActorPermissionState } from "@/lib/admin-page-auth"
import { getRssSourceApplicationAdminPageData } from "@/lib/rss-source-application-admin"
import { getSiteSettings } from "@/lib/site-settings"

export const dynamic = "force-dynamic"

export async function generateMetadata(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const settings = await getSiteSettings()
  const searchParams = await props.searchParams
  const keyword = typeof searchParams?.keyword === "string" ? searchParams.keyword.trim() : ""

  return {
    title: `${keyword ? `${keyword} - ` : ""}RSS 收录申请 - ${settings.siteName}`,
  }
}

export default async function RssHarvestApplicationsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await getAdminActorPermissionState("admin.apps.manage")
  if (!auth.actor) {
    redirect("/login?redirect=/admin/apps/rss-harvest/applications")
  }
  if (!auth.authorized) {
    redirect("/admin")
  }
  const { actor: admin, tier: adminTier } = auth

  const searchParams = await props.searchParams
  const data = await getRssSourceApplicationAdminPageData({
    keyword: searchParams?.keyword,
    status: searchParams?.status,
    page: searchParams?.page,
    pageSize: searchParams?.pageSize,
  })

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      adminRole={admin.role}
      adminTier={adminTier}
      effectivePermissions={auth.effectivePermissions}
      headerDescription="审核用户提交的 RSS 源收录申请。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "内置应用", href: "/admin/apps" },
        { label: "RSS 抓取中心", href: "/admin/apps/rss-harvest" },
        { label: "RSS 收录申请" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Link href="/admin/apps/rss-harvest">
            <Button type="button" variant="outline">返回任务页</Button>
          </Link>
        </div>

        <RssSourceApplicationAdminPage initialData={data} />
      </div>
    </AdminShell>
  )
}
