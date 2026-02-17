// ipa/app/_layout.tsx
import { Stack } from 'expo-router';
import { ThemeProvider } from '../context/ThemeContext';
import { TabProvider } from '../context/TabContext';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseConfig';
import Auth from './auth'; 
import { View, ActivityIndicator } from 'react-native';

// [MỚI] Import thư viện quản lý phông chữ và Icon
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // [MỚI] Lệnh tải Font Icon (Trị bệnh timeout)
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    // Kiểm tra đăng nhập
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // [Quan Trọng] Nếu chưa tải xong Font HOẶC chưa kiểm tra xong Session -> Hiện vòng xoay
  if (!fontsLoaded || loadingSession) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <TabProvider>
        {session && session.user ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        ) : (
          <Auth />
        )}
      </TabProvider>
    </ThemeProvider>
  );
}