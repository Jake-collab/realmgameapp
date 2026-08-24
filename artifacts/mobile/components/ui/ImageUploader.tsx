/**
 * ImageUploader
 *
 * Tap-to-upload image component. Displays the selected image or a
 * placeholder prompt. Enforces file type and size constraints.
 *
 * Used for: avatar upload, quest cover image, hunt cover image,
 *           clue image attachments, proof submission.
 *
 * Full implementation in the build step that introduces Supabase Storage
 * and expo-image-picker. This component stubs the UI shell.
 *
 * Usage:
 *   <ImageUploader
 *     label="Cover Image"
 *     aspectRatio={16 / 9}
 *     onImage={(uri) => setValue('coverUri', uri)}
 *   />
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import * as ImagePicker from 'expo-image-picker';

interface Props {
  label?: string;
  /** Width / height ratio. Default: 16/9 */
  aspectRatio?: number;
  currentUri?: string | null;
  onImage?: (uri: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** Proof must use the live camera; library remains the default for content uploads. */
  captureMode?: 'camera' | 'library';
  mediaType?: 'image' | 'video';
}

export default function ImageUploader({
  label,
  aspectRatio = 16 / 9,
  currentUri,
  onImage,
  onRemove,
  disabled = false,
  captureMode = 'library',
  mediaType = 'image',
}: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    setLoading(true);
    try {
      const permission = captureMode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          captureMode === 'camera'
            ? 'Allow camera access to capture live proof.'
            : 'Allow photo access to choose an image.'
        );
        return;
      }

      const options = {
        mediaTypes: mediaType === 'video'
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
        quality: 0.85 as const,
        allowsEditing: false,
      };
      const result = captureMode === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) onImage?.(result.assets[0].uri);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      {label && (
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
          accessibilityLabel={label ?? (captureMode === 'camera' ? 'Capture proof' : 'Upload image')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.area,
          {
            aspectRatio,
            backgroundColor: colors.muted,
            borderColor: colors.border,
            borderRadius: radius.lg,
            opacity: pressed ? 0.85 : disabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Feather name="image" size={28} color={colors.mutedForeground} />
            <Text style={[styles.prompt, { color: colors.mutedForeground }]}>
              {currentUri ? 'Tap to change' : captureMode === 'camera' ? 'Capture with camera' : 'Tap to upload'}
            </Text>
          </>
        )}
      </Pressable>

      {currentUri && onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityLabel="Remove image"
          accessibilityRole="button"
          style={styles.removeBtn}
        >
          <Feather name="x-circle" size={14} color={colors.destructive} />
          <Text style={[styles.removeText, { color: colors.destructive }]}>
            Remove
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[2],
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
  area: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  prompt: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
  },
  removeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
