import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native'; 
// Chú ý đường dẫn mới: ../../context
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  
  return (
    <View style={{flex: 1, backgroundColor: colors.bg}}>
      <Tabs screenOptions={{ 
          headerShown: false,
          tabBarStyle: { 
            backgroundColor: colors.card, 
            borderTopColor: colors.border,
            height: 60, 
            paddingBottom: 5 
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subText,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '500' }
        }}>
        
        <Tabs.Screen 
          name="index" 
          options={{ 
            title: 'Gia Phả', 
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "people" : "people-outline"} size={28} color={color} /> 
            ) 
          }} 
        />

        <Tabs.Screen 
          name="settings" 
          options={{ 
            title: 'Cài đặt', 
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "settings" : "settings-outline"} size={24} color={color} /> 
            ) 
          }} 
        />
      </Tabs>
    </View>
  );
}