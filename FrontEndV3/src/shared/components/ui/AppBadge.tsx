
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'promotion';

type AppBadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

const BADGE_COLORS = {
  primary: {
    background: '#EAF2FC',
    text: colors.primary,
  },
  success: {
    background: '#EAF6E4',
    text: colors.eco,
  },
  warning: {
    background: '#FFF4E5',
    text: colors.warning,
  },
  danger: {
    background: '#FEECEC',
    text: colors.danger,
  },
  neutral: {
    background: colors.surfaceMuted,
    text: colors.textSecondary,
  },
  promotion: {
    background: '#FFF0E5',
    text: colors.promotion,
  },
} as const;

export default function AppBadge({
  label,
  variant = 'neutral',
}: AppBadgeProps) {
  const palette = BADGE_COLORS[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.background },
      ]}
    >
      <Text style={[styles.label, { color: palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
