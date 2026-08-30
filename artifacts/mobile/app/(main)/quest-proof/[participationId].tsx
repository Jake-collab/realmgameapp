/**
 * Quest Proof Submission Screen — Worlds
 *
 * Adaptive proof collection UI. Adapts to the quest's configured proof type:
 *   - text          → text area
 *   - image         → image uploader
 *   - location      → location capture
 *   - image_and_location → both
 *   - text_and_image     → both
 *   - manual_confirmation → simple confirm button
 *   - none          → not reachable (handled at Active Quest level)
 *
 * Rules:
 * - Never show irrelevant proof fields.
 * - Do NOT call proof service directly — use useSubmitQuestProof.
 * - Proof draft creation is a separate operation from submission.
 * - Show status clearly after submission; never auto-complete.
 * - Points are NOT shown here — only confirmed after completion.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuestDetail } from '@/features/quests/hooks';
import { questKeys } from '@/features/quests/queries/questKeys';
import { fetchParticipationById } from '@/features/quests/repositories/quest.repository';
import { createQuestProofDraft, submitQuestProof } from '@/features/quests/services/questProof.service';
import { useQuery as useRQQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentProof } from '@/features/quests/repositories/proof.repository';
import SubmissionStatus from '@/components/quest/SubmissionStatus';
import ImageUploader from '@/components/ui/ImageUploader';
import SafetyNotice from '@/components/quest/SafetyNotice';
import ProofRequirementSummary from '@/components/quest/ProofRequirementSummary';
import type { QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import type { ProofType } from '@/lib/supabase/database.types';
import type { ProofOperationResult } from '@/features/quests/services/questProof.service';
import { getSubmitProofInvalidationKeys } from '@/features/quests/queries/questKeys';
import { uploadProofMediaFromUri } from '@/services/media/media.service';
import { attachProofMedia } from '@/features/quests/repositories/proof.repository';
import { completeQuest } from '@/features/quests/services/questCompletion.service';
import { confirmQuestIntegrityRequirement } from '@/features/quests/services/questVerification.service';
import { formatRemainingTimer, getQuestVerificationMethods, verificationLabel } from '@/features/quests/utils/questVerification';

// ─── Header ───────────────────────────────────────────────────────────────────

function ProofHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const colors = useColors();
  return (
    <View style={[hStyles.row, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onBack}
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={[hStyles.title, { color: colors.foreground }]}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}
const hStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
});

// ─── Helper: proof needs certain inputs ───────────────────────────────────────
// Actual ProofType values: 'photo' | 'video' | 'text' | 'location' | 'qr_code' | 'none'

function needsText(proofType: ProofType): boolean {
  return proofType === 'text';
}
function needsPhoto(proofType: ProofType): boolean {
  return proofType === 'photo' || proofType === 'video';
}
function needsLocation(proofType: ProofType): boolean {
  return proofType === 'location';
}
function needsQrCode(proofType: ProofType): boolean {
  return proofType === 'qr_code';
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function QuestProofScreen() {
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [textResponse, setTextResponse] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [integrityConfirmedLocally, setIntegrityConfirmedLocally] = useState(false);
  const [isConfirmingIntegrity, setIsConfirmingIntegrity] = useState(false);

  // Load participation
  const participationQuery = useQuery<QuestParticipationRowExtended | null>({
    queryKey: questKeys.participation(participationId ?? ''),
    queryFn: () => fetchParticipationById(participationId!),
    enabled: !!participationId,
    staleTime: 30 * 1000,
  });

  const participation = participationQuery.data;
  const questId = participation?.quest_id ?? '';
  const detailQuery = useQuestDetail(questId || null);
  const quest = detailQuery.data;

  // Load current proof (for resubmission flow)
  const proofQuery = useRQQuery({
    queryKey: questKeys.proof(participationId ?? ''),
    queryFn: () => fetchCurrentProof(participationId!),
    enabled: !!participationId,
    staleTime: 15 * 1000,
  });

  const existingProof = proofQuery.data;
  const proofType: ProofType = quest?.proof_type ?? 'text';
  const methods = quest ? getQuestVerificationMethods(quest) : [];
  const requiresCamera = methods.includes('camera') || needsPhoto(proofType);
  const requiresGps = methods.includes('gps') || needsLocation(proofType);
  const requiresIntegrity = methods.includes('integrity_confirmation');
  const requiresTimer = methods.includes('timer');
  const requiresText = needsText(proofType);
  const hasEvidenceInput = requiresText || requiresCamera || requiresGps || needsQrCode(proofType);
  const integrityConfirmed = integrityConfirmedLocally || !!participation?.integrity_confirmed_at;
  const submissionType: ProofType = requiresCamera
    ? proofType === 'video' ? 'video' : 'photo'
    : requiresGps ? 'location' : proofType;

  useEffect(() => {
    setIntegrityConfirmedLocally(false);
  }, [participationId]);
  const isResubmission = participation?.status === 'needs_resubmission';

  // ── Validation ─────────────────────────────────────────────────────────────

  const canSubmit = useCallback((): boolean => {
    if (!quest) return false;
    if (requiresText && textResponse.trim().length < 10) return false;
    if (requiresCamera && !imageUri) return false;
    if (requiresGps && !locationCaptured) return false;
    if (requiresTimer && !participation?.verification_earliest_completion_at) return false;
    if (requiresTimer && formatRemainingTimer(participation?.verification_earliest_completion_at ?? null)) return false;
    if (requiresIntegrity && !integrityConfirmed) return false;
    return true;
  }, [
    quest, requiresText, requiresCamera, requiresGps, requiresTimer,
    requiresIntegrity, participation?.verification_earliest_completion_at,
    integrityConfirmed, textResponse, imageUri, locationCaptured,
  ]);

  const confirmIntegrity = useCallback(async () => {
    if (!participationId || !user?.id || !requiresIntegrity) return false;
    setIsConfirmingIntegrity(true);
    try {
      const result = await confirmQuestIntegrityRequirement({ participationId, userId: user.id });
      if (!result.success) {
        Alert.alert('Cannot confirm yet', result.error.message);
        return false;
      }
      setIntegrityConfirmedLocally(true);
      await participationQuery.refetch();
      return true;
    } finally {
      setIsConfirmingIntegrity(false);
    }
  }, [participationId, user?.id, requiresIntegrity, participationQuery]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit() || !participationId || !user?.id) return;

    setIsSubmitting(true);
    try {
      if (requiresIntegrity && !integrityConfirmed) {
        await confirmIntegrity();
        return;
      }

      // Timer/integrity-only Quests have no proof row by design. Completion is
      // still awarded only by the trusted RPC after its server checks.
      if (!hasEvidenceInput) {
        const completion = await completeQuest({ participationId, userId: user.id });
        if (!completion.success) {
          Alert.alert('Not ready to complete', completion.error?.message ?? 'The Quest requirements are not complete.');
          return;
        }
        setSubmitted(true);
        return;
      }

      // 1. Create draft
      const draftResult: ProofOperationResult = await createQuestProofDraft({
        participationId,
        userId: user.id,
        submissionType,
        textResponse: requiresText ? textResponse.trim() : undefined,
        locationLat: capturedLocation?.latitude,
        locationLng: capturedLocation?.longitude,
        locationAccuracyMeters: capturedLocation?.accuracy ?? undefined,
      });

      if (!draftResult.success || !draftResult.proof) {
        if (draftResult.error?.code === 'VERIFICATION_SESSION_UNAVAILABLE') {
          Alert.alert(
            'Secure verification unavailable',
            'We could not start the required secure verification session. Your evidence was not submitted. Please try again.',
          );
        } else {
          Alert.alert('Error', draftResult.error?.message ?? 'Could not create proof draft.');
        }
        return;
      }

       if (requiresCamera && imageUri) {
        const asset = await uploadProofMediaFromUri({
          userId: user.id,
          localUri: imageUri,
           mimeType: submissionType === 'video' ? 'video/mp4' : 'image/jpeg',
          proofId: draftResult.proof.id,
           mediaType: submissionType === 'video' ? 'video' : 'image',
        });
        await attachProofMedia(draftResult.proof.id, asset.id, 0);
      }

      // 2. Submit the draft
      const submitResult = await submitQuestProof(draftResult.proof.id, user.id, participationId);

      if (!submitResult.success) {
        Alert.alert('Error', submitResult.error?.message ?? 'Could not submit proof.');
        return;
      }

      // 3. Invalidate queries
      const keys = getSubmitProofInvalidationKeys(user.id, questId, participationId);
      await Promise.all(keys.map(key => queryClient.invalidateQueries({ queryKey: key })));

      setSubmitted(true);
    } catch (err) {
      Alert.alert('Error', 'Could not submit proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit, participationId, user, submissionType, requiresText, textResponse,
    questId, queryClient, capturedLocation, requiresCamera, requiresIntegrity,
    integrityConfirmed, confirmIntegrity, hasEvidenceInput,
  ]);

  // ── Submitted state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ProofHeader
          onBack={() => router.back()}
          title="Proof Submitted"
        />
        <ScrollView contentContainerStyle={styles.submittedContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.successIcon, { backgroundColor: colors.success + '15' }]}>
            <Feather name="check-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Proof Submitted!
          </Text>
          <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
            {requiresGps
              ? 'Your location evidence was submitted and is awaiting server validation. You will be notified when a decision is available.'
              : quest?.completion_mode === 'manual_review'
              ? "Your proof is now under review. You'll be notified when a decision is available."
              : 'Your proof has been received.'}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/quest')}
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>
              Back to Quests
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const isLoading = participationQuery.isLoading || (!!questId && detailQuery.isLoading);

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ProofHeader onBack={() => router.back()} title="Submit Proof" />
        <View style={styles.loadingState}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!participation || !quest) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ProofHeader onBack={() => router.back()} title="Submit Proof" />
        <View style={styles.loadingState}>
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
            Could not load quest data.
          </Text>
        </View>
      </View>
    );
  }

  const isReadOnly = ['under_review', 'approved'].includes(existingProof?.status ?? '');

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProofHeader
        onBack={() => router.back()}
        title={isResubmission ? 'Resubmit Proof' : 'Submit Proof'}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Quest title */}
        <View style={styles.questContext}>
          <Text style={[styles.questLabel, { color: colors.mutedForeground }]}>Quest</Text>
          <Text style={[styles.questTitle, { color: colors.foreground }]}>{quest.title}</Text>
        </View>

        {/* Resubmission status */}
        {isResubmission && existingProof && (
          <View style={styles.section}>
            <SubmissionStatus
              status="needs_resubmission"
              submittedAt={existingProof.submitted_at}
              reviewNotes={existingProof.review_notes}
            />
          </View>
        )}

        {/* Under review — read-only */}
        {isReadOnly && existingProof && (
          <View style={styles.section}>
            <SubmissionStatus
              status={existingProof.status}
              submittedAt={existingProof.submitted_at}
            />
          </View>
        )}

        {/* Proof requirement summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Required Proof</Text>
           <View style={styles.methodList}>
             {methods.map(method => (
               <View key={method} style={[styles.methodRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                 <Feather name={method === 'camera' ? 'camera' : method === 'gps' ? 'map-pin' : method === 'timer' ? 'clock' : 'check-circle'} size={16} color={colors.primary} />
                 <Text style={[styles.methodText, { color: colors.foreground }]}>{verificationLabel(method)}</Text>
                  {method === 'timer' && <Text style={[styles.methodMeta, { color: colors.mutedForeground }]}>{formatRemainingTimer(participation.verification_earliest_completion_at ?? null) ?? 'Not started'}</Text>}
               </View>
             ))}
           </View>
           {quest.proof_type !== 'none' && (
             <ProofRequirementSummary proofType={quest.proof_type} completionMode={quest.completion_mode} />
           )}
        </View>

        {/* Text input */}
        {requiresText && !isReadOnly && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Your Response
            </Text>
            <TextInput
              value={textResponse}
              onChangeText={setTextResponse}
              placeholder="Write your response here (minimum 10 characters)…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={2000}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              accessibilityLabel="Proof text response"
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {textResponse.length} / 2000
            </Text>
          </View>
        )}

        {/* Photo/video upload */}
        {requiresCamera && !isReadOnly && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {proofType === 'video' ? 'Video Evidence' : 'Photo Evidence'}
            </Text>
            <ImageUploader
               label={proofType === 'video' ? 'Live video required' : 'Live photo required'}
              aspectRatio={4 / 3}
              currentUri={imageUri}
              onImage={setImageUri}
              onRemove={() => setImageUri(null)}
              captureMode="camera"
              mediaType={proofType === 'video' ? 'video' : 'image'}
            />
             <Text style={[styles.evidenceHint, { color: colors.mutedForeground }]}>
               {proofType === 'video'
                 ? 'Record a new video with your camera. Videos from your library cannot be used.'
                 : 'Take a new photo with your camera. Photos from your library cannot be used.'}
             </Text>
          </View>
        )}

        {/* Location capture */}
        {requiresGps && !isReadOnly && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Location Check-In
            </Text>
            <Pressable
              onPress={async () => {
                try {
                  const permission = await Location.requestForegroundPermissionsAsync();
                  if (permission.status !== Location.PermissionStatus.GRANTED) {
                    Alert.alert('Permission needed', 'Allow foreground location access to collect location evidence for this Quest.');
                    return;
                  }
                  const position = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                  });
                  setCapturedLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                  });
                  setLocationCaptured(true);
                } catch {
                  Alert.alert('Location unavailable', 'We could not capture your current location. Try again outdoors.');
                }
              }}
              style={[
                styles.locationBtn,
                {
                  backgroundColor: locationCaptured ? colors.success + '15' : colors.secondary,
                  borderColor: locationCaptured ? colors.success + '50' : colors.border,
                },
              ]}
              accessibilityLabel={locationCaptured ? 'Location captured. Tap to update.' : 'Capture location'}
              accessibilityRole="button"
            >
              <Feather
                name={locationCaptured ? 'check-circle' : 'map-pin'}
                size={20}
                color={locationCaptured ? colors.success : colors.accent}
              />
              <Text style={[styles.locationText, { color: locationCaptured ? colors.success : colors.foreground }]}>
                {locationCaptured ? 'Location evidence captured — awaiting server validation' : 'Capture current location'}
              </Text>
              {!locationCaptured && (
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              )}
            </Pressable>
          </View>
        )}

        {/* QR Code scanning */}
        {needsQrCode(proofType) && !isReadOnly && (
          <View style={styles.section}>
            <View
              style={[
                styles.confirmNote,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="maximize" size={18} color={colors.primary} />
              <Text style={[styles.confirmNoteText, { color: colors.mutedForeground }]}>
                QR scanning is not available in this version, so this quest cannot be submitted here.
              </Text>
            </View>
          </View>
        )}

        {/* None — simple completion confirmation */}
        {requiresIntegrity && !isReadOnly && (
          <View style={styles.section}>
            <View
              style={[
                styles.confirmNote,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={[styles.confirmNoteText, { color: colors.mutedForeground }]}>
                Confirm that you completed the activity honestly. This confirmation is recorded server-side.
              </Text>
              {!integrityConfirmed && (
                <TouchableOpacity
                  onPress={() => void confirmIntegrity()}
                  disabled={isConfirmingIntegrity}
                  style={[styles.confirmIntegrityButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.semiBold }}>
                    {isConfirmingIntegrity ? 'Confirming…' : 'I confirm'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Safety notes */}
        {quest.safety_notes && (
          <View style={styles.section}>
            <SafetyNotice notes={quest.safety_notes} />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Submit action ──────────────────────────────────────────── */}
      {!isReadOnly && (
        <View
          style={[
            styles.actionBar,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          {!canSubmit() && (
            <Text style={[styles.validationHint, { color: colors.mutedForeground }]}>
               {requiresText && textResponse.trim().length < 10
                ? `${Math.max(0, 10 - textResponse.trim().length)} more character${10 - textResponse.trim().length !== 1 ? 's' : ''} needed`
                 : requiresCamera && !imageUri
                ? `${proofType === 'video' ? 'Video' : 'Photo'} required`
                 : requiresGps && !locationCaptured
                ? 'Location check-in required'
                  : requiresTimer && formatRemainingTimer(participation.verification_earliest_completion_at ?? null)
                  ? formatRemainingTimer(participation.verification_earliest_completion_at ?? null)
                 : requiresIntegrity && !integrityConfirmed
                 ? 'Integrity confirmation required'
                 : needsQrCode(proofType)
                 ? 'QR scanning is unavailable for this quest'
                : ''}
            </Text>
          )}
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={!canSubmit() || isSubmitting}
            accessibilityLabel={isResubmission ? 'Resubmit proof' : 'Submit proof'}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: canSubmit() && !isSubmitting
                  ? colors.primary
                  : colors.muted,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.submitLabel,
                { color: canSubmit() ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {isSubmitting ? 'Submitting…' : isResubmission ? 'Resubmit Proof' : 'Submit Proof'}
            </Text>
            {!isSubmitting && canSubmit() && (
              <Feather name="send" size={16} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[4] },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  questContext: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    gap: spacing[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  questLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  questTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  section: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[2],
  },
  methodList: { gap: spacing[2] },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  methodText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    flexShrink: 1,
  },
  methodMeta: {
    marginLeft: 'auto',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textInput: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    alignSelf: 'flex-end',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  locationText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
  },
  evidenceHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  confirmNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmNoteText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  confirmIntegrityButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  actionBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[8],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  validationHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
  },
  submitLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  submittedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[5],
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
  },
  successBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
    textAlign: 'center',
  },
  doneBtn: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    marginTop: spacing[2],
  },
  doneBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
});
