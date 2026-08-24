/**
 * Active Hunt Screen — Worlds (Prompt 13)
 *
 * Full stop-by-stop hunt gameplay experience.
 *
 * Architecture:
 * - Single scrollable screen with inline modals for proof and completion
 * - No optimistic updates — all completion/proof is server-authoritative
 * - Redirects non-active states immediately (completed → completion screen, etc.)
 * - Locked clues are NEVER rendered
 * - No private geometry or stop coordinates exposed
 * - Location requested only on explicit user action ("Check Location" tap)
 * - Signed proof image URLs handled via storage service (never public)
 *
 * State machine:
 *   loading → fetch hunt data
 *   active/paused → main gameplay
 *   completed → redirect to hunt-completion screen
 *   withdrawn/removed/cancelled → HuntStatusState (terminal)
 *   not_found/unauthorized → HuntStatusState (error)
 *
 * Stop action flow:
 *   manual_confirmation → confirmation modal → rpcCompleteHuntStop
 *   location → LocationValidationPanel → (if validated) → rpcCompleteHuntStop
 *   text/image/text_and_image → HuntProofDraft modal → HuntProofReview → rpcSubmitHuntProof
 *   image_and_location → location first → then HuntProofDraft
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useActiveHunt } from '@/features/hunts/hooks/useActiveHunt';
import { useCompleteHuntStop } from '@/features/hunts/hooks/useCompleteHuntStop';
import { useCompleteHunt } from '@/features/hunts/hooks/useCompleteHunt';
import { useWithdrawFromHunt } from '@/features/hunts/hooks/useWithdrawFromHunt';
import { useCollectHuntDrop } from '@/features/hunts/hooks/useCollectHuntDrop';
import { useHuntDropSearchZones } from '@/features/hunts/hooks/useHuntDropSearchZones';

import {
  useSubmitHuntProof,
  useValidateHuntStopLocation,
  useHuntSubmissionDetail,
  useHuntCompletionReadiness,
  useHuntProofDraft,
  resolveStopAction,
  resolveHuntLevelAction,
  resolveActiveHuntViewMode,
} from '@/features/active-hunt';

import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

import { ActiveHuntHeader }       from '@/components/active-hunt/ActiveHuntHeader';
import { CurrentCluePanel }       from '@/components/active-hunt/CurrentCluePanel';
import { HuntProgressSummary }    from '@/components/active-hunt/HuntProgressSummary';
import { HuntDeadlineNotice }     from '@/components/active-hunt/HuntDeadlineNotice';
import { ActiveHuntSkeleton }     from '@/components/active-hunt/ActiveHuntSkeleton';
import { HuntStatusState }        from '@/components/active-hunt/HuntStatusState';
import { UnorderedStopSelector }  from '@/components/active-hunt/UnorderedStopSelector';
import { LocationValidationPanel } from '@/components/active-hunt/LocationValidationPanel';
import { HuntProofDraft }         from '@/components/active-hunt/HuntProofDraft';
import { HuntProofReview }        from '@/components/active-hunt/HuntProofReview';
import { WithdrawalConfirmation } from '@/components/active-hunt/WithdrawalConfirmation';
import { HuntSubmissionStatus }   from '@/components/active-hunt/HuntSubmissionStatus';
import { DropSearchPanel }       from '@/components/active-hunt/DropSearchPanel';

import type { ActiveHuntStop } from '@/features/hunts/types/hunt.types';
import type { StopCompletionMethod } from '@/features/hunts/types/hunt.types';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HuntActiveScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const { user } = useAuth();

  // ── Core hunt data ───────────────────────────────────────────────────────────
  const {
    data: hunt,
    isLoading,
    error: huntError,
    refetch,
  } = useActiveHunt({
    participationId: participationId ?? null,
    userId: user?.id ?? null,
    pollingIntervalMs: 30_000, // poll every 30s during active gameplay
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const completeStopMutation   = useCompleteHuntStop();
  const completeHuntMutation   = useCompleteHunt();
  const withdrawMutation       = useWithdrawFromHunt();
  const submitProofMutation    = useSubmitHuntProof();
  const dropZones = useHuntDropSearchZones({
    participationId: participationId ?? null,
    userId: user?.id ?? null,
  });
  const dropCollection = useCollectHuntDrop({
    participationId: participationId ?? '',
    userId: user?.id ?? '',
    huntId: hunt?.huntId ?? '',
  });

  // ── View mode ─────────────────────────────────────────────────────────────────
  const viewMode = useMemo(
    () => resolveActiveHuntViewMode(hunt?.participationStatus ?? null),
    [hunt?.participationStatus]
  );

  // ── Redirect on completion ───────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === 'completed') {
      router.replace(`/(main)/hunt-completion/${participationId}`);
    }
  }, [viewMode, participationId]);

  // ── Selected stop (unordered: user picks; ordered: auto-current) ─────────────
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const currentStop: ActiveHuntStop | null = useMemo(() => {
    if (!hunt?.currentStops.length) return null;
    const isOrdered = hunt.isOrdered ?? false;

    if (isOrdered) {
      // First available/in_progress/awaiting_proof stop
      return hunt.currentStops.find(s =>
        ['available', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission', 'rejected'].includes(s.progressStatus)
      ) ?? hunt.currentStops[hunt.currentStops.length - 1];
    }

    // Unordered: selected stop or first available
    if (selectedStopId) {
      const found = hunt.currentStops.find(s => s.id === selectedStopId);
      if (found) return found;
    }
    return hunt.currentStops.find(s =>
      ['available', 'in_progress', 'awaiting_proof', 'needs_resubmission', 'rejected'].includes(s.progressStatus)
    ) ?? hunt.currentStops[0];
  }, [hunt, selectedStopId]);

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [showProofDraft,     setShowProofDraft]     = useState(false);
  const [showProofReview,    setShowProofReview]     = useState(false);
  const [showWithdrawal,     setShowWithdrawal]      = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showLocationPanel,  setShowLocationPanel]   = useState(false);
  const [completeConfirmMsg, setCompleteConfirmMsg]  = useState('');
  const [isCompletingHunt,   setIsCompletingHunt]    = useState(false);
  const [huntCompleteError,  setHuntCompleteError]   = useState<string | null>(null);
  const [withdrawError,      setWithdrawError]       = useState<string | null>(null);
  const [isWithdrawing,      setIsWithdrawing]       = useState(false);

  // ── Location validation (for current stop) ───────────────────────────────────
  const { validationResult, isAcquiring, validate: validateLocation, reset: resetLocation } =
    useValidateHuntStopLocation({
      participationId: participationId ?? '',
      stopId: currentStop?.id ?? '',
    });

  // ── Proof draft (for current stop) ──────────────────────────────────────────
  const proofDraft = useHuntProofDraft({
    participationId: participationId ?? '',
    stopId: currentStop?.id ?? '',
    completionMethod: (currentStop?.completionMethod ?? 'manual_confirmation') as StopCompletionMethod,
    previousSubmissionId: null, // set on resubmission
  });

  // ── Submission detail (for under_review stops) ────────────────────────────────
  const { data: submissionDetail } = useHuntSubmissionDetail({
    participationId: participationId ?? null,
    stopId: currentStop?.id ?? null,
    userId: user?.id ?? null,
    enabled: !!currentStop && ['under_review', 'awaiting_proof', 'needs_resubmission', 'rejected'].includes(currentStop.progressStatus),
  });

  // ── Completion readiness (checked before Complete Hunt) ───────────────────────
  const { data: completionReadiness, refetch: refetchReadiness } =
    useHuntCompletionReadiness({
      participationId: participationId ?? null,
      userId: user?.id ?? null,
    });

  // ── Derived stop action ────────────────────────────────────────────────────────
  const stopAction = useMemo(() => {
    if (!currentStop) return null;
    return resolveStopAction({
      progressStatus:   currentStop.progressStatus,
      completionMethod: currentStop.completionMethod,
      locationValidated: validationResult.validated,
      proofDraftReady:  proofDraft.isReady,
      isCurrent:        true,
    });
  }, [currentStop, validationResult.validated, proofDraft.isReady]);

  const currentDrop = useMemo(
    () => dropZones.data?.find(zone => zone.dropId === currentStop?.id) ?? null,
    [dropZones.data, currentStop?.id],
  );

  // ── Hunt-level action ────────────────────────────────────────────────────────
  const huntLevelAction = useMemo(() =>
    resolveHuntLevelAction(
      hunt?.participationStatus ?? null,
      completionReadiness?.state ?? null,
      hunt?.completedStopCount ?? 0,
      hunt?.requiredStopCount ?? 0,
    ),
    [hunt, completionReadiness]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleStopActionPress = useCallback(() => {
    if (!stopAction || !currentStop) return;

    if (stopAction.opensLocationFlow) {
      setShowLocationPanel(true);
      validateLocation();
      return;
    }

    if (stopAction.opensProofFlow) {
      setShowProofDraft(true);
      return;
    }

    if (stopAction.callsCompleteStop && stopAction.requiresConfirmation) {
      setCompleteConfirmMsg(stopAction.confirmationMessage ?? 'Mark this stop as complete?');
      setShowCompleteConfirm(true);
      return;
    }

    if (stopAction.callsCompleteStop) {
      executeCompleteStop();
    }
  }, [stopAction, currentStop, validateLocation]);

  const executeCompleteStop = useCallback(async () => {
    if (!currentStop || !hunt || !user) return;
    setShowCompleteConfirm(false);

    try {
      const result = await completeStopMutation.mutateAsync({
        participationId: participationId!,
        stopId: currentStop.id,
        huntId: hunt.huntId,
        occurrenceId: hunt.occurrenceId,
        userId: user.id,
        validationMethod: currentStop.completionMethod,
      });

      if (!result.success) {
        Alert.alert('Could Not Complete Stop', result.userMessage || 'Please try again.');
        return;
      }

      // If hunt is now ready to complete, check readiness
      if (result.huntCompletionReady) {
        refetchReadiness();
      }
    } catch (err) {
      Alert.alert('Error', 'Could not mark stop as complete. Please try again.');
    }
  }, [currentStop, hunt, user, participationId, completeStopMutation, refetchReadiness]);

  const handleLocationValidated = useCallback(async () => {
    if (!validationResult.validated) return;

    // If location-only stop, proceed to complete directly
    if (currentStop?.completionMethod === 'location') {
      setShowLocationPanel(false);
      executeCompleteStop();
      return;
    }

    // For image_and_location: mark location as validated in draft
    proofDraft.setLocationValidated(true);
    setShowLocationPanel(false);
    setShowProofDraft(true);
  }, [validationResult.validated, currentStop?.completionMethod, proofDraft, executeCompleteStop]);

  const handleProofSubmit = useCallback(async () => {
    if (!currentStop || !hunt || !user || !proofDraft.isReady) return;

    proofDraft.setSubmitting(true);

    try {
      const result = await submitProofMutation.mutateAsync({
        participationId:     participationId!,
        stopId:              currentStop.id,
        huntId:              hunt.huntId,
        occurrenceId:        hunt.occurrenceId,
        userId:              user.id,
        submissionType:      currentStop.completionMethod,
        textResponse:        proofDraft.draft.textResponse || null,
        mediaIds:            proofDraft.uploadedMediaIds.length > 0 ? proofDraft.uploadedMediaIds : null,
        locationLat:         null, // location coordinates not transmitted
        locationLng:         null,
        locationAccuracy:    null,
        previousSubmissionId: proofDraft.draft.previousSubmissionId,
      });

      if (!result.success) {
        Alert.alert('Submission Error', result.userMessage || 'Could not submit proof. Please try again.');
        proofDraft.setSubmitting(false);
        return;
      }

      // Success — close modals and clear draft
      setShowProofReview(false);
      setShowProofDraft(false);
      proofDraft.clearDraft();
      refetch(); // Refresh hunt state

    } catch (err) {
      Alert.alert('Error', 'Could not submit proof. Please try again.');
      proofDraft.setSubmitting(false);
    }
  }, [currentStop, hunt, user, participationId, proofDraft, submitProofMutation, refetch]);

  const handleCompleteHunt = useCallback(async () => {
    if (!hunt || !user || !completionReadiness?.isReady) return;

    setIsCompletingHunt(true);
    setHuntCompleteError(null);

    try {
      const result = await completeHuntMutation.mutateAsync({
        participationId: participationId!,
        huntId:          hunt.huntId,
        occurrenceId:    hunt.occurrenceId,
        userId:          user.id,
      });

      if (!result.success) {
        setHuntCompleteError(result.userMessage || 'Could not complete hunt. Please try again.');
        setIsCompletingHunt(false);
        return;
      }

      // Success: navigate to completion screen
      router.replace(`/(main)/hunt-completion/${participationId}`);
    } catch (err) {
      setHuntCompleteError('Hunt completion temporarily unavailable. Please try again.');
      setIsCompletingHunt(false);
    }
  }, [hunt, user, participationId, completionReadiness, completeHuntMutation]);

  const handleWithdraw = useCallback(async () => {
    if (!hunt || !user) return;
    setIsWithdrawing(true);
    setWithdrawError(null);

    try {
      const result = await withdrawMutation.mutateAsync({
        participationId: participationId!,
        huntId:          hunt.huntId,
        occurrenceId:    hunt.occurrenceId,
        userId:          user.id,
      });

      if (!result.success) {
        setWithdrawError(result.userMessage || 'Could not withdraw. Please try again.');
        setIsWithdrawing(false);
        return;
      }

      setShowWithdrawal(false);
      // Hunt query will update to withdrawn status — handled by viewMode
    } catch (err) {
      setWithdrawError('Withdrawal temporarily unavailable. Please try again.');
      setIsWithdrawing(false);
    }
  }, [hunt, user, participationId, withdrawMutation]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  // ── Unordered stop list prep ───────────────────────────────────────────────

  const { availableStops, completedStops } = useMemo(() => {
    if (!hunt || !hunt.currentStops.length) return { availableStops: [], completedStops: [] };

    const avail = hunt.currentStops
      .filter(s => s.progressStatus !== 'completed')
      .map(s => ({
        stop:   s,
        action: resolveStopAction({
          progressStatus:    s.progressStatus,
          completionMethod:  s.completionMethod,
          locationValidated: s.id === currentStop?.id ? validationResult.validated : false,
          proofDraftReady:   false,
          isCurrent:         true,
        }),
      }));

    const done = hunt.currentStops
      .filter(s => s.progressStatus === 'completed')
      .map(s => ({
        stop:   s,
        action: resolveStopAction({
          progressStatus:    'completed',
          completionMethod:  s.completionMethod,
          locationValidated: false,
          proofDraftReady:   false,
          isCurrent:         false,
        }),
      }));

    return { availableStops: avail, completedStops: done };
  }, [hunt, currentStop, validationResult.validated]);

  const isOrdered = hunt?.isOrdered ?? false;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <ActiveHuntSkeleton />;
  }

  if (huntError || !hunt) {
    return <HuntStatusState mode="not_found" />;
  }

  // Terminal states — show status screen
  if (['withdrawn', 'removed', 'cancelled', 'expired', 'not_found', 'unauthorized'].includes(viewMode)) {
    return <HuntStatusState mode={viewMode} huntTitle={hunt?.huntTitle} />;
  }

  // Completion redirect is handled by useEffect above
  if (viewMode === 'completed') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.hunt} style={{ flex: 1 }} />
      </View>
    );
  }

  const stopNumber = isOrdered && currentStop
    ? (hunt.currentStops.findIndex(s => s.id === currentStop.id) + 1)
    : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      {/* Header */}
      <ActiveHuntHeader
        huntTitle={hunt.huntTitle}
        participationStatus={hunt.participationStatus}
        onWithdraw={() => setShowWithdrawal(true)}
        onViewDetails={() => router.push(`/(main)/hunt-detail/${hunt.huntId}`)}
        onSafetyInfo={() => Alert.alert('Safety', 'Stay aware of your surroundings. Never access private property. Trust your instincts.')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Deadline warning */}
        <HuntDeadlineNotice completionDeadline={hunt.completionDeadline} />

        {/* Current clue — dominant */}
        {currentStop ? (
          <CurrentCluePanel
            stop={currentStop}
            isOrdered={isOrdered}
            stopNumber={stopNumber}
            totalStops={hunt.currentStops.length}
          />
        ) : (
          <View style={[styles.noStop, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={32} color={colors.hunt} />
            <Text style={[styles.noStopTitle, { color: colors.foreground }]}>
              All Stops Completed
            </Text>
            <Text style={[styles.noStopBody, { color: colors.mutedForeground }]}>
              You're ready to complete the hunt!
            </Text>
          </View>
        )}

        {/* Canonical Drop collection is a separate online-only, server-authorized flow. */}
        {currentDrop && currentStop && (
          <DropSearchPanel
            zone={currentDrop}
            isCollecting={dropCollection.isPending}
            errorMessage={dropCollection.error?.message ?? null}
            onCollect={() => void dropCollection.collect(currentStop.id)}
          />
        )}

        {/* Location validation panel */}
        {showLocationPanel && currentStop && (
          <LocationValidationPanel
            result={validationResult}
            isAcquiring={isAcquiring}
            onRetry={() => {
              resetLocation();
              validateLocation();
            }}
            onOpenSettings={handleOpenSettings}
            onDismiss={() => {
              setShowLocationPanel(false);
              resetLocation();
            }}
          />
        )}

        {/* Validated → proceed action for location-and-image */}
        {validationResult.validated && currentStop?.completionMethod === 'image_and_location' && (
          <View style={[styles.validatedBanner, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
            <Feather name="check-circle" size={16} color="#10B981" />
            <Text style={styles.validatedText}>Location verified — now add your photo proof</Text>
          </View>
        )}

        {/* Submission status (under review / needs resubmission) */}
        {submissionDetail && currentStop && ['under_review', 'awaiting_proof', 'needs_resubmission', 'rejected'].includes(currentStop.progressStatus) && (
          <HuntSubmissionStatus
            submission={submissionDetail}
            stopTitle={currentStop.title}
            onResubmit={() => setShowProofDraft(true)}
          />
        )}

        {/* Progress summary */}
        <HuntProgressSummary
          completedRequired={hunt.completedStopCount}
          totalRequired={hunt.requiredStopCount}
          currentStops={hunt.currentStops}
          isOrdered={isOrdered}
        />

        {/* Primary stop action button */}
        {stopAction && !['completed', 'locked', 'expired'].includes(stopAction.actionType) && (
          <TouchableOpacity
            onPress={handleStopActionPress}
            disabled={!stopAction.isEnabled || completeStopMutation.isPending || submitProofMutation.isPending}
            style={[
              styles.primaryActionBtn,
              {
                backgroundColor: stopAction.isEnabled ? colors.hunt : colors.secondary,
                opacity: (!stopAction.isEnabled || completeStopMutation.isPending) ? 0.7 : 1,
              },
            ]}
            accessibilityLabel={stopAction.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: !stopAction.isEnabled }}
          >
            {(completeStopMutation.isPending || submitProofMutation.isPending) ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather
                  name={
                    stopAction.actionType === 'check_location' ? 'map-pin' :
                    stopAction.actionType === 'add_proof' || stopAction.actionType === 'submit_proof' ? 'upload' :
                    stopAction.actionType === 'resubmit_proof' ? 'refresh-cw' :
                    'check-circle'
                  }
                  size={18}
                  color={stopAction.isEnabled ? '#fff' : colors.mutedForeground}
                />
                <Text style={[
                  styles.primaryActionText,
                  { color: stopAction.isEnabled ? '#fff' : colors.mutedForeground },
                ]}>
                  {stopAction.label}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Disabled action reason */}
        {stopAction?.disabledReason && (
          <Text style={[styles.disabledReason, { color: colors.mutedForeground }]}>
            {stopAction.disabledReason}
          </Text>
        )}

        {/* Unordered: stop selector */}
        {!isOrdered && (availableStops.length > 0 || completedStops.length > 0) && (
          <UnorderedStopSelector
            availableStops={availableStops}
            completedStops={completedStops}
            onStopSelect={stop => setSelectedStopId(stop.id)}
            selectedStopId={currentStop?.id}
          />
        )}

        {/* Hunt completion button */}
        {huntLevelAction.actionType === 'complete_hunt' && (
          <View style={styles.huntCompleteSection}>
            <View style={[styles.readyBanner, { backgroundColor: colors.hunt + '12', borderColor: colors.hunt + '30' }]}>
              <Feather name="award" size={16} color={colors.hunt} />
              <Text style={[styles.readyText, { color: colors.hunt }]}>
                All required stops completed — ready to finish!
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCompleteHunt}
              disabled={isCompletingHunt}
              style={[styles.completeHuntBtn, { backgroundColor: colors.hunt, opacity: isCompletingHunt ? 0.7 : 1 }]}
              accessibilityLabel="Complete Hunt and claim reward"
            >
              {isCompletingHunt ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="award" size={18} color="#fff" />
                  <Text style={styles.completeHuntBtnText}>Complete Hunt</Text>
                </>
              )}
            </TouchableOpacity>
            {huntCompleteError && (
              <Text style={styles.huntCompleteError}>{huntCompleteError}</Text>
            )}
          </View>
        )}

        {/* Remaining stops for hunt-level progress hint */}
        {huntLevelAction.actionType === 'continue' && huntLevelAction.reasonText && (
          <Text style={[styles.continueHint, { color: colors.mutedForeground }]}>
            {huntLevelAction.reasonText}
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Stop completion confirmation */}
      <Modal
        visible={showCompleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompleteConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={32} color={colors.hunt} />
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>Complete Stop?</Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>{completeConfirmMsg}</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                onPress={() => setShowCompleteConfirm(false)}
                style={[styles.confirmBtn, styles.confirmCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.confirmCancelText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={executeCompleteStop}
                style={[styles.confirmBtn, styles.confirmOkBtn, { backgroundColor: colors.hunt }]}
              >
                {completeStopMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmOkText}>Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Proof draft modal */}
      <Modal
        visible={showProofDraft && !showProofReview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProofDraft(false)}
      >
        <View style={[styles.proofModal, { backgroundColor: colors.background }]}>
          <View style={[styles.proofModalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowProofDraft(false)}
              style={styles.proofModalClose}
              accessibilityLabel="Close proof draft"
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.proofModalTitle, { color: colors.foreground }]}>
              Add Proof
            </Text>
            <Text style={[styles.proofModalStop, { color: colors.mutedForeground }]} numberOfLines={1}>
              {currentStop?.title}
            </Text>
          </View>
          <ScrollView style={styles.proofModalScroll}
            contentContainerStyle={styles.proofModalContent}>
            {currentStop && (
              <HuntProofDraft
                draft={proofDraft.draft}
                onTextChange={proofDraft.setTextResponse}
                onAddImage={(uri, size) => proofDraft.addImage(uri, size)}
                onRemoveImage={proofDraft.removeImage}
                onRetryUpload={(_uri) => {
                  // Re-trigger upload for failed images
                  // (actual upload happens in useEffect when image added)
                }}
                locationValidated={proofDraft.draft.locationValidated}
              />
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
          {/* Review button */}
          <View style={[styles.proofModalFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {proofDraft.missingItems.length > 0 && (
              <View style={styles.missingItemsContainer}>
                {proofDraft.missingItems.slice(0, 2).map((msg, i) => (
                  <Text key={i} style={[styles.missingItem, { color: '#EF4444' }]}>• {msg}</Text>
                ))}
              </View>
            )}
            <TouchableOpacity
              onPress={() => setShowProofReview(true)}
              disabled={!proofDraft.isReady || proofDraft.hasUploadingImages}
              style={[styles.proofModalBtn, {
                backgroundColor: proofDraft.isReady && !proofDraft.hasUploadingImages ? colors.hunt : colors.secondary,
              }]}
              accessibilityLabel="Review proof before submitting"
            >
              <Text style={[styles.proofModalBtnText, {
                color: proofDraft.isReady && !proofDraft.hasUploadingImages ? '#fff' : colors.mutedForeground,
              }]}>
                {proofDraft.hasUploadingImages ? 'Uploading…' : 'Review Proof'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Proof review modal */}
      {currentStop && (
        <HuntProofReview
          visible={showProofReview}
          draft={proofDraft.draft}
          huntTitle={hunt.huntTitle}
          stopTitle={currentStop.title}
          isSubmitting={submitProofMutation.isPending || proofDraft.draft.isSubmitting}
          onSubmit={handleProofSubmit}
          onBack={() => setShowProofReview(false)}
        />
      )}

      {/* Withdrawal confirmation */}
      <WithdrawalConfirmation
        visible={showWithdrawal}
        huntTitle={hunt.huntTitle}
        isWithdrawing={isWithdrawing}
        errorMessage={withdrawError}
        onConfirm={handleWithdraw}
        onCancel={() => { setShowWithdrawal(false); setWithdrawError(null); }}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing[4],
    gap:     spacing[4],
  },

  noStop: {
    borderRadius: radius.xl,
    borderWidth:  1,
    padding:      spacing[6],
    alignItems:   'center',
    gap:          spacing[3],
  },
  noStopTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  noStopBody:  { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },

  validatedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: radius.md, borderWidth: 1, padding: spacing[3],
  },
  validatedText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: '#065F46' },

  primaryActionBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              spacing[2],
    paddingVertical:  spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius:     radius.xl,
    minHeight:        52,
  },
  primaryActionText: {
    fontFamily: fontFamily.bold,
    fontSize:   fontSize.base,
  },
  disabledReason: {
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.xs,
    textAlign:  'center',
  },

  huntCompleteSection: { gap: spacing[3] },
  readyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: radius.md, borderWidth: 1, padding: spacing[3],
  },
  readyText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  completeHuntBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[4], borderRadius: radius.xl, minHeight: 52,
  },
  completeHuntBtnText: { fontFamily: fontFamily.bold, fontSize: fontSize.base, color: '#fff' },
  huntCompleteError: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: '#EF4444', textAlign: 'center' },

  continueHint: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },

  // Confirmation modal
  confirmBackdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', padding: spacing[6],
  },
  confirmCard: {
    borderRadius: radius.xl, borderWidth: 1, padding: spacing[5],
    gap: spacing[4], alignItems: 'center', width: '100%', maxWidth: 320,
  },
  confirmTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  confirmBody:  { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  confirmBtns:  { flexDirection: 'row', gap: spacing[3], width: '100%' },
  confirmBtn:   { flex: 1, paddingVertical: spacing[3], borderRadius: radius.xl, alignItems: 'center' },
  confirmCancelBtn: { borderWidth: 1 },
  confirmCancelText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  confirmOkBtn:  {},
  confirmOkText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base, color: '#fff' },

  // Proof modal
  proofModal: { flex: 1 },
  proofModalHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: spacing[3], paddingHorizontal: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing[1],
  },
  proofModalClose: { alignSelf: 'flex-start', padding: spacing[1], marginBottom: spacing[1] },
  proofModalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  proofModalStop:  { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  proofModalScroll: { flex: 1 },
  proofModalContent: { padding: spacing[4] },
  proofModalFooter: {
    padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth, gap: spacing[2],
  },
  missingItemsContainer: { gap: 2 },
  missingItem: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  proofModalBtn: {
    paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: 'center',
  },
  proofModalBtnText: { fontFamily: fontFamily.bold, fontSize: fontSize.base },
});
