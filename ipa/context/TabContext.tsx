import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tèo đã xóa hết mấy cái tab cũ, giờ chỉ để trống để chờ sau này anh cần thêm tính năng gì thì thêm
type TabState = {
  // Hiện tại chưa cần ẩn hiện gì cả vì Gia phả là chính
  isReady: boolean; 
};

type TabContextType = {
  tabState: TabState;
  toggleTab: (key: keyof TabState) => void;
};

const TabContext = createContext<TabContextType>({
  tabState: { isReady: true },
  toggleTab: () => {},
});

export const TabProvider = ({ children }: { children: React.ReactNode }) => {
  const [tabState, setTabState] = useState<TabState>({
    isReady: true,
  });

  // Giữ lại hàm load này cho vui, sau này dùng lưu setting khác
  useEffect(() => {
    AsyncStorage.getItem('TAB_CONFIG').then((saved) => {
      if (saved) {
        // Code cũ, cứ để đó tính sau
      }
    });
  }, []);

  const toggleTab = async (key: keyof TabState) => {
    // Tạm thời chưa làm gì cả
  };

  return (
    <TabContext.Provider value={{ tabState, toggleTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTab = () => useContext(TabContext);