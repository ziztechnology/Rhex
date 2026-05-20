"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2 } from "lucide-react"

import { useConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TextField } from "@/components/ui/text-field"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { formatOptionalPreciseDateTime } from "@/lib/formatters"

import type { AiReplyAdminData } from "@/lib/ai-reply"

interface AiReplyAdminPageProps {
  initialData: AiReplyAdminData
}

type TaskTabKey = "auto-categorize" | "ai-reply"
type AgentConfig = AiReplyAdminData["config"]["agents"][number]
type AgentUser = AiReplyAdminData["agentUsers"][number]
type AgentDraft = Omit<AgentConfig, "keywordTriggers" | "boardSlugs"> & {
  agentUsername: string
  keywordTriggersText: string
  boardSlugsText: string
}

const TASK_STATUS_LABELS = {
  PENDING: "待执行",
  PROCESSING: "执行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "取消",
} as const

const TASK_STATUS_CLASS_NAMES = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PROCESSING: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  SUCCEEDED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  CANCELLED: "border-muted bg-muted/60 text-muted-foreground",
} as const

const AUTO_CATEGORIZE_SOURCE_LABELS = {
  PREVIEW: "发布页预览",
  POST_CREATE: "发帖后入队",
} as const

const AUTO_CATEGORIZE_RESULT_LABELS = {
  ok: "已生成建议",
  empty_suggestion: "无有效建议",
  invalid_json: "模型返回无效 JSON",
  provider_not_configured: "模型未配置",
  no_candidate_boards: "无可选节点",
  no_requested_capabilities: "未请求能力",
} as const

function canDeleteTaskLog(status: keyof typeof TASK_STATUS_LABELS) {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED"
}

function renderAutoCategorizeResultLabel(status: string | null) {
  if (!status) {
    return "未产出结果"
  }

  return AUTO_CATEGORIZE_RESULT_LABELS[status as keyof typeof AUTO_CATEGORIZE_RESULT_LABELS] ?? status
}

function LabeledTextarea(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{props.label}</p>
      <Textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 6}
        className="min-h-[150px] resize-y"
      />
    </div>
  )
}

