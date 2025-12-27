import { z } from 'zod';
import { insertScanSchema, insertScheduleSchema, scans, schedules, decisions, scanResults } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  scans: {
    list: {
      method: 'GET' as const,
      path: '/api/scans',
      responses: {
        200: z.array(z.custom<typeof scans.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/scans',
      input: insertScanSchema,
      responses: {
        201: z.custom<typeof scans.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/scans/:id',
      responses: {
        200: z.custom<typeof scans.$inferSelect & { result?: typeof scanResults.$inferSelect, decision?: typeof decisions.$inferSelect }>(),
        404: errorSchemas.notFound,
      },
    },
  },
  schedules: {
    list: {
      method: 'GET' as const,
      path: '/api/schedules',
      responses: {
        200: z.array(z.custom<typeof schedules.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/schedules',
      input: insertScheduleSchema,
      responses: {
        201: z.custom<typeof schedules.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    toggle: {
      method: 'PATCH' as const,
      path: '/api/schedules/:id/toggle',
      input: z.object({ isActive: z.boolean() }),
      responses: {
        200: z.custom<typeof schedules.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalScans: z.number(),
          criticalVulnerabilities: z.number(),
          activeSchedules: z.number(),
          recentDecisions: z.array(z.custom<typeof decisions.$inferSelect>()),
        }),
      },
    },
  },
  vulnerabilities: {
    list: {
      method: 'GET' as const,
      path: '/api/vulnerabilities',
      responses: {
        200: z.array(z.custom<{ address: string, type: string, severity: number | null, discovered: string }>()),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
