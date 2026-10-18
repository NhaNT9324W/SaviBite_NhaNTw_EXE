import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppButton from './AppButton';
import { colors, radius, spacing } from '../../theme';

type StateKind = 'loading' | 'error' | 'empty';
type Props = {
  kind: StateKind;
  title?: string;
  description?: string | null;
  actionLabel?: string;
  onAction?: () => void;
};

const iconByKind: Record<Exclude<StateKind, 'loading'>, ComponentProps<typeof Ionicons>['name']> = {
  error: 'alert-circle-outline',
  empty: 'restaurant-outline',
};

export default function OfferFeedback({ kind, title, description, actionLabel, onAction }: Props) {
  return (
    <View style={styles.root} accessibilityRole="summary">
      {kind === 'loading' ? (
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Đang tải ưu đãi" />
      ) : (
        <Ionicons name={iconByKind[kind]} size={34} color={kind === 'error' ? colors.danger : colors.textMuted} />
      )}
      {title ? <Text style={[styles.title, kind === 'error' && styles.errorTitle]}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction && kind !== 'loading' ? (
        <AppButton title={actionLabel} variant="outline" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 210,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  errorTitle: { color: colors.danger },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 480,
    textAlign: 'center',
  },
});
