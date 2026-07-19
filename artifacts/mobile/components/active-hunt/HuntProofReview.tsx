/**
 * HuntProofReview — Worlds (Prompt 13)
 *
 * Pre-submission review screen. Shows a summary of:
 *   - Hunt + stop title
 *   - Text evidence (truncated preview)
 *   - Image thumbnails
 *   - Location verified status
 *   - Submission warning
 *   - Submit Proof button
 *
 * Rules:
 * - No hidden geometry shown
 * - No raw coordinates
 * - Submitted proof is immutable — resubmission goes through a separate flow
 * - Double-tap prevention via disabled/loading state
 */

import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ProofDraftState } from '@/features/active-hunt/types/activeHunt.types';

interface HuntProofReviewProps {
  visible:       boolean;
  draft:         ProofDraftState;
  huntTitle:     string;
  stopTitle:     string;
  isSubmitting:  boolean;
  onSubmit:      () => void;
  onBack:        () => void;
}

export function HuntProofReview({
  visible,
  draft,
  huntTitle,
  stopTitle,
  isSubmitting,
  onSubmit,
  onBack,
}: HuntProofReviewProps) {
  const colors = useColors();

  const hasText     = !!draft.textResponse.trim();
  const hasImages   = draft.images.length > 0;
  const isLocVerified = draft.locationValidated;
  const uploadedImages = draft.images.filter(img => img.mediaId !== null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onBack}
    >
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onBack}
            disabled={isSubmitting}
            style={styles.backBtn}
            accessibilityLabel="Back to proof draft"
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Review Proof</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hunt + Stop */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{huntTitle}</Text>
            <Text style={[styles.stopTitle, { color: colors.foreground }]}>{stopTitle}</Text>
          </View>

          {/* Text evidence */}
          {hasText && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Feather name="align-left" size={14} color={colors.mutedForeground} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Written Answer</Text>
              </View>
              <Text style={[styles.textPreview, { color: colors.foreground }]}>
                {draft.textResponse}
              </Text>
            </View>
          )}

          {/* Image evidence */}
          {hasImages && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Feather name="image" size={14} color={colors.mutedForeground} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {uploadedImages.length} Photo{uploadedImages.length !== 1 ? 's' : ''}
                  {uploadedImages.length < draft.images.length && ' (some uploading…)'}
                </Text>
              </View>
              <View style={styles.imageRow}>
                {draft.images.map(img => (
                  <View key={img.localUri} style={[styles.thumb, { borderColor: colors.border }]}>
                    <Image
                      source={{ uri: img.localUri }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                      accessibilityLabel="Proof photo"
                    />
                    {img.mediaId && (
                      <View style={styles.uploadedBadge}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                    {img.uploadState === 'uploading' && (
                      <View style={styles.uploadingOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Location */}
          {isLocVerified && (
            <View style={[styles.card, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
              <View style={styles.cardHeader}>
                <Feather name="check-circle" size={14} color="#10B981" />
                <Text style={[styles.cardTitle, { color: '#065F46' }]}>Location Verified</Text>
              </View>
            </View>
          )}

          {/* Warning */}
          <View style={[styles.warning, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Feather name="info" size={14} color="#D97706" />
            <Text style={styles.warningText}>
              After submission, your proof may require review before this stop is completed.
              Submitted proof cannot be edited — only resubmitted if review requires it.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={onBack}
            disabled={isSubmitting}
            style={[styles.footerBtn, styles.ghostBtn, { borderColor: colors.border }]}
            accessibilityLabel="Go back to edit proof"
          >
            <Text style={[styles.ghostBtnText, { color: colors.foreground }]}>Edit Proof</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isSubmitting}
            style={[styles.footerBtn, styles.submitBtn, {
              backgroundColor: isSubmitting ? colors.hunt + '80' : colors.hunt,
            }]}
            accessibilityLabel="Submit proof"
            accessibilityRole="button"
            accessibilityState={{ busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Proof</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: 52, paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  scroll:     { flex: 1 },
  scrollContent: { padding: spacing[4], gap: spacing[4] },
  card: {
    borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardTitle:  { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  metaLabel:  { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  stopTitle:  { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  textPreview: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 22 },
  imageRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  thumb: {
    width: 80, height: 80, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  uploadedBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: '#10B981', borderRadius: radius.full, padding: 2,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    borderRadius: radius.md, borderWidth: 1, padding: spacing[3],
  },
  warningText: {
    flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm,
    color: '#92400E', lineHeight: 20,
  },
  footer: {
    flexDirection: 'row', gap: spacing[3], padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn:  { flex: 1, paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: 'center' },
  ghostBtn:   { borderWidth: 1 },
  ghostBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  submitBtn:  {},
  submitBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base, color: '#fff' },
});
