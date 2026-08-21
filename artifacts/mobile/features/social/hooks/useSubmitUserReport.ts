import { useMutation } from '@tanstack/react-query';
import { submitUserReport } from '../repositories/social.repository';
import type { ReportReason } from '../types/social.types';

export function useSubmitUserReport() {
  return useMutation({
    mutationFn: ({
      targetUsername,
      reason,
      description,
    }: {
      targetUsername: string;
      reason: ReportReason;
      description?: string;
    }) => submitUserReport(targetUsername, reason, description),
    retry: 0,
  });
}
