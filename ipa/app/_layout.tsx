import { Stack } from 'expo-router';
import { ThemeProvider } from './context/ThemeContext';
import { TabProvider } from './context/TabContext'; // Import cái kho quản lý Tab

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TabProvider> {/* Bọc thêm ông thần này để cả app hiểu lệnh bật tắt */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </TabProvider>
    </ThemeProvider>
  );
}