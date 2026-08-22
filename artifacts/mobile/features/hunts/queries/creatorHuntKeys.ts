export const creatorHuntKeys = {
  all: ['creator-hunts'] as const,
  list: (userId: string) => [...creatorHuntKeys.all, 'list', userId] as const,
  draft: (draftId: string, userId: string) => [...creatorHuntKeys.all, 'draft', draftId, userId] as const,
  validation: (draftId: string, revision: number) => [...creatorHuntKeys.all, 'validation', draftId, revision] as const,
};