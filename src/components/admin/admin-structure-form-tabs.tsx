"use client"

import { useState, useTransition } from "react"

import { AddonEditor } from "@/components/addon-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { IconPicker } from "@/components/ui/icon-picker"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import type {
  BoardSidebarLinkDraft,
  ModalMode,
  PostEditRuleDraft,
  StructureFormState,
} from "@/components/admin/admin-structure.types"
import {
  BoardSidebarLinkEditor,
  Field,
  getStructureAccessFieldHelp,
  getStructureNumericFieldHelp,
  postTypeOptions,
  SelectField,
  TextAreaField,
  Toggle,
} from "@/components/admin/admin-structure.shared"
import type { ZoneItem } from "@/lib/admin-structure-management"
import type { StructureModeratorItem } from "@/lib/admin-structure-management"
import { formatPostEditWindowLabel, type PostEditWindowRuleSubject } from "@/lib/post-edit-window"
import { POST_LIST_DISPLAY_MODE_DEFAULT, POST_LIST_DISPLAY_MODE_GALLERY, POST_LIST_DISPLAY_MODE_WEIBO } from "@/lib/post-list-display"
import { POST_LIST_LOAD_MODE_INFINITE, POST_LIST_LOAD_MODE_PAGINATION } from "@/lib/post-list-load-mode"
import { Plus } from "lucide-react"

interface StructureTabProps {
  modal: Exclude<ModalMode, null>
  zones: ZoneItem[]
  form: StructureFormState
  isBoard: boolean
  isModeratorBoardEdit: boolean
  isSiteAdmin: boolean
  onModeratorChanged: () => void
  updateField: <K extends keyof StructureFormState>(
    field: K,
    value: StructureFormState[K],
  ) => void
  togglePostType: (type: string) => void
  updateSidebarLink: (
    index: number,
    key: keyof BoardSidebarLinkDraft,
    value: BoardSidebarLinkDraft[keyof BoardSidebarLinkDraft],
  ) => void
  addSidebarLink: () => void
  removeSidebarLink: (index: number) => void
}

type PermissionOption = {
  id: string
  name: string
  detail: string
  status: boolean
}

interface StructureAccessTabProps extends StructureTabProps {
  verificationTypes: Array<{
    id: string
    name: string
    slug: string
    status: boolean
  }>
  badges: Array<{
    id: string
    name: string
    code: string
    status: boolean
  }>
}

export function StructureBasicTab({
  modal,
  zones,
  form,
  isBoard,
  isModeratorBoardEdit,
  updateField,
}: StructureTabProps) {
  return (
    <div className="rounded-xl border border-border p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isBoard ? "节点名称" : "分区名称"} value={form.name} onChange={(value) => updateField("name", value)} placeholder={isBoard ? "如 摄影" : "如 生活方式"} />
        <Field label="标识 slug" value={form.slug} onChange={(value) => updateField("slug", value)} placeholder={isBoard ? "如 camera" : "如 lifestyle"} />
        <IconPicker
          label="图标"
          value={form.icon}
          onChange={(value) => updateField("icon", value)}
          popoverTitle={isBoard ? "选择节点图标" : "选择分区图标"}
          containerClassName="space-y-2 md:col-span-2"
          triggerClassName="flex h-11 w-full items-center gap-3 rounded-full border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
          textareaRows={4}
        />
        <Field label="排序" value={form.sortOrder} onChange={(value) => updateField("sortOrder", value)} placeholder="数字越小越靠前" />
        {isBoard ? (
          isModeratorBoardEdit ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">所属分区</p>
              <div className="flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm text-muted-foreground">
                {modal.kind === "edit-board" ? (modal.item.zoneName ?? "未分配分区") : "当前节点所属分区"}
              </div>
            </div>
          ) : (
            <SelectField label="所属分区" value={form.zoneId} onValueChange={(value) => updateField("zoneId", value)} options={zones.map((zone) => ({ value: zone.id, label: zone.name }))} />
          )
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5"><p className="text-sm font-medium">隐藏</p></div>
            <Toggle label="在左侧导航隐藏" checked={form.hiddenFromSidebar} onChange={(value) => updateField("hiddenFromSidebar", value)} />
          </div>
        )}
      </div>

      {!isBoard ? (
        <TextAreaField label="描述" value={form.description} onChange={(value) => updateField("description", value)} placeholder="填写结构描述，帮助用户理解这个分区或节点的定位" className="mt-4" rows={5} />
      ) : null}
    </div>
  )
}

