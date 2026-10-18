import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthGuard } from '../hooks/useAuthGuard';

type AccessLevel = 'login' | 'admin';

/**
 * Presentation guard only. The BE must always authorize every API action.
 * Shop routes require login here; shop membership/role is checked by BE
 * and remains scoped to the requested shop.
 */
export function requireAccess<P extends object>(
  Screen: React.ComponentType<P>,
  level: AccessLevel,
): React.ComponentType<P> {
  function ProtectedScreen(props: P) {
    const auth = useAuthGuard(level === 'admin' ? 'ADMIN' : undefined);

    if (auth.loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#07549B" />
          <Text style={styles.text}>Äang kiá»ƒm tra phiÃªn Ä‘Äƒng nháº­p...</Text>
        </View>
      );
    }

    if (auth.needsLogin) {
      return <Redirect href="/login" />;
    }

    if (auth.forbidden) {
      return (
        <View style={styles.center}>
          <Text style={styles.heading}>KhÃ´ng cÃ³ quyá»n truy cáº­p</Text>
          <Text style={styles.text}>
            TÃ i khoáº£n hiá»‡n táº¡i khÃ´ng cÃ³ quyá»n má»Ÿ trang quáº£n trá»‹ nÃ y.
          </Text>
        </View>
      );
    }

    return <Screen {...props} />;
  }

  ProtectedScreen.displayName = `Protected(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return ProtectedScreen;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    minHeight: 360,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAFD',
  },
  heading: {
    fontSize: 22,
    color: '#182D49',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  text: {
    marginTop: 12,
    color: '#71839C',
    textAlign: 'center',
  },
});