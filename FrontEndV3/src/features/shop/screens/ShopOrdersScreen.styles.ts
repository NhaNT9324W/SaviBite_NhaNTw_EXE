import { StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../../shared/theme';

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.section,
    gap: spacing.xxl,
  },
  center: {
    minHeight: 450,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.eco,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  mutedFlex: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
  },
  panel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  selectedShop: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 150,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tool: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 180,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  toolActive: {
    borderColor: colors.primary,
  },
  toolIcon: {
    width: 45,
    height: 45,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolName: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.text,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  currentTool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentToolText: {
    color: colors.eco,
    fontWeight: '700',
    fontSize: 12,
  },
  permissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    minHeight: 47,
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  filters: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  activeFilter: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 12,
  },
  activeFilterText: {
    color: colors.white,
  },
  orderList: {
    gap: spacing.md,
  },
  orderCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  smallLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  orderCode: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  orderStatus: {
    color: colors.eco,
    fontSize: 12,
    fontWeight: '700',
  },
  orderBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyOrders: {
    minHeight: 130,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
});

export default styles;
