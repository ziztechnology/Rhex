import { prisma } from "@/db/client"
import { UserStatus, type Prisma } from "@/db/types"

export function clearExpiredUserRestrictions(now = new Date()) {
  return prisma.user.updateMany({
    where: {
      status: {
        in: [UserStatus.MUTED, UserStatus.BANNED],
      },
      statusExpiresAt: {
        lte: now,
      },
    },
    data: {
      status: UserStatus.ACTIVE,
      statusExpiresAt: null,
    },
  })
}

export async function normalizeExpiredUserRestrictionByUsername<TSelect extends Prisma.UserSelect>(
  username: string,
  select: TSelect,
) {
  const user = await prisma.user.findUnique({
    where: { username },
    select,
  })

  const status = (user as { status?: UserStatus | string } | null)?.status
  const statusExpiresAt = (user as { statusExpiresAt?: Date | null } | null)?.statusExpiresAt

  if (
    (status === UserStatus.MUTED || status === UserStatus.BANNED)
    && statusExpiresAt
    && statusExpiresAt.getTime() <= Date.now()
  ) {
    return prisma.user.update({
      where: { username },
      data: {
        status: UserStatus.ACTIVE,
        statusExpiresAt: null,
      },
      select,
    })
  }

  return user
}
