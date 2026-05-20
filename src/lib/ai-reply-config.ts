import { prisma } from "@/db/client"

import { apiError, type JsonObject } from "@/lib/api-route"
import { getAiAppConfig, isRecord, updateAiAppConfig } from "@/lib/ai/config"
import { parseNonNegativeSafeInteger, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

export const AI_REPLY_APP_KEY = "app.ai-reply"
const AI_REPLY_SENSITIVE_KEY = "aiReplyConfig"
const AI_REPLY_DEFAULT_AGENT_ID = "default"

const AI_REPLY_DEFAULTS = {
  enabled: false,
  baseUrl: "https://api.openai.com/v1",
  model: "",
  agentUserId: null as number | null,
  respondToPostMentions: true,
  respondToCommentMentions: true,
  temperature: 0.7,
  maxOutputTokens: 500,
  timeoutMs: 30_000,
  systemPrompt: [
    "你是论坛里的 AI 助手账号，负责以普通用户评论的形式参与讨论。",
    "请直接输出可发布的评论正文，不要输出标题、解释、JSON、代码块或多余前后缀。",
    "默认使用简体中文，语气自然、克制、友好，优先解决问题或推进讨论。",
    "不确定时明确说明不确定，并提出一个有价值的澄清问题。",
    "不要编造外部事实、站点规则或未提供的上下文。",
  ].join("\n"),
  postReplyPrompt: "当有人在帖子正文里 @你 时，请结合整帖语义进行评论回复，优先回应楼主的主要诉求。",
  commentReplyPrompt: "当有人在评论里 @你 时，请结合主楼和当前评论链语义，在楼中楼直接回应当前评论。",
} as const

export interface AiReplyConfigData {
  enabled: boolean
  baseUrl: string
  model: string
  agentUserId: number | null
  respondToPostMentions: boolean
  respondToCommentMentions: boolean
  temperature: number
  maxOutputTokens: number
  timeoutMs: number
  systemPrompt: string
  postReplyPrompt: string
  commentReplyPrompt: string
  agents: AiReplyAgentConfigData[]
  apiKeyConfigured: boolean
}

export interface ServerAiReplyConfigData extends Omit<AiReplyConfigData, "apiKeyConfigured"> {
  apiKey: string | null
}

export interface AiReplyAgentConfigData {
  id: string
  enabled: boolean
  label: string
  agentUserId: number | null
  respondToPostMentions: boolean
  respondToCommentMentions: boolean
  autoReplyToAllPosts: boolean
  keywordTriggers: string[]
  boardSlugs: string[]
  systemPrompt: string
  postReplyPrompt: string
  commentReplyPrompt: string
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(v)) return true
    if (["0", "false", "no", "off"].includes(v)) return false
  }
  return fallback
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeOptionalString(value: unknown, fallback: string, maxLength: number): string {
  const raw = typeof value === "string" ? value : fallback
  const trimmed = raw.trim()
  return trimmed.slice(0, maxLength)
}

function normalizeRequiredString(value: unknown, fallback: string, maxLength: number): string {
  const result = normalizeOptionalString(value, fallback, maxLength)
  return result || fallback
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  const base = normalizeRequiredString(value, fallback, 500)
  return base.replace(/\/+$/, "") || fallback
}

function normalizeTemperature(value: unknown, fallback: number): number {
  const parsed = typeof value === "number"
    ? value
    : Number.parseFloat(typeof value === "string" ? value.trim() : "")
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(2, Math.max(0, Number(parsed.toFixed(2))))
}

function normalizeAgentUserId(value: unknown, fallback: number | null): number | null {
  if (value === null) return null
  const parsed = parsePositiveSafeInteger(value)
  return typeof parsed === "number" ? parsed : fallback
}

function normalizeStringList(value: unknown, maxItems: number, maxItemLength: number): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n，、]+/u)
      : []
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of source) {
    const normalized = typeof item === "string" ? item.trim().slice(0, maxItemLength) : ""
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    result.push(normalized)
    if (result.length >= maxItems) {
      break
    }
  }

  return result
}

