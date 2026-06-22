import type { AdminPermissionKey } from "@/lib/admin-permission-policy"

export interface AdminPermissionCatalogItem {
  key: AdminPermissionKey
  label: string
  description: string
  group: "dashboard" | "content" | "users" | "operations" | "system"
  highRisk?: boolean
}

export const ADMIN_PERMISSION_CATALOG = [
  {
    key: "admin.overview.view",
    label: "查看总览",
    description: "访问后台总览、站点指标和运营待办。",
    group: "dashboard",
  },
  {
    key: "admin.content.manage",
    label: "管理帖子",
    description: "审核、下线、锁定、置顶和推荐帖子。",
    group: "content",
  },
  {
    key: "admin.comments.manage",
    label: "管理评论",
    description: "审核、隐藏、恢复和处理评论。",
    group: "content",
  },
  {
    key: "admin.structure.view",
    label: "查看版块",
    description: "查看分区、节点和节点申请信息。",
    group: "content",
  },
  {
    key: "admin.structure.create",
    label: "创建版块",
    description: "创建分区和节点。",
    group: "content",
  },
  {
    key: "admin.structure.edit",
    label: "编辑版块",
    description: "修改分区和节点的基础配置。",
    group: "content",
  },
  {
    key: "admin.structure.delete",
    label: "删除版块",
    description: "删除分区和节点，建议只授予可信管理员。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.structure.assignModerators",
    label: "任命版主",
    description: "为分区或节点设置版主、超级版主和审核员。",
    group: "content",
  },
  {
    key: "admin.users.manage",
    label: "管理用户",
    description: "编辑用户资料、状态、积分、VIP 和通知。",
    group: "users",
  },
  {
    key: "admin.users.manageAdmins",
    label: "管理管理员",
    description: "调整管理员角色和管理员动态权限。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.users.manageFounder",
    label: "管理超级管理员",
    description: "允许管理创始人账号，属于最高风险授权。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.users.grantBadges",
    label: "发放勋章",
    description: "配置勋章、手动为用户发放勋章。",
    group: "users",
  },
  {
    key: "admin.users.grantVerifications",
    label: "认证管理",
    description: "配置认证类型并审核用户认证申请。",
    group: "users",
  },
  {
    key: "admin.siteSettings.manage",
    label: "站点信息",
    description: "修改站点基础信息、注册、上传和互动设置。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.forumCore.manage",
    label: "论坛核心",
    description: "修改论坛核心配置。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.apps.manage",
    label: "内置应用",
    description: "管理内置应用和应用配置。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.addons.manage",
    label: "插件管理",
    description: "安装、启用和配置插件。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.theme.manage",
    label: "主题管理",
    description: "管理主题和外观扩展。",
    group: "system",
    highRisk: true,
  },
  {
    key: "admin.logs.view",
    label: "查看日志",
    description: "查看后台操作、登录、积分和上传日志。",
    group: "operations",
  },
  {
    key: "admin.operations.manage",
    label: "运营管理",
    description: "管理消息、举报、附件、公告、自定义页面、安全和运营设置。",
    group: "operations",
  },
] as const satisfies ReadonlyArray<AdminPermissionCatalogItem>

export const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSION_CATALOG.map((item) => item.key)

export const ADMIN_PERMISSION_KEY_SET: ReadonlySet<AdminPermissionKey> = new Set(ADMIN_PERMISSION_KEYS)

export function isAdminPermissionKey(value: unknown): value is AdminPermissionKey {
  return typeof value === "string" && ADMIN_PERMISSION_KEY_SET.has(value as AdminPermissionKey)
}
