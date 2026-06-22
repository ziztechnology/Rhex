import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { RssEntryAdminPage } from "@/components/admin/rss-entry-admin-page"
import { AdminShell } from "@/components/admin/admin-shell"
import { Button } from "@/components/ui/rbutton"
import { getAdminActorPermissionState } from "@/lib/admin-page-auth"
import { getRssEntryAdminPageData } from "@/lib/rss-entry-admin"
import { getSiteSettings } from "@/lib/site-settings"

export const dynamic = "force-dynamic"

export async function generateMetadata(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const settings = await getSiteSettings()
  const searchParams = await props.searchParams
  const keyword = typeof searchParams?.keyword === "string" ? searchParams.keyword.trim() : ""

  return {
    title: `${keyword ? `${keyword} - ` : ""}RSS 采集数据 - ${settings.siteName}`,
  }
}

export default async function RssHarvestEntriesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await getAdminActorPermissionState("admin.apps.manage")
  if (!auth.actor) {
    redirect("/login?redirect=/admin/apps/rss-harvest/entries")
  }
  if (!auth.authorized) {
    redirect("/admin")
  }
  const { actor: admin, tier: adminTier } = auth

  const searchParams = await props.searchParams
  const data = await getRssEntryAdminPageData({
    keyword: searchParams?.keyword,
    sourceId: searchParams?.sourceId,
    reviewStatus: searchParams?.reviewStatus,
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
      headerDescription="查看 RSS 入库内容，执行审核、编辑和批量处理。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "内置应用", href: "/admin/apps" },
        { label: "RSS 抓取中心", href: "/admin/apps/rss-harvest" },
        { label: "RSS 采集数据" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Link href="/admin/apps/rss-harvest">
            <Button type="button" variant="outline">返回任务页</Button>
          </Link>
        </div>

        <RssEntryAdminPage initialData={data} />
      </div>
    </AdminShell>
  )
}
