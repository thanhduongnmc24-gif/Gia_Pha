import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Định nghĩa các Tab có thể tắt/bật (Trừ tab Cài đặt ra nhé)
type TabState = {
  calendar: boolean; // Tab Lịch (index)
  notes: boolean;    // Tab Ghi chú
  sheets: boolean;   // Tab Trang tính
  media: boolean;    // Tab Media
  reminders: boolean;// Tab Nhắc nhở
};

type TabContextType = {
  tabState: TabState;
  toggleTab: (key: keyof TabState) => void;
};

const TabContext = createContext<TabContextType>({
  tabState: { calendar: true, notes: true, sheets: true, media: true, reminders: true },
  toggleTab: () => {},
});

export const TabProvider = ({ children }: { children: React.ReactNode }) => {
  // Mặc định là hiện tất cả (true)
  const [tabState, setTabState] = useState<TabState>({
    calendar: true,
    notes: true,
    sheets: true,
    media: true,
    reminders: true,
  });

  // Load cấu hình đã lưu khi mở app
  useEffect(() => {
    AsyncStorage.getItem('TAB_CONFIG').then((saved) => {
      if (saved) {
        setTabState(JSON.parse(saved));
      }
    });
  }, []);

  // Hàm bật/tắt
  const toggleTab = async (key: keyof TabState) => {
    const newState = { ...tabState, [key]: !tabState[key] };
    setTabState(newState);
    await AsyncStorage.setItem('TAB_CONFIG', JSON.stringify(newState));
  };

  return (
    <TabContext.Provider value={{ tabState, toggleTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTab = () => useContext(TabContext);