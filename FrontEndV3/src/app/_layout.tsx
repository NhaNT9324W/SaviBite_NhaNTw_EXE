
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../features/auth/context/AuthProvider';
import { CartProvider } from '../features/cart/context/CartProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CartProvider>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </AuthProvider>
      </CartProvider>
    </SafeAreaProvider>
  );
}
