import { UserRole, UserStatus } from "@/db/types"

import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { clearExpiredUserRestrictions } from "@/db/user-status-queries"

export async function buildAdminUserSummary(where: Prisma.UserWhereInput, now: Date) {
  await clearExpiredUserRestrictions(now)

  const [total, groupedRows, vip] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["status", "role"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.user.count({
      where: {
        AND: [
          where,
          {
            vipExpiresAt: {
              gt: now,
            },
          },
        ],
      },
    }),
  ])

  const summary = {
    total,
    active: 0,
    muted: 0,
    banned: 0,
    inactive: 0,
    admin: 0,
    moderator: 0,
    vip,
  }

  for (const row of groupedRows) {
    if (row.status === UserStatus.ACTIVE) {
      summary.active += row._count._all
    } else if (row.status === UserStatus.MUTED) {
      summary.muted += row._count._all
    } else if (row.status === UserStatus.BANNED) {
      summary.banned += row._count._all
    } else if (row.status === UserStatus.INACTIVE) {
      summary.inactive += row._count._all
    }

    if (row.role === UserRole.ADMIN) {
      summary.admin += row._count._all
    } else if (row.role === UserRole.MODERATOR) {
      summary.moderator += row._count._all
    }
  }

  return summary
}

export function findAdminUsersPage(where: Prisma.UserWhereInput, orderBy: Prisma.UserOrderByWithRelationInput[], skip: number, take: number) {
  return prisma.user.findMany({
    where,
    orderBy,
    include: {
      inviter: {
        select: {
          username: true,
          nickname: true,
        },
      },
      levelProgress: {
        select: {
          checkInDays: true,
        },
      },
      _count: {
        select: {
          favorites: true,
        },
      },
      moderatedZoneScopes: {
        orderBy: [{ zone: { sortOrder: "asc" } }, { createdAt: "asc" }],
        include: {
          zone: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      moderatedBoardScopes: {
        orderBy: [{ board: { sortOrder: "asc" } }, { createdAt: "asc" }],
        include: {
          board: {
            select: {
              id: true,
              name: true,
              slug: true,
              zoneId: true,
              zone: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take,
  })
}

export async function findModeratorScopeOptions() {
  const [zones, boards] = await prisma.$transaction(async (tx) => {
    return Promise.all([
      tx.zone.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
      tx.board.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          zoneId: true,
          zone: {
            select: {
              name: true,
            },
          },
        },
      }),
    ])
  })

  return {
    zones,
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      slug: board.slug,
      zoneId: board.zoneId ?? null,
      zoneName: board.zone?.name ?? null,
    })),
  }
}