function splitListText(value: string) {
  return value
    .split(/[,\n，、]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildAgentDraft(agent: AgentConfig, user?: AgentUser | null): AgentDraft {
  return {
    ...agent,
    agentUsername: user?.username ?? "",
    keywordTriggersText: agent.keywordTriggers.join("\n"),
    boardSlugsText: agent.boardSlugs.join("\n"),
  }
}

function buildEmptyAgentDraft(config: AiReplyAdminData["config"], index: number): AgentDraft {
  return {
    id: `agent-${Date.now()}-${index}`,
    enabled: true,
    label: `AI 助手 ${index}`,
    agentUserId: null,
    agentUsername: "",
    respondToPostMentions: true,
    respondToCommentMentions: true,
    autoReplyToAllPosts: false,
    keywordTriggersText: "",
    boardSlugsText: "",
    systemPrompt: config.systemPrompt,
    postReplyPrompt: config.postReplyPrompt,
    commentReplyPrompt: config.commentReplyPrompt,
  }
}

function buildAgentDrafts(data: AiReplyAdminData): AgentDraft[] {
  const userMap = new Map(data.agentUsers.map((user) => [user.id, user]))
  const drafts = data.config.agents.map((agent) => buildAgentDraft(agent, agent.agentUserId ? userMap.get(agent.agentUserId) : null))

  if (drafts.length > 0) {
    return drafts
  }

  if (!data.config.agentUserId) {
    return []
  }

  return [
    buildAgentDraft({
      id: "default",
      enabled: true,
      label: "AI 助手",
      agentUserId: data.config.agentUserId,
      respondToPostMentions: data.config.respondToPostMentions,
      respondToCommentMentions: data.config.respondToCommentMentions,
      autoReplyToAllPosts: false,
      keywordTriggers: [],
      boardSlugs: [],
      systemPrompt: data.config.systemPrompt,
      postReplyPrompt: data.config.postReplyPrompt,
      commentReplyPrompt: data.config.commentReplyPrompt,
    }, data.agentUser),
  ]
}

export function AiReplyAdminPage({ initialData }: AiReplyAdminPageProps) {
  const confirm = useConfirm()
  const [data, setData] = useState(initialData)
  const [enabled, setEnabled] = useState(initialData.config.enabled)
  const [agents, setAgents] = useState<AgentDraft[]>(() => buildAgentDrafts(initialData))
  const [baseUrl, setBaseUrl] = useState(initialData.config.baseUrl)
  const [model, setModel] = useState(initialData.config.model)
  const [temperature, setTemperature] = useState(String(initialData.config.temperature))
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(initialData.config.maxOutputTokens))
  const [timeoutMs, setTimeoutMs] = useState(String(initialData.config.timeoutMs))
  const [writeBoardAutoSelectEnabled, setWriteBoardAutoSelectEnabled] = useState(initialData.autoCategorizeConfig.writeBoardAutoSelectEnabled)
  const [writeTagAutoExtractEnabled, setWriteTagAutoExtractEnabled] = useState(initialData.autoCategorizeConfig.writeTagAutoExtractEnabled)
  const [defaultBoardSlug, setDefaultBoardSlug] = useState(initialData.autoCategorizeConfig.defaultBoardSlug)
  const [autoCategorizePromptTemplate, setAutoCategorizePromptTemplate] = useState(initialData.autoCategorizeConfig.promptTemplate)
  const [apiKey, setApiKey] = useState("")
  const [clearApiKey, setClearApiKey] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [testFeedback, setTestFeedback] = useState("")
  const [testReply, setTestReply] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTesting] = useTransition()
  const [isTaskListLoading, setIsTaskListLoading] = useState(false)
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null)
  const [isDeletingAllTaskLogs, setIsDeletingAllTaskLogs] = useState(false)
  const [activeTaskTab, setActiveTaskTab] = useState<TaskTabKey>("auto-categorize")

  const enabledAgentCount = agents.filter((agent) => agent.enabled && agent.agentUsername.trim()).length
  const currentAgentLabel = agents.length > 0
    ? `${enabledAgentCount} / ${agents.length} 个机器人可运行`
    : "未配置"
  const apiKeyStateLabel = clearApiKey
    ? "本次保存会清空当前密钥"
    : data.config.apiKeyConfigured
      ? "已保存密钥，留空可保留"
      : "尚未保存密钥"
  const isRunnable = enabled
    && agents.some((agent) => agent.enabled && agent.agentUsername.trim())
    && Boolean(model.trim())
    && Boolean((apiKey || (clearApiKey ? "" : (data.config.apiKeyConfigured ? "configured" : ""))).trim())

  function syncDraftFromData(nextData: AiReplyAdminData) {
    setData(nextData)
    setEnabled(nextData.config.enabled)
    setAgents(buildAgentDrafts(nextData))
    setBaseUrl(nextData.config.baseUrl)
    setModel(nextData.config.model)
    setTemperature(String(nextData.config.temperature))
    setMaxOutputTokens(String(nextData.config.maxOutputTokens))
    setTimeoutMs(String(nextData.config.timeoutMs))
    setWriteBoardAutoSelectEnabled(nextData.autoCategorizeConfig.writeBoardAutoSelectEnabled)
    setWriteTagAutoExtractEnabled(nextData.autoCategorizeConfig.writeTagAutoExtractEnabled)
    setDefaultBoardSlug(nextData.autoCategorizeConfig.defaultBoardSlug)
    setAutoCategorizePromptTemplate(nextData.autoCategorizeConfig.promptTemplate)
    setApiKey("")
    setClearApiKey(false)
  }

  function buildRequestPayload() {
    const normalizedAgents = agents.map((agent, index) => ({
      id: agent.id || `agent-${index + 1}`,
      enabled: agent.enabled,
      label: agent.label,
      agentUsername: agent.agentUsername,
      respondToPostMentions: agent.respondToPostMentions,
      respondToCommentMentions: agent.respondToCommentMentions,
      autoReplyToAllPosts: agent.autoReplyToAllPosts,
      keywordTriggers: splitListText(agent.keywordTriggersText),
      boardSlugs: splitListText(agent.boardSlugsText),
      systemPrompt: agent.systemPrompt,
      postReplyPrompt: agent.postReplyPrompt,
      commentReplyPrompt: agent.commentReplyPrompt,
    }))
    const primaryAgent = normalizedAgents[0]

    return {
      config: {
        enabled,
        respondToPostMentions: primaryAgent?.respondToPostMentions ?? true,
        respondToCommentMentions: primaryAgent?.respondToCommentMentions ?? true,
        agentUsername: primaryAgent?.agentUsername ?? "",
        agents: normalizedAgents,
        baseUrl,
        model,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        timeoutMs: Number(timeoutMs),
        systemPrompt: primaryAgent?.systemPrompt ?? data.config.systemPrompt,
        postReplyPrompt: primaryAgent?.postReplyPrompt ?? data.config.postReplyPrompt,
        commentReplyPrompt: primaryAgent?.commentReplyPrompt ?? data.config.commentReplyPrompt,
      },
      secret: {
        apiKey,
        clearApiKey,
      },
      autoCategorizeConfig: {
        writeBoardAutoSelectEnabled,
        writeTagAutoExtractEnabled,
        defaultBoardSlug,
        promptTemplate: autoCategorizePromptTemplate,
      },
      pagination: {
        page: data.recentTasksPagination.page,
        autoCategorizePage: data.autoCategorizeRecentTasksPagination.page,
      },
    }
  }

  function updateAgent(agentId: string, patch: Partial<AgentDraft>) {
    setAgents((current) => current.map((agent) => (
      agent.id === agentId ? { ...agent, ...patch } : agent
    )))
  }

  function addAgent() {
    setAgents((current) => [...current, buildEmptyAgentDraft(data.config, current.length + 1)])
  }

  function removeAgent(agentId: string) {
    setAgents((current) => current.filter((agent) => agent.id !== agentId))
  }

  async function loadTaskPage(target: TaskTabKey, page: number) {
    setIsTaskListLoading(true)

    try {
      const replyPage = target === "ai-reply" ? page : data.recentTasksPagination.page
      const autoPage = target === "auto-categorize" ? page : data.autoCategorizeRecentTasksPagination.page
      const response = await fetch(`/api/admin/apps/ai-reply?page=${replyPage}&autoPage=${autoPage}`, {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "任务列表加载失败")
      }

      setData(result.data as AiReplyAdminData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "任务列表加载失败", "加载失败")
    } finally {
      setIsTaskListLoading(false)
    }
  }

  async function deleteTaskLog(taskId: string) {
    const confirmed = await confirm({
      title: "删除任务日志",
      description: "删除后只会移除这条 AI 任务日志记录，不会删除已经生成的评论内容。该操作不可撤销。",
      confirmText: "删除",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setPendingDeleteTaskId(taskId)
    setIsTaskListLoading(true)

    try {
      const response = await fetch("/api/admin/apps/ai-reply", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          pagination: {
            page: data.recentTasksPagination.page,
            autoCategorizePage: data.autoCategorizeRecentTasksPagination.page,
          },
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "删除任务日志失败")
      }

      setData(result.data as AiReplyAdminData)
      toast.success(result?.message ?? "任务日志已删除", "删除成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除任务日志失败", "删除失败")
    } finally {
      setPendingDeleteTaskId(null)
      setIsTaskListLoading(false)
    }
  }

  async function deleteAllTaskLogs() {
    const confirmed = await confirm({
      title: "删除全部任务日志",
      description: "这会删除所有已结束的 AI 任务日志，包括成功、失败和已取消记录。执行中的任务会被保留。该操作不可撤销。",
      confirmText: "全部删除",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setIsDeletingAllTaskLogs(true)
    setIsTaskListLoading(true)

    try {
      const response = await fetch("/api/admin/apps/ai-reply", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteAllLogs: true,
          pagination: {
            page: data.recentTasksPagination.page,
            autoCategorizePage: data.autoCategorizeRecentTasksPagination.page,
          },
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "删除全部任务日志失败")
      }

      setData(result.data as AiReplyAdminData)
      toast.success(result?.message ?? "任务日志已全部删除", "删除成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除全部任务日志失败", "删除失败")
    } finally {
      setIsDeletingAllTaskLogs(false)
      setIsTaskListLoading(false)
    }
  }

  function saveConfig() {
    setFeedback("")

    startTransition(async () => {
      const response = await fetch("/api/admin/apps/ai-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequestPayload()),
      })

      const result = await response.json()
      if (response.ok && result?.data) {
        syncDraftFromData(result.data as AiReplyAdminData)
      }

      setFeedback(result?.message ?? (response.ok ? "保存成功" : "保存失败"))
    })
  }

  function runTest() {
    setTestFeedback("")
    setTestReply("")

    startTesting(async () => {
      const response = await fetch("/api/admin/apps/ai-reply/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequestPayload()),
      })

      const result = await response.json()
      if (response.ok && result?.data?.reply) {
        setTestReply(String(result.data.reply))
      }

      setTestFeedback(result?.message ?? (response.ok ? "测试成功" : "测试失败"))
    })
  }

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>运行概览</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">机器人账号</p>
            <p className="mt-2 text-base font-semibold">{currentAgentLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">{agents.length > 0 ? "每个机器人可独立配置提示词和触发条件" : "保存时按用户名或昵称解析"}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">任务池</p>
            <p className="mt-2 text-base font-semibold">{data.summary.pending} 待执行 / {data.summary.processing} 执行中</p>
            <p className="mt-1 text-sm text-muted-foreground">成功 {data.summary.succeeded}，失败 {data.summary.failed}，取消 {data.summary.cancelled}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">AI 运行状态</p>
            <p className="mt-2 text-base font-semibold">{isRunnable ? "配置完整" : "配置未完成"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{enabled ? "开关已开启" : "当前总开关关闭"}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">接口密钥</p>
            <p className="mt-2 text-base font-semibold">{data.config.apiKeyConfigured ? "已配置" : "未配置"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{apiKeyStateLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>AI 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">启用 AI 回复</p>
                  <p className="mt-1 text-sm text-muted-foreground">总开关，关闭后不会再创建新的 AI 回复任务。</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div>
                <p className="font-medium">机器人账号</p>
                <p className="mt-1 text-sm text-muted-foreground">已配置 {agents.length} 个，启用且账号有效 {enabledAgentCount} 个。</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="模型接口 Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />
            <TextField label="模型名称" value={model} onChange={setModel} placeholder="gpt-4.1-mini / qwen-max / deepseek-chat" />
            <div className="space-y-2">
              <TextField label="温度" value={temperature} onChange={setTemperature} placeholder="0.7" containerClassName="space-y-0" />
              <p className="text-xs leading-6 text-muted-foreground">值越低越稳定保守，值越高越发散活跃。论坛助手建议使用 0.4 到 0.7。</p>
            </div>
            <TextField label="最大输出 Token" value={maxOutputTokens} onChange={setMaxOutputTokens} placeholder="500" />
            <TextField label="请求超时（毫秒）" value={timeoutMs} onChange={setTimeoutMs} placeholder="30000" />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">机器人列表</p>
                <p className="mt-1 text-sm text-muted-foreground">@ 提及始终优先触发；关键词、主贴自动回复和节点触发按机器人独立配置。</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAgent}>
                <Plus data-icon="inline-start" />
                添加机器人
              </Button>
            </div>

            {agents.length > 0 ? agents.map((agent, index) => (
              <div key={agent.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">机器人 {index + 1}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{agent.agentUsername.trim() ? `账号：@${agent.agentUsername.trim()}` : "保存时按用户名或昵称解析账号"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={agent.enabled} onCheckedChange={(checked) => updateAgent(agent.id, { enabled: checked })} />
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => removeAgent(agent.id)} aria-label="删除机器人">
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <TextField
                    label="显示名称"
                    value={agent.label}
                    onChange={(value) => updateAgent(agent.id, { label: value })}
                    placeholder="例如：问答助手"
                  />
                  <TextField
                    label="机器人账号"
                    value={agent.agentUsername}
                    onChange={(value) => updateAgent(agent.id, { agentUsername: value })}
                    placeholder="填写用户名或昵称"
                    autoComplete="username"
                  />
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">主贴自动全回</p>
                        <p className="mt-1 text-sm text-muted-foreground">发新主贴时自动创建回复任务。</p>
                      </div>
                      <Switch checked={agent.autoReplyToAllPosts} onCheckedChange={(checked) => updateAgent(agent.id, { autoReplyToAllPosts: checked })} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">帖子 @ 回复</p>
                        <p className="mt-1 text-sm text-muted-foreground">帖子正文 @ 该账号时触发。</p>
                      </div>
                      <Switch checked={agent.respondToPostMentions} onCheckedChange={(checked) => updateAgent(agent.id, { respondToPostMentions: checked })} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">评论 @ 回复</p>
                        <p className="mt-1 text-sm text-muted-foreground">楼层评论 @ 该账号时触发。</p>
                      </div>
                      <Switch checked={agent.respondToCommentMentions} onCheckedChange={(checked) => updateAgent(agent.id, { respondToCommentMentions: checked })} />
                    </div>
                  </div>
                  <LabeledTextarea
                    label="关键词触发"
                    value={agent.keywordTriggersText}
                    onChange={(value) => updateAgent(agent.id, { keywordTriggersText: value })}
                    placeholder="每行一个关键词"
                    rows={4}
                  />
                  <LabeledTextarea
                    label="节点触发 slug"
                    value={agent.boardSlugsText}
                    onChange={(value) => updateAgent(agent.id, { boardSlugsText: value })}
                    placeholder="每行一个节点 slug，例如 qa"
                    rows={4}
                  />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <LabeledTextarea
                    label="系统提示词"
                    value={agent.systemPrompt}
                    onChange={(value) => updateAgent(agent.id, { systemPrompt: value })}
                    placeholder="定义该机器人的整体角色、语气和输出约束。"
                  />
                  <LabeledTextarea
                    label="主贴回复提示词"
                    value={agent.postReplyPrompt}
                    onChange={(value) => updateAgent(agent.id, { postReplyPrompt: value })}
                    placeholder="定义该机器人回复主贴时的策略。"
                  />
                  <LabeledTextarea
                    label="楼层回复提示词"
                    value={agent.commentReplyPrompt}
                    onChange={(value) => updateAgent(agent.id, { commentReplyPrompt: value })}
                    placeholder="定义该机器人回复楼层评论时的策略。"
                  />
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                还没有机器人账号，添加后才能触发 AI 回复。
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <TextField
              label="API Key"
              value={apiKey}
              onChange={setApiKey}
              placeholder="留空则保留当前密钥"
              type="password"
              autoComplete="current-password"
            />
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">清空已保存密钥</p>
                  <p className="mt-1 text-sm text-muted-foreground">{apiKeyStateLabel}</p>
                </div>
                <Switch checked={clearApiKey} onCheckedChange={setClearApiKey} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>发帖辅助</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">节点自动选择</p>
                  <p className="mt-1 text-sm text-muted-foreground">发布页可默认交给 AI 根据标题和正文自动匹配节点，用户仍可切回手动选择。</p>
                </div>
                <Switch checked={writeBoardAutoSelectEnabled} onCheckedChange={setWriteBoardAutoSelectEnabled} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">标签自动提取</p>
                  <p className="mt-1 text-sm text-muted-foreground">发布页会使用 AI 产出标签候选，若 AI 没有结果则继续回退到本地提取。</p>
                </div>
                <Switch checked={writeTagAutoExtractEnabled} onCheckedChange={setWriteTagAutoExtractEnabled} />
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)] md:items-end">
            <TextField
              label="默认回退节点 slug"
              value={defaultBoardSlug}
              onChange={setDefaultBoardSlug}
              placeholder="例如：general"
            />
            <p className="text-sm text-muted-foreground">
              {defaultBoardSlug.trim()
                ? data.autoCategorizeDefaultBoard
                  ? `当前命中节点：${data.autoCategorizeDefaultBoard.name}（${data.autoCategorizeDefaultBoard.slug}）。当 AI 没选出节点时会回退到这里。`
                  : "当前 slug 未匹配到有效节点，保存后不会生效。"
                : "留空则不启用默认节点回退。"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>发帖辅助提示词</CardTitle>
        </CardHeader>
        <CardContent className="py-5">
          <LabeledTextarea
            label="发帖辅助提示词"
            value={autoCategorizePromptTemplate}
            onChange={setAutoCategorizePromptTemplate}
            placeholder="定义 AI 如何从候选节点和标签中做分类。候选列表会在请求时自动拼接。"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>任务日志</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                发帖辅助任务和 AI 回复任务统一在这里查看，通过 Tab 切换。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeTaskTab === "ai-reply" && (data.summary.succeeded + data.summary.failed + data.summary.cancelled) > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isTaskListLoading || isDeletingAllTaskLogs}
                  onClick={() => void deleteAllTaskLogs()}
                >
                  {isDeletingAllTaskLogs ? "删除中..." : "删除全部日志"}
                </Button>
              ) : null}
              {isTaskListLoading ? <span className="text-sm text-muted-foreground">任务列表加载中...</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-5">
          <Tabs value={activeTaskTab} onValueChange={(value) => setActiveTaskTab(value as TaskTabKey)} className="w-full flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="auto-categorize">发帖辅助任务</TabsTrigger>
              <TabsTrigger value="ai-reply">最近任务</TabsTrigger>
            </TabsList>

            <TabsContent value="auto-categorize" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  共 {data.autoCategorizeRecentTasksPagination.total} 条任务日志，当前第 {data.autoCategorizeRecentTasksPagination.page} / {data.autoCategorizeRecentTasksPagination.totalPages} 页
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.PENDING}`}>待执行 {data.autoCategorizeSummary.pending}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.PROCESSING}`}>执行中 {data.autoCategorizeSummary.processing}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.SUCCEEDED}`}>成功 {data.autoCategorizeSummary.succeeded}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.FAILED}`}>失败 {data.autoCategorizeSummary.failed}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.CANCELLED}`}>取消 {data.autoCategorizeSummary.cancelled}</span>
                </div>
              </div>

              {data.autoCategorizeRecentTasks.length > 0 ? data.autoCategorizeRecentTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${TASK_STATUS_CLASS_NAMES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
                      <span className="text-sm font-medium">{AUTO_CATEGORIZE_SOURCE_LABELS[task.sourceType]}</span>
                      <span className="text-sm text-muted-foreground">#{task.id.slice(0, 8)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{renderAutoCategorizeResultLabel(task.resultStatus)}</span>
                  </div>

                  <p className="mt-3 text-sm font-medium">{task.postTitle ?? task.previewTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">请求者：{task.requesterDisplayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">创建于 {formatOptionalPreciseDateTime(task.createdAt)}，完成于 {formatOptionalPreciseDateTime(task.finishedAt)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">尝试次数 {task.attemptCount} / {task.maxAttempts}</p>
                  {task.resultBoard ? <p className="mt-2 text-sm text-muted-foreground">建议节点：{task.resultBoard.name}（{task.resultBoard.slug}）</p> : null}
                  {task.resultTags.length > 0 ? <p className="mt-2 text-sm text-muted-foreground">建议标签：{task.resultTags.map((tag) => tag.name).join("、")}</p> : null}
                  {task.resultReasoning ? <p className="mt-2 text-sm text-muted-foreground">理由：{task.resultReasoning}</p> : null}
                  {task.resultRawPreview ? <p className="mt-2 text-sm text-muted-foreground">原始片段：{task.resultRawPreview}</p> : null}
                  {task.errorMessage ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">错误：{task.errorMessage}</p> : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  还没有发帖辅助任务。
                </div>
              )}

              {data.autoCategorizeRecentTasksPagination.totalPages > 1 ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    第 {data.autoCategorizeRecentTasksPagination.page} / {data.autoCategorizeRecentTasksPagination.totalPages} 页，每页 {data.autoCategorizeRecentTasksPagination.pageSize} 条
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!data.autoCategorizeRecentTasksPagination.hasPrevPage || isTaskListLoading}
                      onClick={() => void loadTaskPage("auto-categorize", data.autoCategorizeRecentTasksPagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-full border border-border bg-muted px-3 text-sm font-medium">
                      {data.autoCategorizeRecentTasksPagination.page}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!data.autoCategorizeRecentTasksPagination.hasNextPage || isTaskListLoading}
                      onClick={() => void loadTaskPage("auto-categorize", data.autoCategorizeRecentTasksPagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="ai-reply" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  共 {data.recentTasksPagination.total} 条任务日志，当前第 {data.recentTasksPagination.page} / {data.recentTasksPagination.totalPages} 页
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.PENDING}`}>待执行 {data.summary.pending}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.PROCESSING}`}>执行中 {data.summary.processing}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.SUCCEEDED}`}>成功 {data.summary.succeeded}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.FAILED}`}>失败 {data.summary.failed}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${TASK_STATUS_CLASS_NAMES.CANCELLED}`}>取消 {data.summary.cancelled}</span>
                </div>
              </div>

              {data.recentTasks.length > 0 ? data.recentTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${TASK_STATUS_CLASS_NAMES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
                      <span className="text-sm font-medium">{task.sourceType === "POST" ? "帖子触发" : "评论触发"}</span>
                      <span className="text-sm text-muted-foreground">#{task.id.slice(0, 8)}</span>
                    </div>
                    {canDeleteTaskLog(task.status) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isTaskListLoading || pendingDeleteTaskId === task.id}
                        onClick={() => void deleteTaskLog(task.id)}
                      >
                        {pendingDeleteTaskId === task.id ? "删除中..." : "删除日志"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">执行中的任务暂不支持删除</span>
                    )}
                  </div>

                  <p className="mt-3 text-sm font-medium">{task.postTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">触发者：{task.triggerUserDisplayName}，代理：{task.agentDisplayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">创建于 {formatOptionalPreciseDateTime(task.createdAt)}，完成于 {formatOptionalPreciseDateTime(task.finishedAt)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">尝试次数 {task.attemptCount} / {task.maxAttempts}</p>
                  {task.sourceCommentExcerpt ? <p className="mt-2 text-sm text-muted-foreground">源评论：{task.sourceCommentExcerpt}</p> : null}
                  {task.resultExcerpt ? <p className="mt-2 text-sm text-muted-foreground">AI 回复：{task.resultExcerpt}</p> : null}
                  {task.errorMessage ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">错误：{task.errorMessage}</p> : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  还没有 AI 回复任务。
                </div>
              )}

              {data.recentTasksPagination.totalPages > 1 ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    第 {data.recentTasksPagination.page} / {data.recentTasksPagination.totalPages} 页，每页 {data.recentTasksPagination.pageSize} 条
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!data.recentTasksPagination.hasPrevPage || isTaskListLoading}
                      onClick={() => void loadTaskPage("ai-reply", data.recentTasksPagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-full border border-border bg-muted px-3 text-sm font-medium">
                      {data.recentTasksPagination.page}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!data.recentTasksPagination.hasNextPage || isTaskListLoading}
                      onClick={() => void loadTaskPage("ai-reply", data.recentTasksPagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={isPending || isTesting} onClick={saveConfig}>{isPending ? "保存中..." : "保存配置"}</Button>
        <Button type="button" disabled={isPending || isTesting} onClick={runTest}>{isTesting ? "测试中..." : "测试 AI"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>

      {testFeedback || testReply ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>测试结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-5">
            {testFeedback ? <p className="text-sm text-muted-foreground">{testFeedback}</p> : null}
            {testReply ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">模型返回</p>
                <p className="mt-2 text-sm leading-7">{testReply}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </form>
  )
}