function buildDefaultAgentConfig(cfg: Record<string, unknown>, fallback?: Partial<AiReplyAgentConfigData>): AiReplyAgentConfigData {
  return {
    id: typeof fallback?.id === "string" && fallback.id.trim() ? fallback.id.trim() : AI_REPLY_DEFAULT_AGENT_ID,
    enabled: normalizeBoolean(cfg.enabled, fallback?.enabled ?? true),
    label: normalizeRequiredString(cfg.label, fallback?.label ?? "AI 助手", 80),
    agentUserId: normalizeAgentUserId(cfg.agentUserId, fallback?.agentUserId ?? AI_REPLY_DEFAULTS.agentUserId),
    respondToPostMentions: normalizeBoolean(cfg.respondToPostMentions, fallback?.respondToPostMentions ?? AI_REPLY_DEFAULTS.respondToPostMentions),
    respondToCommentMentions: normalizeBoolean(cfg.respondToCommentMentions, fallback?.respondToCommentMentions ?? AI_REPLY_DEFAULTS.respondToCommentMentions),
    autoReplyToAllPosts: normalizeBoolean(cfg.autoReplyToAllPosts, fallback?.autoReplyToAllPosts ?? false),
    keywordTriggers: normalizeStringList(cfg.keywordTriggers, 30, 40),
    boardSlugs: normalizeStringList(cfg.boardSlugs, 50, 80).map((item) => item.toLowerCase()),
    systemPrompt: normalizeRequiredString(cfg.systemPrompt, fallback?.systemPrompt ?? AI_REPLY_DEFAULTS.systemPrompt, 4_000),
    postReplyPrompt: normalizeRequiredString(cfg.postReplyPrompt, fallback?.postReplyPrompt ?? AI_REPLY_DEFAULTS.postReplyPrompt, 2_000),
    commentReplyPrompt: normalizeRequiredString(cfg.commentReplyPrompt, fallback?.commentReplyPrompt ?? AI_REPLY_DEFAULTS.commentReplyPrompt, 2_000),
  }
}

function normalizeAiReplyAgents(cfg: Record<string, unknown>): AiReplyAgentConfigData[] {
  const rawAgents = Array.isArray(cfg.agents) ? cfg.agents : []
  if (rawAgents.length === 0) {
    const legacyAgent = buildDefaultAgentConfig({
      enabled: true,
      label: "AI 助手",
      agentUserId: cfg.agentUserId,
      respondToPostMentions: cfg.respondToPostMentions,
      respondToCommentMentions: cfg.respondToCommentMentions,
      systemPrompt: cfg.systemPrompt,
      postReplyPrompt: cfg.postReplyPrompt,
      commentReplyPrompt: cfg.commentReplyPrompt,
    })
    return legacyAgent.agentUserId ? [legacyAgent] : []
  }

  const seenIds = new Set<string>()
  const seenUserIds = new Set<number>()
  const result: AiReplyAgentConfigData[] = []

  for (const rawAgent of rawAgents) {
    if (!isRecord(rawAgent)) {
      continue
    }

    const agent = buildDefaultAgentConfig(rawAgent as Record<string, unknown>, {
      id: typeof rawAgent.id === "string" ? rawAgent.id : `agent-${result.length + 1}`,
    })
    const normalizedId = agent.id.replace(/[^\w.-]/g, "").slice(0, 80) || `agent-${result.length + 1}`
    const nextId = seenIds.has(normalizedId) ? `${normalizedId}-${result.length + 1}` : normalizedId
    agent.id = nextId

    if (agent.agentUserId && seenUserIds.has(agent.agentUserId)) {
      continue
    }

    seenIds.add(nextId)
    if (agent.agentUserId) {
      seenUserIds.add(agent.agentUserId)
    }
    result.push(agent)
    if (result.length >= 20) {
      break
    }
  }

  return result
}

function clampPositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parsePositiveSafeInteger(value)
  const base = typeof parsed === "number" ? parsed : fallback
  return Math.min(max, Math.max(min, base))
}

function clampNonNegativeInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parseNonNegativeSafeInteger(value)
  const base = typeof parsed === "number" ? parsed : fallback
  return Math.min(max, Math.max(min, base))
}

function normalizeAiReplyConfig(entry: Record<string, unknown> | null, apiKey: string | null): ServerAiReplyConfigData {
  const cfg = entry && isRecord(entry.config) ? (entry.config as Record<string, unknown>) : {}
  const agents = normalizeAiReplyAgents(cfg)
  const primaryAgent = agents[0] ?? null
  return {
    enabled: normalizeBoolean(entry?.enabled, AI_REPLY_DEFAULTS.enabled),
    baseUrl: normalizeBaseUrl(cfg.baseUrl, AI_REPLY_DEFAULTS.baseUrl),
    model: normalizeOptionalString(cfg.model, AI_REPLY_DEFAULTS.model, 200),
    agentUserId: primaryAgent?.agentUserId ?? normalizeAgentUserId(cfg.agentUserId, AI_REPLY_DEFAULTS.agentUserId),
    respondToPostMentions: primaryAgent?.respondToPostMentions ?? normalizeBoolean(cfg.respondToPostMentions, AI_REPLY_DEFAULTS.respondToPostMentions),
    respondToCommentMentions: primaryAgent?.respondToCommentMentions ?? normalizeBoolean(cfg.respondToCommentMentions, AI_REPLY_DEFAULTS.respondToCommentMentions),
    temperature: normalizeTemperature(cfg.temperature, AI_REPLY_DEFAULTS.temperature),
    maxOutputTokens: clampPositiveInt(cfg.maxOutputTokens, AI_REPLY_DEFAULTS.maxOutputTokens, 64, 4_000),
    timeoutMs: clampNonNegativeInt(cfg.timeoutMs, AI_REPLY_DEFAULTS.timeoutMs, 5_000, 120_000),
    systemPrompt: primaryAgent?.systemPrompt ?? normalizeRequiredString(cfg.systemPrompt, AI_REPLY_DEFAULTS.systemPrompt, 4_000),
    postReplyPrompt: primaryAgent?.postReplyPrompt ?? normalizeRequiredString(cfg.postReplyPrompt, AI_REPLY_DEFAULTS.postReplyPrompt, 2_000),
    commentReplyPrompt: primaryAgent?.commentReplyPrompt ?? normalizeRequiredString(cfg.commentReplyPrompt, AI_REPLY_DEFAULTS.commentReplyPrompt, 2_000),
    agents,
    apiKey,
  }
}

