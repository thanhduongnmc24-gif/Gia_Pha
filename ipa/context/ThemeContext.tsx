import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Định nghĩa bảng màu
const themes = {
  light: {
    theme: 'light',
    bg: '#F8FAFC',        // Slate 50 (Sáng sủa, mát mắt)
    card: '#FFFFFF',      // Trắng tinh
    text: '#0F172A',      // Slate 900 (Đen xanh, dễ đọc)
    subText: '#64748B',   // Slate 500
    border: '#E2E8F0',    // Slate 200
    primary: '#0284C7',   // Sky 600 (Xanh dương đậm đà)
    iconBg: '#F1F5F9',    // Slate 100
    success: '#10B981',   
    error: '#EF4444',     
    inputBg: '#F1F5F9'    
  },
  dark: {
    theme: 'dark',
    // --- MÀU MỚI: TÔNG SLATE (XANH ĐEN) DỊU MẮT ---
    bg: '#0F172A',        // Slate 900 (Nền tối thẫm, không đen kịt)
    card: '#1E293B',      // Slate 800 (Thẻ sáng hơn nền chút)
    text: '#F1F5F9',      // Slate 100 (Chữ trắng đục)
    subText: '#94A3B8',   // Slate 400 (Chữ phụ xám xanh)
    border: '#334155',    // Slate 700 (Viền nhẹ)
    primary: '#38BDF8',   // Sky 400 (Xanh dương sáng, nổi trên nền tối)
    iconBg: '#1E293B',    // Trùng màu card
    success: '#34D399',   
    error: '#F87171',     
    inputBg: '#1E293B'    
  },
};

type ThemeContextType = {
  theme: 'light' | 'dark';
  colors: typeof themes.light;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
};

// @ts-ignore
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: themes.light,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem('APP_THEME').then(savedTheme => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
      }
    });
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    await AsyncStorage.setItem('APP_THEME', newTheme);
  };

  const setTheme = async (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('APP_THEME', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themes[theme], toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);