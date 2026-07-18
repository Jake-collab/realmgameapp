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

interface Props {
  label?: string;
  /** Width / height ratio. Default: 16/9 */
  aspectRatio?: number;
  currentUri?: string | null;
  onImage?: (uri: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export default function ImageUploader({
  label,
  aspectRatio = 16 / 9,
  currentUri,
  onImage,
  onRemove,
  disabled = false,
}: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    // TODO (Build — Storage step): Integrate expo-image-picker here.
    // 1. Request camera roll permissions via expo-media-library
    // 2. Launch ImagePicker.launchImageLibraryAsync with { mediaTypes: 'images', quality: 0.85 }
    // 3. Call onImage(result.assets[0].uri)
    Alert.alert(
      'Image upload',
      'Image picker will be wired up in the Storage build step.'
    );
  }

  return (
    <View style={styles.root}>
      {label && (
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityLabel={label ?? 'Upload image'}
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
              {currentUri ? 'Tap to change' : 'Tap to upload'}
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