export async function getServerAiReplyConfig(): Promise<ServerAiReplyConfigData> {
  const { appStateEntry, sensitiveEntry } = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const apiKey = normalizeNullableString(sensitiveEntry.apiKey)
  return normalizeAiReplyConfig(appStateEntry, apiKey)
}

export async function getAiReplyConfig(): Promise<AiReplyConfigData> {
  const { apiKey, ...rest } = await getServerAiReplyConfig()
  return { ...rest, apiKeyConfigured: Boolean(apiKey) }
}

export function isAiReplyConfigRunnable(config: ServerAiReplyConfigData): boolean {
  return Boolean(
    config.enabled
    && config.agents.some((agent) => agent.enabled && agent.agentUserId)
    && config.model.trim()
    && config.baseUrl.trim()
    && config.apiKey?.trim(),
  )
}

export function isAiReplyConfigTestable(config: ServerAiReplyConfigData): boolean {
  return Boolean(
    config.agents.some((agent) => agent.enabled && agent.agentUserId)
    && config.model.trim()
    && config.baseUrl.trim()
    && config.apiKey?.trim(),
  )
}

function buildNextAiReplyStateEntry(existing: Record<string, unknown> | null, config: ServerAiReplyConfigData) {
  const pickStr = (k: string): string | null => (existing && typeof existing[k] === "string" ? (existing[k] as string) : null)
  const now = new Date().toISOString()
  return {
    ...(existing ?? {}),
    AppId: AI_REPLY_APP_KEY,
    enabled: config.enabled,
    installedAt: pickStr("installedAt") ?? now,
    uninstalledAt: null,
    config: {
      baseUrl: config.baseUrl,
      model: config.model,
      agentUserId: config.agentUserId,
      respondToPostMentions: config.respondToPostMentions,
      respondToCommentMentions: config.respondToCommentMentions,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      timeoutMs: config.timeoutMs,
      systemPrompt: config.systemPrompt,
      postReplyPrompt: config.postReplyPrompt,
      commentReplyPrompt: config.commentReplyPrompt,
      agents: config.agents,
    },
    status: "active" as const,
    version: pickStr("version") ?? "hosted",
    sourceDir: pickStr("sourceDir") ?? "src",
    lastActivatedAt: now,
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }
}

