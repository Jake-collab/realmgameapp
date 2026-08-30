export const revenueKeys = {
  all: ['revenue'] as const,
  summary: (userId: string) => [...revenueKeys.all, 'summary', userId] as const,
};