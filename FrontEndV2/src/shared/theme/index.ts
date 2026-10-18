import { colors } from './colors';
import { layout } from './layout';
import { radius, spacing } from './spacing';
import { typography } from './typography';

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  layout,
} as const;

export { colors, layout, radius, spacing, typography };