export function StructureContentTab({
  form,
  updateField,
  updateSidebarLink,
  addSidebarLink,
  removeSidebarLink,
}: StructureTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">节点描述</h4>
        <TextAreaField label="描述" value={form.description} onChange={(value) => updateField("description", value)} placeholder="填写结构描述，帮助用户理解这个分区或节点的定位" className="mt-4" rows={5} />
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">节点侧栏</h4>
        <div className="mt-4 space-y-2">
          {form.sidebarLinks.length > 0 ? (
            <div className="hidden items-center gap-3 px-3 text-[11px] font-medium text-muted-foreground lg:grid lg:grid-cols-[120px_minmax(0,1fr)_110px_120px_80px]">
              <span>图标 / 标题</span>
              <span>URL</span>
              <span>标题颜色</span>
              <span className="text-right">操作</span>
            </div>
          ) : null}
          {form.sidebarLinks.map((item, index) => (
            <BoardSidebarLinkEditor
              key={`sidebar-link-${index}`}
              item={item}
              index={index}
              onChange={updateSidebarLink}
              onRemove={removeSidebarLink}
            />
          ))}
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-xs" onClick={addSidebarLink}>
            <Plus className="mr-2 h-4 w-4" />新增节点链接
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">节点规则</h4>
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">节点规则 Markdown</p>
          <AddonEditor context="admin" value={form.rulesMarkdown} onChange={(value) => updateField("rulesMarkdown", value)} placeholder="留空时前台显示系统默认节点规则" minHeight={220} uploadFolder="posts" renderFullscreenInDialogPortal />
        </div>
      </div>
    </div>
  )
}

