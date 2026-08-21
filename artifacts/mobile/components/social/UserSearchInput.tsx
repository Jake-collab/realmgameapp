/**
 * UserSearchInput — debounced username search bar.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { SEARCH_DEBOUNCE_MS } from '@/features/social/constants/social.constants';

interface UserSearchInputProps {
  onQueryChange: (query: string) => void;
  placeholder?: string;
}

export function UserSearchInput({ onQueryChange, placeholder = 'Search by username…' }: UserSearchInputProps) {
  const colors = useColors();
  const [value, setValue] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onQueryChange(value), SEARCH_DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Feather name="search" size={16} color={colors.mutedForeground} />
      <TextInput
        style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.regular }]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search people by username"
        accessibilityHint="Type at least 2 characters to search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => { setValue(''); onQueryChange(''); }} accessibilityLabel="Clear search">
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: fontSize.base, height: 24 },
});
