import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, AppState, View, Animated, Easing, Text } from 'react-native'; 
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

// [CHỈNH SỬA CHO ĐÚNG THƯ MỤC CỦA ANH]
import { useTheme } from '../context/ThemeContext'; // Lùi 1 cấp để ra thư mục app
import { supabase } from '../supabaseConfig';        // Lùi 1 cấp để lấy file config

export default function TabLayout() {
  const { colors } = useTheme();
  const appState = useRef(AppState.currentState);

  // --- STATE CHO INDICATOR (ĐÁM MÂY) ---
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const spinValue = useRef(new Animated.Value(0)).current;

  // --- HIỆU ỨNG XOAY VÒNG ---
  useEffect(() => {
    if (syncStatus === 'syncing') {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0); // Reset khi xong
    }
  }, [syncStatus]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // --- HÀM SAO LƯU (CÓ CẬP NHẬT TRẠNG THÁI) ---
  const performAutoBackup = async (triggerType: 'background' | 'foreground') => {
    try {
      // 1. Kiểm tra đăng nhập
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // Chưa đăng nhập thì không làm gì

      // 2. Bắt đầu hiệu ứng
      setSyncStatus('syncing');
      console.log(`AutoBackup (${triggerType}): Đang chạy...`);

      // 3. Gom dữ liệu
      const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY'];
      const stores = await AsyncStorage.multiGet(keys);
      
      const dataToSave: any = {};
      stores.forEach((store) => {
         if (store[1]) {
             try { dataToSave[store[0]] = JSON.parse(store[1]); } 
             catch { dataToSave[store[0]] = store[1]; }
         }
      });

      // 4. Đẩy lên Supabase
      const { error } = await supabase
        .from('user_sync')
        .upsert({ 
            user_id: session.user.id, 
            backup_data: dataToSave,
            updated_at: new Date()
        });

      if (error) throw error;

      // 5. Thành công -> Xanh lá
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000); // Ẩn sau 3s

    } catch (error) {
      console.log("AutoBackup Lỗi:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // --- LẮNG NGHE TRẠNG THÁI APP (FOREGROUND / BACKGROUND) ---
  useEffect(() => {
    // Chạy 1 lần khi mở app
    performAutoBackup('foreground');

    const subscription = AppState.addEventListener('change', nextAppState => {
      // Nếu app chuyển từ đang dùng -> xuống background (ẩn app/thoát ra home)
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        performAutoBackup('background');
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // --- XỬ LÝ THÔNG BÁO & GIỌNG NÓI ---
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const content = response.notification.request.content;
      const rawTitle = content.title || '';
      const bodyText = content.body || '';

      if (bodyText) {
        Speech.stop(); 
        const cleanTitle = rawTitle.replace(/🔔/g, '').trim();
        Speech.speak(`Nhắc nhở: ${cleanTitle}. ${bodyText}`, { language: 'vi-VN', rate: 1.1 });
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{flex: 1, backgroundColor: colors.bg}}>
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

      {/* --- PHẦN UI CỦA SYNC INDICATOR --- */}
      {syncStatus !== 'idle' && (
        <View style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 50 : 40, // Vị trí trên cùng, né tai thỏ
            right: 15,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            // Đổ bóng cho đẹp
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 3.84,
            elevation: 5,
            zIndex: 9999 // Đảm bảo luôn nằm trên cùng
        }}>
           {syncStatus === 'syncing' && (
             <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="sync" size={16} color={colors.primary} />
             </Animated.View>
           )}
           {syncStatus === 'success' && <Ionicons name="cloud-done" size={18} color="#22C55E" />}
           {syncStatus === 'error' && <Ionicons name="cloud-offline" size={18} color="#EF4444" />}

           <Text style={{
               marginLeft: 8, 
               fontSize: 11, 
               fontWeight: 'bold', 
               color: syncStatus === 'error' ? '#EF4444' : (syncStatus === 'success' ? '#22C55E' : colors.subText)
           }}>
             {syncStatus === 'syncing' ? 'Đang lưu...' : (syncStatus === 'success' ? 'Đã lưu' : 'Lỗi mạng')}
           </Text>
        </View>
      )}
    </View>
  );
}