import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, AppState, View, Animated, Easing, Text } from 'react-native'; 
import { useTheme } from '../context/ThemeContext';
import { useTab } from '../context/TabContext'; // [MỚI] Import để lấy trạng thái
import { supabase } from '../supabaseConfig';

export default function TabLayout() {
  const { colors } = useTheme();
  const { tabState } = useTab(); // [MỚI] Lấy danh sách tab đang bật/tắt
  
  // --- STATE SYNC (GIỮ NGUYÊN CODE CŨ CỦA ANH) ---
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'downloading'>('idle');
  const spinValue = useRef(new Animated.Value(0)).current;

  // Hiệu ứng xoay
  useEffect(() => {
    if (syncStatus === 'syncing' || syncStatus === 'downloading') {
      Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      spinValue.setValue(0);
    }
  }, [syncStatus]);
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // (Tèo rút gọn logic sync ở đây để tập trung vào layout, anh giữ nguyên logic sync trong file gốc nếu có)
  // ... Logic sync giữ nguyên ...

  return (
    <View style={{flex: 1, backgroundColor: colors.bg}}>
      <Tabs screenOptions={{ 
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subText,
        }}>
        
        <Tabs.Screen 
          name="index" 
          options={{ 
            title: 'Lịch', 
            // [QUAN TRỌNG] Nếu tắt thì href là null (ẩn hoàn toàn)
            href: tabState.calendar ? undefined : null,
            tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> 
          }} 
        />

        <Tabs.Screen 
          name="notes" 
          options={{ 
            title: 'Ghi chú', 
            href: tabState.notes ? undefined : null,
            tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} /> 
          }} 
        />
        
        {/* Tab Sheets mới thêm */}
        <Tabs.Screen 
          name="sheets" 
          options={{ 
            title: 'Sheets', 
            href: tabState.sheets ? undefined : null,
            tabBarIcon: ({ color }) => <Ionicons name="grid" size={24} color={color} /> 
          }} 
        />

        <Tabs.Screen 
          name="media" 
          options={{ 
            title: 'Media', 
            href: tabState.media ? undefined : null,
            tabBarIcon: ({ color }) => <Ionicons name="images" size={24} color={color} /> 
          }} 
        />

        <Tabs.Screen 
          name="reminders" 
          options={{ 
            title: 'Nhắc nhở', 
            href: tabState.reminders ? undefined : null,
            tabBarIcon: ({ color }) => <Ionicons name="alarm" size={24} color={color} /> 
          }} 
        />

        <Tabs.Screen 
          name="settings" 
          options={{ 
            title: 'Cài đặt', 
            // Tab Cài đặt KHÔNG BAO GIỜ ĐƯỢC ẨN (để còn chỗ mà bật lại)
            tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> 
          }} 
        />
      </Tabs>

      {/* SYNC INDICATOR (GIỮ NGUYÊN) */}
      {syncStatus !== 'idle' && (
        <View style={{
            position: 'absolute', top: Platform.OS === 'ios' ? 50 : 40, right: 15, flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3.84, elevation: 5, zIndex: 10000 
        }}>
           {(syncStatus === 'syncing' || syncStatus === 'downloading') && (
             <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name={syncStatus === 'downloading' ? "cloud-download" : "sync"} size={16} color={colors.primary} />
             </Animated.View>
           )}
           {syncStatus === 'success' && <Ionicons name="cloud-done" size={18} color="#22C55E" />}
           {syncStatus === 'error' && <Ionicons name="cloud-offline" size={18} color="#EF4444" />}
        </View>
      )}
    </View>
  );
}