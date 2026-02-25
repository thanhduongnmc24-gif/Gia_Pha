import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://vgoymfsyzdjgvhiddxum.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnb3ltZnN5emRqZ3ZoaWRkeHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTkzMzYsImV4cCI6MjA4NzU3NTMzNn0.dTNlfE759v6unNwUlJc_oN1DKDfroh6KAxm75KiuF0o';

// Tèo làm cái kho chứa thông minh: Nếu là Web/Server thì không gọi AsyncStorage để tránh lỗi
const ExpoStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoStorage, // Dùng kho chứa thông minh này
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});