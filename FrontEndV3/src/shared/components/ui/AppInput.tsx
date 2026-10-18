
import React, { forwardRef } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
} from 'react-native';

import {
    colors,
    radius,
    spacing,
    typography,
} from '../../theme';

type AppInputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

// Lấy chính xác kiểu ref từ TextInput của React Native.
// Tương thích với kiểu TextInput instance của Expo SDK 58.
type InputRef = React.ComponentRef<typeof TextInput>;

const AppInput = forwardRef<InputRef, AppInputProps>(
  (
    {
      label,
      error,
      hint,
      required = false,
      style,
      editable = true,
      ...props
    },
    ref,
  ) => {
    return (
      <View style={styles.container}>
        {label && (
          <Text style={styles.label}>
            {label}

            {required && (
              <Text style={styles.required}> *</Text>
            )}
          </Text>
        )}

        <TextInput
          ref={ref}
          {...props}
          editable={editable}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={
            props.accessibilityLabel ?? label
          }
          style={[
            styles.input,
            Boolean(error) && styles.inputError,
            !editable && styles.inputDisabled,
            style,
          ]}
        />

        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : hint ? (
          <Text style={styles.hint}>
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);

AppInput.displayName = 'AppInput';

export default AppInput;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.sm,
  },

  label: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },

  required: {
    color: colors.danger,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text,
  },

  inputError: {
    borderColor: colors.danger,
  },

  inputDisabled: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary,
  },

  error: {
    fontSize: typography.fontSize.xs,
    color: colors.danger,
  },

  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});
