/**
 * useHuntProofDraft — Worlds (Prompt 13)
 *
 * Local proof draft state for a hunt stop. Ephemeral — never persisted.
 * Manages text input, image selection/upload state, and draft readiness.
 *
 * Rules:
 * - Draft is local only — never transmitted until explicit submission.
 * - Images are tracked by localUri + uploadState until mediaId is assigned.
 * - Draft is cleared after confirmed submission.
 * - Draft is preserved across proof modal open/close within the session.
 * - No private geometry or clue solutions are ever stored.
 */

import { useState, useCallback, useMemo } from 'react';
import type { StopCompletionMethod } from '@/features/hunts/types/hunt.types';
import {
  createEmptyProofDraft,
  evaluateProofDraftReadiness,
  type ProofDraftState,
  type ProofImageItem,
} from '../types/activeHunt.types';

interface UseHuntProofDraftOptions {
  participationId: string;
  stopId: string;
  completionMethod: StopCompletionMethod;
  previousSubmissionId?: string | null;
}

export function useHuntProofDraft({
  participationId,
  stopId,
  completionMethod,
  previousSubmissionId,
}: UseHuntProofDraftOptions) {
  const [draft, setDraft] = useState<ProofDraftState>(() =>
    createEmptyProofDraft(participationId, stopId, completionMethod, previousSubmissionId)
  );

  // ── Text ─────────────────────────────────────────────────────────────────────

  const setTextResponse = useCallback((text: string) => {
    setDraft(prev => ({
      ...prev,
      textResponse: text,
      lastUpdatedAt: new Date(),
    }));
  }, []);

  // ── Images ────────────────────────────────────────────────────────────────────

  const addImage = useCallback((localUri: string, fileSizeBytes?: number) => {
    setDraft(prev => {
      if (prev.images.length >= prev.maxImages) return prev;
      const newImage: ProofImageItem = {
        localUri,
        mediaId:     null,
        uploadState: 'idle',
        errorMessage:null,
        fileSizeBytes: fileSizeBytes ?? null,
      };
      return {
        ...prev,
        images: [...prev.images, newImage],
        lastUpdatedAt: new Date(),
      };
    });
  }, []);

  const removeImage = useCallback((localUri: string) => {
    setDraft(prev => ({
      ...prev,
      images: prev.images.filter(img => img.localUri !== localUri),
      lastUpdatedAt: new Date(),
    }));
  }, []);

  const setImageUploadState = useCallback((
    localUri: string,
    uploadState: ProofImageItem['uploadState'],
    mediaId?: string | null,
    errorMessage?: string | null,
  ) => {
    setDraft(prev => ({
      ...prev,
      images: prev.images.map(img =>
        img.localUri === localUri
          ? { ...img, uploadState, mediaId: mediaId ?? img.mediaId, errorMessage: errorMessage ?? null }
          : img
      ),
      lastUpdatedAt: new Date(),
    }));
  }, []);

  // ── Location validation ────────────────────────────────────────────────────────

  const setLocationValidated = useCallback((validated: boolean) => {
    setDraft(prev => ({
      ...prev,
      locationValidated: validated,
      lastUpdatedAt: new Date(),
    }));
  }, []);

  // ── Submission state ──────────────────────────────────────────────────────────

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setDraft(prev => ({ ...prev, isSubmitting }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(createEmptyProofDraft(participationId, stopId, completionMethod, previousSubmissionId));
  }, [participationId, stopId, completionMethod, previousSubmissionId]);

  // ── Derived readiness ─────────────────────────────────────────────────────────

  const { isReady, missingItems } = useMemo(
    () => evaluateProofDraftReadiness(draft),
    [draft],
  );

  // ── Uploaded media IDs for submission ─────────────────────────────────────────

  const uploadedMediaIds = useMemo(
    () => draft.images
      .filter(img => img.mediaId !== null)
      .map(img => img.mediaId!),
    [draft.images],
  );

  const hasFailedUploads = draft.images.some(img => img.uploadState === 'error');
  const hasUploadingImages = draft.images.some(img => img.uploadState === 'uploading');
  const characterCount = draft.textResponse.length;

  return {
    draft,
    isReady,
    missingItems,
    hasFailedUploads,
    hasUploadingImages,
    characterCount,
    uploadedMediaIds,
    // Actions
    setTextResponse,
    addImage,
    removeImage,
    setImageUploadState,
    setLocationValidated,
    setSubmitting,
    clearDraft,
  };
}
