
import React from 'react';
import {
    Pressable,
    StyleSheet,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../../theme';

type AppCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const CARD_PADDING = {
  none: 0,
  sm: spacing.md,
  md: spacing.base,
  lg: spacing.xl,
} as const;

export default function AppCard({
  children,
  onPress,
  padding = 'md',
  style,
}: AppCardProps) {
  const cardStyle = [
    styles.card,
    { padding: CARD_PADDING[padding] },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
  },
});
