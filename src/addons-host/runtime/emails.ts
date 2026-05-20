import "server-only"

import { prisma } from "@/db/client"
import { sendUserNotificationEmail } from "@/lib/mailer"
import type {
  AddonEmailSendInput,
  AddonEmailSendResult,
} from "@/addons-host/types"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null
}

async function resolveAddonEmailRecipient(input: AddonEmailSendInput) {
  const userId = normalizePositiveInteger(input.recipientId)
  const username = normalizeOptionalString(input.recipientUsername)

  if (!userId && !username) {
    throw new Error("邮件接收账号需要提供 recipientId 或 recipientUsername")
  }

  const recipient = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          emailVerifiedAt: true,
        },
      })
    : await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          emailVerifiedAt: true,
        },
      })

  if (!recipient) {
    throw new Error(
      username
        ? `未找到邮件接收账号 ${username}`
        : `未找到邮件接收账号 #${userId}`,
    )
  }

  if (!recipient.email || !recipient.emailVerifiedAt) {
    throw new Error(`邮件接收账号 ${recipient.username} 没有已验证邮箱`)
  }

  return {
    ...recipient,
    email: recipient.email,
  }
}

export async function sendAddonEmail(
  input: AddonEmailSendInput,
): Promise<AddonEmailSendResult> {
  const recipient = await resolveAddonEmailRecipient(input)
  const subject = normalizeOptionalString(input.subject)
  const text = normalizeOptionalString(input.text)
  const html = normalizeOptionalString(input.html)

  if (!subject) {
    throw new Error("邮件标题不能为空")
  }

  if (!text && !html) {
    throw new Error("邮件正文需要提供 text 或 html")
  }

  await sendUserNotificationEmail({
    to: recipient.email,
    subject,
    text: text || html,
    html: html || text,
  })

  return {
    userId: recipient.id,
    username: recipient.username,
    sent: true,
    sentAt: new Date().toISOString(),
  }
}
