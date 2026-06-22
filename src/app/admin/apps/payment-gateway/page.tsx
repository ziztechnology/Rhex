import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { PaymentGatewayAdminPage } from "@/components/admin/payment-gateway-admin-page"
import { getAdminActorPermissionState } from "@/lib/admin-page-auth"
import { getPaymentGatewayAdminData } from "@/lib/payment-gateway"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `支付网关 - ${settings.siteName}`,
  }
}

export default async function PaymentGatewayAdminRoute() {
  const auth = await getAdminActorPermissionState("admin.apps.manage")
  if (!auth.actor) {
    redirect("/login?redirect=/admin/apps/payment-gateway")
  }
  if (!auth.authorized) {
    redirect("/admin")
  }
  const { actor: admin, tier: adminTier } = auth

  const initialData = await getPaymentGatewayAdminData()

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      adminRole={admin.role}
      adminTier={adminTier}
      effectivePermissions={auth.effectivePermissions}
      headerDescription="维护支付网关基础配置、路由规则、积分充值套餐，以及选择每个业务场景使用哪个接口。"
      headerSearch={
        <div className="space-y-3">
          <AdminModuleSearch className="w-full" />
        </div>
      }
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "内置应用", href: "/admin/apps" },
        { label: "支付网关" },
      ]}
    >
      <PaymentGatewayAdminPage initialData={initialData} />
    </AdminShell>
  )
}