export async function resolveAiReplyConfigDraftFromAdminInput(body: JsonObject) {
  const snapshot = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const current = normalizeAiReplyConfig(snapshot.appStateEntry, normalizeNullableString(snapshot.sensitiveEntry.apiKey))

  const configInput: Record<string, unknown> = isRecord(body.config) ? (body.config as Record<string, unknown>) : {}
  const secretInput: Record<string, unknown> = isRecord(body.secret) ? (body.secret as Record<string, unknown>) : {}

  const agentUsernameInput = typeof configInput.agentUsername === "string" ? configInput.agentUsername.trim() : undefined
  const rawAgentsInput = Array.isArray(configInput.agents) ? configInput.agents : null

  let nextAgentUserId = current.agentUserId
  if (typeof agentUsernameInput === "string") {
    if (!agentUsernameInput) {
      nextAgentUserId = null
    } else {
      const agentUser = await prisma.user.findFirst({
        where: { OR: [{ username: agentUsernameInput }, { nickname: agentUsernameInput }] },
        select: { id: true },
      })
      if (!agentUser) {
        apiError(400, "AI 代理账号不存在，请填写正确的用户名或昵称")
      }
      nextAgentUserId = agentUser.id
    }
  }

  let nextAgents = current.agents
  if (rawAgentsInput) {
    const resolvedAgents: AiReplyAgentConfigData[] = []
    const seenUserIds = new Set<number>()

    for (let index = 0; index < rawAgentsInput.length && resolvedAgents.length < 20; index += 1) {
      const rawAgent = rawAgentsInput[index]
      if (!isRecord(rawAgent)) {
        continue
      }

      const agentUsername = typeof rawAgent.agentUsername === "string" ? rawAgent.agentUsername.trim() : ""
      let agentUserId = normalizeAgentUserId(rawAgent.agentUserId, null)
      if (agentUsername) {
        const agentUser = await prisma.user.findFirst({
          where: { OR: [{ username: agentUsername }, { nickname: agentUsername }] },
          select: { id: true },
        })
        if (!agentUser) {
          apiError(400, `机器人账号不存在：${agentUsername}`)
        }
        agentUserId = agentUser.id
      }

      const agent = buildDefaultAgentConfig({
        ...rawAgent,
        agentUserId,
      }, {
        id: typeof rawAgent.id === "string" ? rawAgent.id : `agent-${index + 1}`,
      })

      if (!agent.agentUserId || seenUserIds.has(agent.agentUserId)) {
        continue
      }

      seenUserIds.add(agent.agentUserId)
      resolvedAgents.push(agent)
    }

    nextAgents = resolvedAgents
  } else if (typeof agentUsernameInput === "string") {
    nextAgents = nextAgentUserId
      ? [
          buildDefaultAgentConfig({
            enabled: true,
            label: current.agents[0]?.label ?? "AI 助手",
            agentUserId: nextAgentUserId,
            respondToPostMentions: configInput.respondToPostMentions,
            respondToCommentMentions: configInput.respondToCommentMentions,
            systemPrompt: configInput.systemPrompt,
            postReplyPrompt: configInput.postReplyPrompt,
            commentReplyPrompt: configInput.commentReplyPrompt,
          }, current.agents[0]),
        ]
      : []
  }

  const primaryAgent = nextAgents[0] ?? null
  const testAgent = nextAgents.find((agent) => agent.enabled && agent.agentUserId) ?? primaryAgent
  const resolvedAgentUser = testAgent?.agentUserId
    ? await prisma.user.findUnique({
        where: { id: testAgent.agentUserId },
        select: { id: true, username: true, nickname: true, status: true },
      })
    : null

  const nextConfig: ServerAiReplyConfigData = {
    enabled: normalizeBoolean(configInput.enabled, current.enabled),
    baseUrl: normalizeBaseUrl(configInput.baseUrl, current.baseUrl),
    model: normalizeOptionalString(configInput.model, current.model, 200),
    agentUserId: primaryAgent?.agentUserId ?? nextAgentUserId,
    respondToPostMentions: primaryAgent?.respondToPostMentions ?? normalizeBoolean(configInput.respondToPostMentions, current.respondToPostMentions),
    respondToCommentMentions: primaryAgent?.respondToCommentMentions ?? normalizeBoolean(configInput.respondToCommentMentions, current.respondToCommentMentions),
    temperature: normalizeTemperature(configInput.temperature, current.temperature),
    maxOutputTokens: clampPositiveInt(configInput.maxOutputTokens, current.maxOutputTokens, 64, 4_000),
    timeoutMs: clampNonNegativeInt(configInput.timeoutMs, current.timeoutMs, 5_000, 120_000),
    systemPrompt: primaryAgent?.systemPrompt ?? normalizeRequiredString(configInput.systemPrompt, current.systemPrompt, 4_000),
    postReplyPrompt: primaryAgent?.postReplyPrompt ?? normalizeRequiredString(configInput.postReplyPrompt, current.postReplyPrompt, 2_000),
    commentReplyPrompt: primaryAgent?.commentReplyPrompt ?? normalizeRequiredString(configInput.commentReplyPrompt, current.commentReplyPrompt, 2_000),
    agents: nextAgents,
    apiKey: current.apiKey,
  }

  const clearApiKey = normalizeBoolean(secretInput.clearApiKey, false)
  const nextApiKeyInput = typeof secretInput.apiKey === "string" ? secretInput.apiKey.trim() : ""
  if (clearApiKey) {
    nextConfig.apiKey = null
  } else if (nextApiKeyInput) {
    nextConfig.apiKey = nextApiKeyInput
  }

  return {
    record: snapshot.record,
    appStateEntry: snapshot.appStateEntry,
    config: nextConfig,
    agentUser: resolvedAgentUser,
  }
}

export async function updateAiReplyConfigFromAdminInput(body: JsonObject): Promise<AiReplyConfigData> {
  const resolved = await resolveAiReplyConfigDraftFromAdminInput(body)
  await updateAiAppConfig(AI_REPLY_APP_KEY, {
    record: resolved.record,
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
    appStateEntry: buildNextAiReplyStateEntry(resolved.appStateEntry, resolved.config),
    sensitiveEntry: { apiKey: normalizeNullableString(resolved.config.apiKey) },
  })
  return getAiReplyConfig()
}
