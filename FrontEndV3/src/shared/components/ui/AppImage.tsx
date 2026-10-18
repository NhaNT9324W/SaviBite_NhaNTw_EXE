
import { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    View,
    type ImageSourcePropType,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { colors, radius } from '../../theme';

type AppImageProps = {
  source?: ImageSourcePropType | null;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AppImage({
  source,
  height = 180,
  borderRadius = radius.md,
  style,
}: AppImageProps) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const imageKey =
    typeof source === 'number'
      ? String(source)
      : source && 'uri' in source
        ? source.uri ?? ''
        : '';

  const showPlaceholder = !source || failed;

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius },
        style,
      ]}
    >
      {showPlaceholder ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            SaviBite
          </Text>
        </View>
      ) : (
        <Image
          key={imageKey}
          source={source}
          resizeMode="cover"
          style={styles.image}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
        />
      )}

      {loading && !showPlaceholder && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
 loadingOverlay: {
  ...StyleSheet.absoluteFill,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surfaceMuted,
},
});
