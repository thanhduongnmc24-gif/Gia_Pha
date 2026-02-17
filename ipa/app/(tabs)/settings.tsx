import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, Alert, StyleSheet } from 'react-native';
// Chú ý đường dẫn mới: ../../context
import { useTheme } from '../../context/ThemeContext';
// Chú ý đường dẫn mới: ../../utils
import { supabase } from '../../utils/supabaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || 'Chưa cập nhật email');
    });
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Lỗi', error.message);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
             <View style={styles.profileIcon}>
                <Ionicons name="person" size={40} color="white" />
             </View>
             <Text style={[styles.email, { color: colors.text }]}>{userEmail}</Text>
        </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Chế độ tối (Dark Mode)</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Đăng Xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: 'center', marginVertical: 40 },
  profileIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  email: { fontSize: 18, fontWeight: '600' },
  section: { padding: 15, borderRadius: 10, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoutBtn: { backgroundColor: '#EF4444', padding: 15, borderRadius: 10, alignItems: 'center' },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});