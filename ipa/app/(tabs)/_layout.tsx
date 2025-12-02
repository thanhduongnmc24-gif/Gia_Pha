import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext'; 
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';

export default function TabLayout() {
  const { colors } = useTheme();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const content = response.notification.request.content;
      const rawTitle = content.title || '';
      const bodyText = content.body || '';

      if (bodyText) {
        Speech.stop(); 
        
        // [QUAN TRỌNG] Lọc bỏ icon cái chuông (🔔) và khoảng trắng thừa
        const cleanTitle = rawTitle.replace(/🔔/g, '').trim();

        // [SỬA] Câu thoại ngắn gọn: "Nhắc nhở: [Tiêu đề]. [Nội dung]"
        const textToSpeak = `Nhắc nhở: ${cleanTitle}. ${bodyText}`;
        
        Speech.speak(textToSpeak, {
          language: 'vi-VN',
          pitch: 1.0,
          rate: 1.1, // [SỬA] Tốc độ đọc nhanh hơn (1.1)
        });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <Tabs screenOptions={{ 
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 10 }
      }}>
      
      <Tabs.Screen name="index" options={{ title: 'Lịch', tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> }} />
      
      <Tabs.Screen name="notes" options={{ title: 'Ghi chú', tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} /> }} />
      
      <Tabs.Screen name="media" options={{ title: 'Media', tabBarIcon: ({ color }) => <Ionicons name="images" size={24} color={color} /> }} />

      <Tabs.Screen name="reminders" options={{ title: 'Nhắc nhở', tabBarIcon: ({ color }) => <Ionicons name="alarm" size={24} color={color} /> }} />

      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} />
      
    </Tabs>
  );
}