export function StructurePolicyTab({
  form,
  isBoard,
  isModeratorBoardEdit,
  updateField,
  togglePostType,
}: StructureTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">积分与频率设置</h4>
        {isModeratorBoardEdit ? (
          <p className="mt-2 text-xs leading-6 text-muted-foreground">编辑节点时，这四项只能填写留空、0 或负数；留空表示继续继承分区设置。</p>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="发帖积分" help={getStructureNumericFieldHelp({ field: "postPointDelta", isBoard, isModeratorBoardEdit })} value={form.postPointDelta} onChange={(value) => updateField("postPointDelta", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复积分" help={getStructureNumericFieldHelp({ field: "replyPointDelta", isBoard, isModeratorBoardEdit })} value={form.replyPointDelta} onChange={(value) => updateField("replyPointDelta", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖间隔(秒)" help={getStructureNumericFieldHelp({ field: "postIntervalSeconds", isBoard, isModeratorBoardEdit })} value={form.postIntervalSeconds} onChange={(value) => updateField("postIntervalSeconds", value)} placeholder={isBoard ? "留空继承分区" : "默认 120"} />
          <Field label="回复间隔(秒)" help={getStructureNumericFieldHelp({ field: "replyIntervalSeconds", isBoard, isModeratorBoardEdit })} value={form.replyIntervalSeconds} onChange={(value) => updateField("replyIntervalSeconds", value)} placeholder={isBoard ? "留空继承分区" : "默认 3"} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">支持的帖子类型</h4>
        <div className="mt-4 flex flex-wrap gap-3">
          {postTypeOptions.map((item) => (
            <Button key={item.value} type="button" variant={form.allowedPostTypes.includes(item.value) ? "default" : "outline"} className="rounded-full px-4 py-2 text-sm" onClick={() => togglePostType(item.value)} aria-pressed={form.allowedPostTypes.includes(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">帖子列表</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <SelectField label="首页展示" value={form.showInHomeFeed} onValueChange={(value) => updateField("showInHomeFeed", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: "true", label: "在首页显示" },
              { value: "false", label: "不在首页显示" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的首页展示规则。" : "关闭后，这个分区下未覆盖显示规则的节点帖子将不进入首页。"}</p>
          </div>
          <div className="space-y-2">
            <SelectField label="帖子列表形式" value={form.postListDisplayMode} onValueChange={(value) => updateField("postListDisplayMode", value)} options={[
              { value: "", label: isBoard ? "继承分区" : "默认列表" },
              { value: POST_LIST_DISPLAY_MODE_DEFAULT, label: "普通列表" },
              { value: POST_LIST_DISPLAY_MODE_WEIBO, label: "微博模式" },
              { value: POST_LIST_DISPLAY_MODE_GALLERY, label: "画廊模式" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的列表形式。" : "留空时使用站点默认普通列表；设置后该分区下未覆盖的节点会继承这里。"}</p>
          </div>
          <div className="space-y-2">
            <SelectField label="帖子加载方式" value={form.postListLoadMode} onValueChange={(value) => updateField("postListLoadMode", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: POST_LIST_LOAD_MODE_PAGINATION, label: "分页加载" },
              { value: POST_LIST_LOAD_MODE_INFINITE, label: "无限下拉" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的加载方式。" : "分区可配置为传统分页或滚动到底自动继续加载。"}</p>
          </div>
        </div>
      </div>

      {isBoard && !isModeratorBoardEdit ? (
        <div className="rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold">管理策略</h4>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Toggle label="版主可提取节点金库" checked={form.moderatorsCanWithdrawTreasury} onChange={(value) => updateField("moderatorsCanWithdrawTreasury", value)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function StructureAccessTab({
  form,
  isBoard,
  updateField,
  verificationTypes,
  badges,
}: StructureAccessTabProps) {
  const verificationOptions = verificationTypes.map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.slug,
    status: item.status,
  }))
  const badgeOptions = badges.map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.code,
    status: item.status,
  }))

  function toggleIdentityGateList(
    field: "postRequiredVerificationTypeIds" | "postRequiredBadgeIds" | "replyRequiredVerificationTypeIds" | "replyRequiredBadgeIds",
    id: string,
    checked: boolean,
  ) {
    updateField(
      field,
      checked
        ? Array.from(new Set([...form[field], id]))
        : form[field].filter((item) => item !== id),
    )
  }

  function addPostEditRule() {
    updateField("postEditRules", [
      ...form.postEditRules,
      {
        subject: "vip",
        threshold: "1",
        targetId: "",
        minutes: "-1",
      },
    ])
  }

  function updatePostEditRule(index: number, patch: Partial<PostEditRuleDraft>) {
    updateField(
      "postEditRules",
      form.postEditRules.map((rule, currentIndex) => currentIndex === index ? {
        ...rule,
        ...patch,
        ...(patch.subject === "vip" || patch.subject === "level" ? { targetId: "" } : {}),
        ...(patch.subject === "verification" || patch.subject === "badge" ? { threshold: "1" } : {}),
      } : rule),
    )
  }

  function removePostEditRule(index: number) {
    updateField("postEditRules", form.postEditRules.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">普通用户操作权限</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <SelectField label="普通用户发帖" value={form.allowUserPost} onValueChange={(value) => updateField("allowUserPost", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: "true", label: "允许普通用户发帖" },
              { value: "false", label: "仅管理员和版主可发帖" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时继承所属分区；关闭后普通用户不能在此节点发帖。" : "关闭后该分区默认只允许管理员和版主发帖，节点仍可单独覆盖。"}</p>
          </div>
          <div className="flex flex-col gap-2">
            <SelectField label="普通用户回帖" value={form.allowUserReply} onValueChange={(value) => updateField("allowUserReply", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: "true", label: "允许普通用户回帖" },
              { value: "false", label: "仅管理员和版主可回帖" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时继承所属分区；关闭后普通用户不能在此节点回帖。" : "关闭后该分区默认只允许管理员和版主回帖，节点仍可单独覆盖。"}</p>
          </div>
          <div className="space-y-2">
            <SelectField label="楼主下线用户评论" value={form.allowPostAuthorOfflineComment} onValueChange={(value) => updateField("allowPostAuthorOfflineComment", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: "true", label: "允许楼主下线用户评论" },
              { value: "false", label: "不允许楼主下线用户评论" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时继承所属分区；开启后，帖子作者可下线本帖内其他用户的评论。" : "开启后，该分区默认允许帖子作者下线自己帖子里的用户评论，节点仍可单独覆盖。"}</p>
          </div>
          <div className="space-y-2">
            <SelectField label="用户下线自己的评论" value={form.allowUserOfflineOwnComment} onValueChange={(value) => updateField("allowUserOfflineOwnComment", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: "true", label: "允许用户下线自己的评论" },
              { value: "false", label: "不允许用户下线自己的评论" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时继承所属分区；开启后，评论作者可自行下线自己的评论。" : "开启后，该分区默认允许评论作者自行下线自己的评论，节点仍可单独覆盖。"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">浏览 / 发帖 / 回复权限</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="浏览最低积分" help={getStructureAccessFieldHelp({ field: "minViewPoints", isBoard })} value={form.minViewPoints} onChange={(value) => updateField("minViewPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="浏览最低等级" help={getStructureAccessFieldHelp({ field: "minViewLevel", isBoard })} value={form.minViewLevel} onChange={(value) => updateField("minViewLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="浏览最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minViewVipLevel", isBoard })} value={form.minViewVipLevel} onChange={(value) => updateField("minViewVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖最低积分" help={getStructureAccessFieldHelp({ field: "minPostPoints", isBoard })} value={form.minPostPoints} onChange={(value) => updateField("minPostPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖最低等级" help={getStructureAccessFieldHelp({ field: "minPostLevel", isBoard })} value={form.minPostLevel} onChange={(value) => updateField("minPostLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minPostVipLevel", isBoard })} value={form.minPostVipLevel} onChange={(value) => updateField("minPostVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复最低积分" help={getStructureAccessFieldHelp({ field: "minReplyPoints", isBoard })} value={form.minReplyPoints} onChange={(value) => updateField("minReplyPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复最低等级" help={getStructureAccessFieldHelp({ field: "minReplyLevel", isBoard })} value={form.minReplyLevel} onChange={(value) => updateField("minReplyLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minReplyVipLevel", isBoard })} value={form.minReplyVipLevel} onChange={(value) => updateField("minReplyVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">指定认证 / 勋章权限</h4>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">配置后，普通用户需要命中任一认证或勋章才可执行对应操作；管理员和版主不受此限制。</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <IdentityGateEditor
            title="发帖权限增强"
            mode={form.postIdentityGateMode}
            isBoard={isBoard}
            onModeChange={(value) => updateField("postIdentityGateMode", value)}
            verificationOptions={verificationOptions}
            badgeOptions={badgeOptions}
            selectedVerificationIds={form.postRequiredVerificationTypeIds}
            selectedBadgeIds={form.postRequiredBadgeIds}
            onVerificationChange={(id, checked) => toggleIdentityGateList("postRequiredVerificationTypeIds", id, checked)}
            onBadgeChange={(id, checked) => toggleIdentityGateList("postRequiredBadgeIds", id, checked)}
          />
          <IdentityGateEditor
            title="回复权限增强"
            mode={form.replyIdentityGateMode}
            isBoard={isBoard}
            onModeChange={(value) => updateField("replyIdentityGateMode", value)}
            verificationOptions={verificationOptions}
            badgeOptions={badgeOptions}
            selectedVerificationIds={form.replyRequiredVerificationTypeIds}
            selectedBadgeIds={form.replyRequiredBadgeIds}
            onVerificationChange={(id, checked) => toggleIdentityGateList("replyRequiredVerificationTypeIds", id, checked)}
            onBadgeChange={(id, checked) => toggleIdentityGateList("replyRequiredBadgeIds", id, checked)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">发帖编辑窗口策略</h4>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">未命中规则时使用站点设置里的帖子可编辑分钟数；命中多条规则时取最长时间，`-1` 表示不受时间限制。</p>
        <div className="mt-4">
          <PostEditRulesEditor
            mode={form.postEditRuleMode}
            isBoard={isBoard}
            rules={form.postEditRules}
            verificationOptions={verificationOptions}
            badgeOptions={badgeOptions}
            onModeChange={(value) => updateField("postEditRuleMode", value)}
            onAdd={addPostEditRule}
            onUpdate={updatePostEditRule}
            onRemove={removePostEditRule}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold">审核策略</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Toggle label="开启发帖审核" checked={form.requirePostReview} onChange={(value) => updateField("requirePostReview", value)} />
          <Toggle label="开启回帖审核" checked={form.requireCommentReview} onChange={(value) => updateField("requireCommentReview", value)} />
        </div>
      </div>
    </div>
  )
}

function PostEditRulesEditor({
  mode,
  isBoard,
  rules,
  verificationOptions,
  badgeOptions,
  onModeChange,
  onAdd,
  onUpdate,
  onRemove,
}: {
  mode: "inherit" | "custom"
  isBoard: boolean
  rules: PostEditRuleDraft[]
  verificationOptions: PermissionOption[]
  badgeOptions: PermissionOption[]
  onModeChange: (value: "inherit" | "custom") => void
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<PostEditRuleDraft>) => void
  onRemove: (index: number) => void
}) {
  const disabled = isBoard && mode === "inherit"

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="text-sm font-medium">特殊身份编辑时间</h5>
          <p className="mt-1 text-xs text-muted-foreground">{rules.length > 0 ? `已配置 ${rules.length} 条规则` : "未配置时使用站点默认编辑时间"}</p>
        </div>
        {isBoard ? (
          <SelectField
            label="策略来源"
            value={mode}
            onValueChange={(value) => onModeChange(value === "custom" ? "custom" : "inherit")}
            options={[
              { value: "inherit", label: "继承分区" },
              { value: "custom", label: "自定义规则" },
            ]}
          />
        ) : null}
      </div>

      <div className={disabled ? "pointer-events-none flex flex-col gap-3 opacity-50" : "flex flex-col gap-3"}>
        {rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            暂无特殊编辑窗口规则。
          </div>
        ) : null}
        {rules.map((rule, index) => (
          <PostEditRuleRow
            key={`post-edit-rule-${index}`}
            rule={rule}
            index={index}
            verificationOptions={verificationOptions}
            badgeOptions={badgeOptions}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
        <div>
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-xs" onClick={onAdd}>
            新增编辑规则
          </Button>
        </div>
      </div>
    </div>
  )
}

function PostEditRuleRow({
  rule,
  index,
  verificationOptions,
  badgeOptions,
  onUpdate,
  onRemove,
}: {
  rule: PostEditRuleDraft
  index: number
  verificationOptions: PermissionOption[]
  badgeOptions: PermissionOption[]
  onUpdate: (index: number, patch: Partial<PostEditRuleDraft>) => void
  onRemove: (index: number) => void
}) {
  const subjectOptions: Array<{ value: PostEditWindowRuleSubject; label: string }> = [
    { value: "vip", label: "VIP 等级" },
    { value: "level", label: "用户等级" },
    { value: "verification", label: "指定认证" },
    { value: "badge", label: "指定勋章" },
  ]
  const identityOptions = rule.subject === "verification" ? verificationOptions : badgeOptions
  const targetLabel = rule.subject === "verification" ? "认证类型" : "勋章"
  const minutes = Number(rule.minutes)
  const minutesHint = Number.isFinite(minutes)
    ? formatPostEditWindowLabel(minutes)
    : "填写 -1 表示永久"

  return (
    <div className="rounded-[18px] border border-border bg-card/60 p-3">
      <div className="grid gap-3 lg:grid-cols-[150px_minmax(160px,1fr)_minmax(160px,1fr)_auto] lg:items-end">
        <SelectField
          label="身份类型"
          value={rule.subject}
          onValueChange={(value) => onUpdate(index, { subject: value as PostEditWindowRuleSubject })}
          options={subjectOptions}
        />
        {rule.subject === "vip" || rule.subject === "level" ? (
          <Field
            label={rule.subject === "vip" ? "最低 VIP 等级" : "最低用户等级"}
            value={rule.threshold}
            onChange={(value) => onUpdate(index, { threshold: value })}
            placeholder="例如 3"
          />
        ) : (
          <SelectField
            label={targetLabel}
            value={rule.targetId}
            onValueChange={(value) => onUpdate(index, { targetId: value })}
            options={[
              { value: "", label: `请选择${targetLabel}` },
              ...identityOptions.map((option) => ({
                value: option.id,
                label: `${option.name}${option.status ? "" : "（停用）"}`,
              })),
            ]}
          />
        )}
        <Field
          label="可编辑分钟数"
          value={rule.minutes}
          onChange={(value) => onUpdate(index, { minutes: value })}
          placeholder="-1 永久，0 不可编辑"
          help={<p>{minutesHint}</p>}
        />
        <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" onClick={() => onRemove(index)}>
          删除
        </Button>
      </div>
    </div>
  )
}

function IdentityGateEditor({
  title,
  mode,
  isBoard,
  verificationOptions,
  badgeOptions,
  selectedVerificationIds,
  selectedBadgeIds,
  onModeChange,
  onVerificationChange,
  onBadgeChange,
}: {
  title: string
  mode: "inherit" | "custom"
  isBoard: boolean
  verificationOptions: PermissionOption[]
  badgeOptions: PermissionOption[]
  selectedVerificationIds: string[]
  selectedBadgeIds: string[]
  onModeChange: (value: "inherit" | "custom") => void
  onVerificationChange: (id: string, checked: boolean) => void
  onBadgeChange: (id: string, checked: boolean) => void
}) {
  const disabled = isBoard && mode === "inherit"

  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="text-sm font-medium">{title}</h5>
          <p className="mt-1 text-xs text-muted-foreground">{selectedVerificationIds.length + selectedBadgeIds.length > 0 ? `已选择 ${selectedVerificationIds.length + selectedBadgeIds.length} 项` : "未限制认证或勋章"}</p>
        </div>
        {isBoard ? (
          <SelectField
            label="权限来源"
            value={mode}
            onValueChange={(value) => onModeChange(value === "custom" ? "custom" : "inherit")}
            options={[
              { value: "inherit", label: "继承分区" },
              { value: "custom", label: "自定义名单" },
            ]}
          />
        ) : null}
      </div>

      <div className={disabled ? "pointer-events-none mt-4 opacity-50" : "mt-4"}>
        <IdentityGateOptionGroup
          title="认证"
          emptyText="暂无认证类型"
          options={verificationOptions}
          selectedIds={selectedVerificationIds}
          onChange={onVerificationChange}
        />
        <IdentityGateOptionGroup
          title="勋章"
          emptyText="暂无勋章"
          options={badgeOptions}
          selectedIds={selectedBadgeIds}
          onChange={onBadgeChange}
        />
      </div>
    </div>
  )
}

function IdentityGateOptionGroup({
  title,
  emptyText,
  options,
  selectedIds,
  onChange,
}: {
  title: string
  emptyText: string
  options: PermissionOption[]
  selectedIds: string[]
  onChange: (id: string, checked: boolean) => void
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {options.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {options.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm">
              <Checkbox
                checked={selectedIds.includes(option.id)}
                onCheckedChange={(checked) => onChange(option.id, checked === true)}
                aria-label={option.name}
              />
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{option.status ? option.detail : `${option.detail} · 停用`}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function StructureModeratorsTab({
  modal,
  isBoard,
  isSiteAdmin,
  onModeratorChanged,
}: StructureTabProps) {
  const editableTarget = modal.kind === "edit-zone" || modal.kind === "edit-board" ? modal.item : null
  const targetType = modal.kind === "edit-zone" ? "zone" : modal.kind === "edit-board" ? "board" : null
  const [directModerators, setDirectModerators] = useState<StructureModeratorItem[]>(
    editableTarget ? [...editableTarget.moderators] : [],
  )
  const inheritedModerators = modal.kind === "edit-board" ? modal.item.inheritedModerators : []
  const [username, setUsername] = useState("")
  const [canEditSettings, setCanEditSettings] = useState(true)
  const [canWithdrawTreasury, setCanWithdrawTreasury] = useState(true)
  const [isPending, startTransition] = useTransition()

  function saveModerator() {
    if (!editableTarget || !targetType || !username.trim()) {
      toast.error("请输入版主用户名")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/structure/moderators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId: editableTarget.id,
            username: username.trim(),
            canEditSettings,
            canWithdrawTreasury,
          }),
        })
        const result = (await response.json().catch(() => null)) as {
          message?: string
          data?: { moderator?: StructureModeratorItem }
        } | null
        const message = result?.message ?? (response.ok ? "版主设置已保存" : "保存失败，请稍后重试")

        if (!response.ok || !result?.data?.moderator) {
          toast.error(message)
          return
        }

        setDirectModerators((current) => [
          result.data!.moderator!,
          ...current.filter((item) => item.id !== result.data!.moderator!.id),
        ])
        setUsername("")
        toast.success(message)
        onModeratorChanged()
      } catch {
        toast.error("网络异常，请稍后重试")
      }
    })
  }

  function removeModerator(moderator: StructureModeratorItem) {
    if (!editableTarget || !targetType) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/structure/moderators", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId: editableTarget.id,
            moderatorId: moderator.id,
          }),
        })
        const result = (await response.json().catch(() => null)) as { message?: string } | null
        const message = result?.message ?? (response.ok ? "版主已移除" : "移除失败，请稍后重试")

        if (!response.ok) {
          toast.error(message)
          return
        }

        setDirectModerators((current) => current.filter((item) => item.id !== moderator.id))
        toast.success(message)
        onModeratorChanged()
      } catch {
        toast.error("网络异常，请稍后重试")
      }
    })
  }

  if (!editableTarget || !targetType) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        创建完成后可在编辑弹窗里配置版主。
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">版主列表</h4>
          <p className="text-xs text-muted-foreground">{isBoard ? "节点版主只作用于当前节点；所属分区的版主会自动继承到该节点。" : "分区版主会自动覆盖该分区下的全部节点。"}</p>
        </div>
        <div className="mt-4 space-y-3">
          <ModeratorList
            title={isBoard ? "节点版主" : "分区版主"}
            moderators={directModerators}
            canRemove={isSiteAdmin}
            isPending={isPending}
            onRemove={removeModerator}
          />
          {isBoard ? (
            <ModeratorList
              title="继承自分区"
              moderators={inheritedModerators}
              canRemove={false}
              isPending={isPending}
              onRemove={removeModerator}
            />
          ) : null}
        </div>
      </div>

      {isSiteAdmin ? (
        <div className="rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold">版主设置</h4>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end">
            <div className="space-y-2">
              <p className="text-sm font-medium">版主用户名</p>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="输入用户用户名，普通用户会自动设为版主"
                className="h-11 rounded-full bg-background px-4"
              />
            </div>
            <Toggle label="可改设置" checked={canEditSettings} onChange={setCanEditSettings} />
            <Toggle label="可提金库" checked={canWithdrawTreasury} onChange={setCanWithdrawTreasury} />
            <Button type="button" disabled={isPending} onClick={saveModerator}>
              {isPending ? "保存中..." : "保存版主"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          只有管理员可以新增、移除或调整版主设置。
        </div>
      )}
    </div>
  )
}

function ModeratorList({
  title,
  moderators,
  canRemove,
  isPending,
  onRemove,
}: {
  title: string
  moderators: StructureModeratorItem[]
  canRemove: boolean
  isPending: boolean
  onRemove: (moderator: StructureModeratorItem) => void
}) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Badge variant="secondary" className="rounded-full">{moderators.length}</Badge>
      </div>
      {moderators.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">暂无版主。</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {moderators.map((moderator) => (
            <div key={`${moderator.source}-${moderator.id}`} className="flex flex-col gap-2 rounded-[16px] border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{moderator.displayName}</p>
                <p className="text-xs text-muted-foreground">@{moderator.username} · {moderator.status}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{moderator.canEditSettings ? "可改设置" : "不可改设置"}</Badge>
                <Badge variant="outline">{moderator.canWithdrawTreasury ? "可提金库" : "不可提金库"}</Badge>
                {canRemove ? (
                  <Button type="button" variant="outline" disabled={isPending} className="h-7 rounded-full px-2.5 text-xs" onClick={() => onRemove(moderator)}>
                    移除
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
