
import { StyleSheet, Text, View } from 'react-native';

import { APP_CONFIG } from '../../../config/app.config';
import { colors, spacing } from '../../theme';
import ScreenContainer from './ScreenContainer';

export default function WebFooter() {
  return (
    <View style={styles.footer}>
      <ScreenContainer style={styles.container}>
        <View style={styles.brandSection}>
          <Text style={styles.brand}>
            {APP_CONFIG.brand.name}
          </Text>

          <Text style={styles.description}>
            {APP_CONFIG.footer.description}
          </Text>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.copyright}>
            {APP_CONFIG.footer.copyright}
          </Text>

          <Text style={styles.slogan}>
            {APP_CONFIG.brand.slogan}
          </Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  container: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  brandSection: {
    maxWidth: 360,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 23,
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copyright: {
    color: colors.textMuted,
    fontSize: 13,
  },
  slogan: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
