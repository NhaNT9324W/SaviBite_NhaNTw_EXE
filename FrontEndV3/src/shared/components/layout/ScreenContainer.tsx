
import React from 'react';
import {
    StyleSheet,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { layout } from '../../theme';

type ScreenContainerProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fluid?: boolean;
};

export default function ScreenContainer({
  children,
  style,
  fluid = false,
}: ScreenContainerProps) {
  const { width } = useWindowDimensions();

  const isDesktop = width >= layout.breakpoint.desktop;

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: fluid
            ? undefined
            : layout.maxContentWidth,
          paddingHorizontal: isDesktop
            ? layout.pagePaddingDesktop
            : layout.pagePaddingMobile,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
