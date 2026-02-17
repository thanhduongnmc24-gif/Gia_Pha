import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://fkrhyhuactxbmvherqhg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrcmh5aHVhY3R4Ym12aGVycWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDE3MTYsImV4cCI6MjA4Njg3NzcxNn0.Ug2PJ04Y0CRHGBWYLPk6VAw_vem45J5qMzmAOdDeD6E';

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