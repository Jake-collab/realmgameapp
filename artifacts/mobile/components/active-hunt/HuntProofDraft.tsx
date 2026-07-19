/**
 * HuntProofDraft — Worlds (Prompt 13)
 *
 * Proof composition interface for a hunt stop.
 * Adapts to the stop's completionMethod:
 *   text             → TextInput only
 *   image            → Image picker only
 *   text_and_image   → Both
 *   image_and_location → Image + location verified badge
 *   location         → Location check only (see LocationValidationPanel)
 *
 * Rules:
 * - Plain text only — no HTML
 * - Images NOT made public
 * - Camera permission only after explicit camera action
 * - Draft preserved until explicit clear or confirmed submission
 * - Upload state tracked per image
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ProofDraftState, ProofImageItem } from '@/features/active-hunt/types/activeHunt.types';
import type { StopCompletionMethod } from '@/features/hunts/types/hunt.types';

interface HuntProofDraftProps {
  draft: ProofDraftState;
  onTextChange:       (text: string) => void;
  onAddImage:         (localUri: string, fileSize?: number) => void;
  onRemoveImage:      (localUri: string) => void;
  onRetryUpload:      (localUri: string) => void;
  locationValidated:  boolean;
}

export function HuntProofDraft({
  draft,
  onTextChange,
  onAddImage,
  onRemoveImage,
  onRetryUpload,
  locationValidated,
}: HuntProofDraftProps) {
  const colors = useColors();
  const { completionMethod, textResponse, images, maxImages } = draft;

  const needsText   = ['text', 'text_and_image'].includes(completionMethod);
  const needsImage  = ['image', 'image_and_location', 'text_and_image'].includes(completionMethod);
  const needsLocation = ['location', 'image_and_location'].includes(completionMethod);

  const remainingChars = draft.textMaxLength - textResponse.length;
  const charColor = remainingChars < 50
    ? '#EF4444'
    : remainingChars < 100
    ? '#F59E0B'
    : colors.mutedForeground;

  const handlePickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow access to your photo library to add proof images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onAddImage(asset.uri, asset.fileSize ?? undefined);
    }
  }, [onAddImage]);

  const handleCameraCapture = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow camera access to capture proof.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onAddImage(asset.uri, asset.fileSize ?? undefined);
    }
  }, [onAddImage]);

  return (
    <View style={styles.container}>

      {/* Text proof */}
      {needsText && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Your Answer</Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            value={textResponse}
            onChangeText={onTextChange}
            placeholder="Describe what you found…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={draft.textMaxLength}
            accessibilityLabel="Proof text input"
            autoCapitalize="sentences"
            autoCorrect
          />
          <View style={styles.charRow}>
            <Text style={[styles.charHint, { color: colors.mutedForeground }]}>
              Min {draft.textMinLength} characters
            </Text>
            <Text style={[styles.charCount, { color: charColor }]}>
              {textResponse.length} / {draft.textMaxLength}
            </Text>
          </View>
          {textResponse.length > 0 && textResponse.length < draft.textMinLength && (
            <Text style={styles.charError}>
              {draft.textMinLength - textResponse.length} more character{draft.textMinLength - textResponse.length !== 1 ? 's' : ''} needed
            </Text>
          )}
        </View>
      )}

      {/* Image proof */}
      {needsImage && (
        <View style={styles.section}>
          <View style={styles.imageLabelRow}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Photo Evidence
            </Text>
            <Text style={[styles.imageCount, { color: colors.mutedForeground }]}>
              {images.length} / {maxImages}
            </Text>
          </View>

          {/* Image grid */}
          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map(img => (
                <ImageTile
                  key={img.localUri}
                  item={img}
                  onRemove={() => onRemoveImage(img.localUri)}
                  onRetry={() => onRetryUpload(img.localUri)}
                  colors={colors}
                />
              ))}
            </View>
          )}

          {/* Add image buttons */}
          {images.length < maxImages && (
            <View style={styles.addBtns}>
              <TouchableOpacity
                onPress={handlePickImage}
                style={[styles.addBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityLabel="Choose photo from library"
              >
                <Feather name="image" size={18} color={colors.foreground} />
                <Text style={[styles.addBtnText, { color: colors.foreground }]}>Photo Library</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCameraCapture}
                style={[styles.addBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityLabel="Take a photo with camera"
              >
                <Feather name="camera" size={18} color={colors.foreground} />
                <Text style={[styles.addBtnText, { color: colors.foreground }]}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Photos remain private and are never shared publicly.
          </Text>
        </View>
      )}

      {/* Location verification badge */}
      {needsLocation && (
        <View style={[
          styles.locationBadge,
          { backgroundColor: locationValidated ? '#D1FAE5' : colors.card, borderColor: locationValidated ? '#A7F3D0' : colors.border },
        ]}>
          <Feather
            name={locationValidated ? 'check-circle' : 'map-pin'}
            size={16}
            color={locationValidated ? '#10B981' : colors.mutedForeground}
          />
          <Text style={[styles.locationText, { color: locationValidated ? '#065F46' : colors.mutedForeground }]}>
            {locationValidated ? 'Location verified' : 'Location verification required'}
          </Text>
        </View>
      )}
    </View>
  );
}

function ImageTile({
  item, onRemove, onRetry, colors,
}: {
  item: ProofImageItem;
  onRemove: () => void;
  onRetry: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.tile, { borderColor: item.uploadState === 'error' ? '#EF4444' : colors.border }]}>
      <Image
        source={{ uri: item.localUri }}
        style={styles.tileImage}
        resizeMode="cover"
        accessibilityLabel="Proof image"
      />
      {item.uploadState === 'uploading' && (
        <View style={styles.tileOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      {item.uploadState === 'error' && (
        <TouchableOpacity style={styles.tileOverlay} onPress={onRetry} accessibilityLabel="Retry upload">
          <Feather name="refresh-cw" size={20} color="#fff" />
          <Text style={styles.tileRetryText}>Retry</Text>
        </TouchableOpacity>
      )}
      {item.uploadState !== 'uploading' && (
        <TouchableOpacity
          style={styles.tileRemove}
          onPress={onRemove}
          accessibilityLabel="Remove photo"
        >
          <Feather name="x" size={14} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const TILE_SIZE = 100;
const styles = StyleSheet.create({
  container:     { gap: spacing[4] },
  section:       { gap: spacing[2] },
  sectionLabel:  { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  textInput: {
    borderWidth:   1,
    borderRadius:  radius.lg,
    padding:       spacing[3],
    minHeight:     120,
    fontFamily:    fontFamily.regular,
    fontSize:      fontSize.base,
    lineHeight:    22,
    textAlignVertical: 'top',
  },
  charRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  charHint:  { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  charCount: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
  charError: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: '#EF4444' },
  imageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageCount:    { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  imageGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    width: TILE_SIZE, height: TILE_SIZE,
    borderRadius: radius.md, borderWidth: 1, overflow: 'hidden',
  },
  tileImage:   { width: '100%', height: '100%' },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  tileRetryText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: '#fff' },
  tileRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.full, padding: 3,
  },
  addBtns: { flexDirection: 'row', gap: spacing[3] },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1,
  },
  addBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.md, borderWidth: 1,
  },
  locationText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
