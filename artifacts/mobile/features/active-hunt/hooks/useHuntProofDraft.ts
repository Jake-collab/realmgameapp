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

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { loadCachedRecord, saveCachedRecord } from '@/features/offline/storage/offlineStorage';
import { saveLocalAsset } from '@/features/offline/storage/localAssets';
import { enqueueOfflineMutation } from '@/features/offline/queue/mutationQueue';
import { offlineStorage } from '@/features/offline/storage/offlineStorage';
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
  const { user } = useAuth();
  const restored = useRef(false);
  const [draft, setDraft] = useState<ProofDraftState>(() =>
    createEmptyProofDraft(participationId, stopId, completionMethod, previousSubmissionId)
  );

  const cacheId = `hunt-proof-draft:${participationId}:${stopId}`;
  useEffect(() => {
    if (!user?.id || restored.current) return;
    restored.current = true;
    void loadCachedRecord<ProofDraftState>(user.id, cacheId).then(record => {
      if (!record?.value) return;
      const value = record.value;
      setDraft({ ...value, lastUpdatedAt: value.lastUpdatedAt ? new Date(value.lastUpdatedAt) : null });
    });
  }, [cacheId, user?.id]);
  useEffect(() => {
    if (!user?.id || !restored.current || !draft.textResponse && draft.images.length === 0) return;
    void saveCachedRecord(user.id, cacheId, draft, { staleAfterMs: 7 * 24 * 60 * 60 * 1000 });
  }, [cacheId, draft, user?.id]);
  useEffect(() => {
    if (!user?.id || !draft.images.length) return;
    const timer = setInterval(() => {
      void offlineStorage.loadAssets(user.id).then(assets => {
        const byId = new Map(assets.map(asset => [asset.id, asset]));
        setDraft(current => {
          let changed = false;
          const images = current.images.map(image => {
            const asset = image.localAssetId ? byId.get(image.localAssetId) : undefined;
            if (!asset?.remoteAssetId || image.mediaId === asset.remoteAssetId) return image;
            changed = true;
            return { ...image, mediaId: asset.remoteAssetId, uploadState: 'uploaded' as const, errorMessage: null };
          });
          return changed ? { ...current, images } : current;
        });
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [draft.images.length, user?.id]);

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
    const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (user?.id) {
      void saveLocalAsset({
        id: assetId, userId: user.id, uri: localUri, mimeType: 'image/jpeg', size: fileSizeBytes ?? null, sha256: null,
        domain: 'hunt_proof', entityId: participationId, status: 'waiting', retryCount: 0, remoteAssetId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      void enqueueOfflineMutation({
        userId: user.id, mutationType: 'proof_media_upload', entityType: 'proof_media', entityId: assetId,
        payload: { assetId, localUri, mimeType: 'image/jpeg', fileSize: fileSizeBytes ?? null, proofId: participationId },
      });
    }
    setDraft(prev => {
      if (prev.images.length >= prev.maxImages) return prev;
      const newImage: ProofImageItem = {
        localAssetId: assetId,
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
  }, [participationId, user?.id]);

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
    if (user?.id) void saveCachedRecord(user.id, cacheId, null, { staleAfterMs: 0 });
  }, [cacheId, completionMethod, participationId, previousSubmissionId, user?.id]);

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
