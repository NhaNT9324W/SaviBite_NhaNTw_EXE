
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    ViewStyle,
} from 'react-native';

import {
    colors,
    radius,
    spacing,
    typography,
} from '../../theme';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

type ButtonSize = 'sm' | 'md' | 'lg';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const BUTTON_COLORS = {
  primary: {
    background: colors.primary,
    text: colors.white,
    border: colors.primary,
  },
  secondary: {
    background: colors.surfaceMuted,
    text: colors.text,
    border: colors.surfaceMuted,
  },
  outline: {
    background: colors.surface,
    text: colors.primary,
    border: colors.border,
  },
  ghost: {
    background: 'transparent',
    text: colors.primary,
    border: 'transparent',
  },
  danger: {
    background: colors.danger,
    text: colors.white,
    border: colors.danger,
  },
} as const;

const BUTTON_HEIGHT = {
  sm: 36,
  md: 44,
  lg: 50,
} as const;

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: AppButtonProps) {
  const palette = BUTTON_COLORS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        disabled: inactive,
        busy: loading,
      }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: BUTTON_HEIGHT[size],
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={palette.text}
        />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: palette.text,
              fontSize:
                size === 'sm'
                  ? typography.fontSize.sm
                  : typography.fontSize.base,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
