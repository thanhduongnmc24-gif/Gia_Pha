import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFocusEffect } from 'expo-router';

// Kiểu dữ liệu cho nhân vật được AI phát hiện
type DetectedChar = {
  name: string;
  visual_prompt: string;
};

type MediaType = 'video' | 'image' | 'title';

export default function MediaScreen() {
  const { colors } = useTheme();

  // --- STATE CHUNG ---
  const [apiKey, setApiKey] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('video'); 
  const [isGenerating, setIsGenerating] = useState(false); 

  // --- CẤU HÌNH LIMIT ---
  const [limitCharDesc, setLimitCharDesc] = useState('200'); // Giới hạn ký tự mô tả NV
  const [limitMainPrompt, setLimitMainPrompt] = useState('800'); // Giới hạn prompt chính

  // --- INPUT & OUTPUT VIDEO ---
  const [storyInput, setStoryInput] = useState(''); // Nội dung câu chuyện
  const [detectedChars, setDetectedChars] = useState<DetectedChar[]>([]); // Danh sách NV AI tìm thấy
  const [videoPromptEn, setVideoPromptEn] = useState(''); // Prompt chính (Anh)
  const [videoPromptVi, setVideoPromptVi] = useState(''); // Dịch nghĩa (Việt)

  // --- IMAGE & TITLE STATE (Giữ nguyên logic cũ cho Ảnh/Tiêu đề nếu cần dùng lại) ---
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageResult, setImageResult] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [titleResult, setTitleResult] = useState('');
  const [titlePlatform, setTitlePlatform] = useState<'short' | 'video'>('video');

  // Load Key mỗi khi vào tab
  useFocusEffect(
    useCallback(() => {
        const loadKey = async () => {
            try {
                const savedKey = await AsyncStorage.getItem('GEMINI_API_KEY');
                if (savedKey) setApiKey(savedKey);
            } catch (e) { console.log("Lỗi load key:", e); }
        };
        loadKey();
    }, [])
  );

  const handleClearAll = () => {
    Alert.alert("Dọn dẹp", `Xóa sạch nội dung đang nhập?`, [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: 'destructive', onPress: () => {
            if (mediaType === 'video') {
                setStoryInput(''); setDetectedChars([]); setVideoPromptEn(''); setVideoPromptVi('');
            } else if (mediaType === 'image') {
                setImagePrompt(''); setImageResult('');
            } else {
                setTitleInput(''); setTitleResult('');
            }
        }}
    ]);
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã Copy!", "Đã lưu vào bộ nhớ tạm.");
  };

  // --- HÀM GỌI GEMINI (LOGIC MỚI CHO VIDEO VEO3) ---
  const generateVeo3Prompt = async () => {
    if (!apiKey.trim()) { Alert.alert("Thiếu Key", "Vào Cài đặt nhập Key Gemini đi đại ca!"); return; }
    if (!storyInput.trim()) { Alert.alert("Thiếu nội dung", "Nhập câu chuyện hoặc đoạn văn vào đã!"); return; }

    setIsGenerating(true);
    setDetectedChars([]); setVideoPromptEn(''); setVideoPromptVi('');

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Hoặc model nào anh thích

      // Prompt kỹ thuật (System Prompt)
      const systemPrompt = `
        Role: Expert Video Prompt Engineer for VEO3 (8-second videos).
        Task: Analyze the user's input story/paragraph and generate structured prompts.
        
        Input Story: "${storyInput}"
        
        Constraints:
        1. Character Description Limit: ${limitCharDesc} characters per character.
        2. Main Prompt Limit: ${limitMainPrompt} characters.
        3. Main Prompt Language: English.
        4. CRITICAL: If there is dialogue, KEEP IT IN VIETNAMESE inside double quotes "". Do not translate the dialogue.
        5. Structure: Chronological order (describe what happens over time).
        
        Output Format: Return ONLY a valid JSON object with this structure (no markdown backticks):
        {
          "characters": [
            { "name": "Name of character 1", "visual_prompt": "Visual description..." },
            { "name": "Name of character 2", "visual_prompt": "Visual description..." }
          ],
          "main_prompt_en": "The chronological video prompt in English...",
          "main_prompt_vi": "Vietnamese translation of the main prompt..."
        }
      `;

      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      let text = response.text();

      // Làm sạch chuỗi JSON nếu AI lỡ thêm markdown
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const jsonRes = JSON.parse(text);

      if (jsonRes) {
        setDetectedChars(jsonRes.characters || []);
        setVideoPromptEn(jsonRes.main_prompt_en || '');
        setVideoPromptVi(jsonRes.main_prompt_vi || '');
      }

    } catch (error: any) {
      Alert.alert("Lỗi AI", "Không tạo được prompt: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Logic cũ cho Image/Title
  const generateOther = async (type: 'image' | 'title') => {
      // (Giữ logic đơn giản cho các tab khác để không làm rối code)
      if (!apiKey) return Alert.alert("Lỗi", "Thiếu API Key");
      setIsGenerating(true);
      try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const input = type === 'image' ? imagePrompt : titleInput;
          const prompt = type === 'image' 
            ? `Describe this image idea in detail (English): "${input}". Then translate to Vietnamese. Format: [Viet]|||[Eng]`
            : `Generate 5 YouTube titles for "${input}" (${titlePlatform}). Output only titles.`;
          
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          
          if (type === 'image') setImageResult(text);
          else setTitleResult(text);
      } catch (e) { Alert.alert("Lỗi", "Thử lại sau nhé."); }
      finally { setIsGenerating(false); }
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    label: { fontSize: 13, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: colors.iconBg, color: colors.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
    btnPrimary: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' as const, marginTop: 20 },
    btnText: { color: '#fff', fontWeight: 'bold' as const, fontSize: 16 },
    
    // Style Tab
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center' as const, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginHorizontal: 2 },
    tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabButtonInactive: { backgroundColor: colors.iconBg, borderColor: colors.border },
    tabText: { fontWeight: 'bold' as const, fontSize: 14 },

    // Style Result
    charCard: { backgroundColor: colors.card, padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: colors.accent, borderWidth: 1, borderColor: colors.border },
    resultBox: { backgroundColor: colors.inputBg, padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
    resultTitle: { fontSize: 11, fontWeight: 'bold' as const, marginBottom: 5, textTransform: 'uppercase' as const },
    
    limitContainer: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 10 },
    limitBox: { flex: 0.48 },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          
          <View style={dynamicStyles.header}>
              <Text style={dynamicStyles.title}>Media Creator 🎬</Text>
              <TouchableOpacity onPress={handleClearAll} style={{padding:8, backgroundColor: colors.iconBg, borderRadius:8}}><Ionicons name="trash-bin-outline" size={24} color="#EF4444" /></TouchableOpacity>
          </View>
          
          {/* TAB CHỌN CHẾ ĐỘ */}
          <View style={{flexDirection: 'row', marginBottom: 20}}>
              {['video', 'image', 'title'].map((t) => (
                  <TouchableOpacity key={t} 
                    style={[dynamicStyles.tabButton, mediaType === t ? dynamicStyles.tabButtonActive : dynamicStyles.tabButtonInactive]} 
                    onPress={() => setMediaType(t as MediaType)}
                  >
                      <Text style={[dynamicStyles.tabText, {color: mediaType === t ? 'white' : colors.subText}]}>
                        {t === 'video' ? 'Video VEO3' : t === 'image' ? 'Ảnh' : 'Tiêu đề'}
                      </Text>
                  </TouchableOpacity>
              ))}
          </View>

          {/* === GIAO DIỆN VIDEO VEO3 === */}
          {mediaType === 'video' && (
            <View>
                {/* 1. HAI Ô LIMIT TRÊN CÙNG */}
                <View style={dynamicStyles.limitContainer}>
                    <View style={dynamicStyles.limitBox}>
                        <Text style={dynamicStyles.label}>Max ký tự NV:</Text>
                        <TextInput style={dynamicStyles.input} keyboardType="numeric" value={limitCharDesc} onChangeText={setLimitCharDesc} placeholder="200" />
                    </View>
                    <View style={dynamicStyles.limitBox}>
                        <Text style={dynamicStyles.label}>Max ký tự Video:</Text>
                        <TextInput style={dynamicStyles.input} keyboardType="numeric" value={limitMainPrompt} onChangeText={setLimitMainPrompt} placeholder="1000" />
                    </View>
                </View>

                {/* 2. Ô NHẬP NỘI DUNG */}
                <Text style={dynamicStyles.label}>Nội dung / Câu chuyện (8s):</Text>
                <TextInput 
                    style={[dynamicStyles.input, {height: 120, textAlignVertical: 'top'}]} 
                    placeholder="Ví dụ: Tèo đang ngồi code hăng say thì con mèo nhảy lên bàn phím..." 
                    placeholderTextColor={colors.subText} 
                    multiline 
                    value={storyInput} 
                    onChangeText={setStoryInput} 
                />

                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={generateVeo3Prompt} disabled={isGenerating}>
                    {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Phân tích & Tạo Prompt</Text>}
                </TouchableOpacity>

                {/* 3. KẾT QUẢ HIỂN THỊ BÊN DƯỚI */}
                {(detectedChars.length > 0 || videoPromptEn) && (
                    <View style={{marginTop: 25}}>
                        <View style={{height: 1, backgroundColor: colors.border, marginBottom: 20}} />
                        
                        {/* DANH SÁCH NHÂN VẬT TỰ ĐỘNG */}
                        {detectedChars.length > 0 && (
                            <View style={{marginBottom: 15}}>
                                <Text style={[dynamicStyles.label, {color: colors.accent}]}>👥 NHÂN VẬT ĐƯỢC PHÁT HIỆN:</Text>
                                {detectedChars.map((char, index) => (
                                    <View key={index} style={dynamicStyles.charCard}>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Text style={{fontWeight: 'bold', color: colors.text}}>{char.name}</Text>
                                            <TouchableOpacity onPress={() => copyToClipboard(char.visual_prompt)}><Ionicons name="copy-outline" size={16} color={colors.subText}/></TouchableOpacity>
                                        </View>
                                        <Text style={{fontSize: 12, color: colors.subText, marginTop: 4}}>{char.visual_prompt}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* PROMPT TIẾNG ANH (CÓ THOẠI VIỆT) */}
                        <Text style={[dynamicStyles.label, {color: colors.primary}]}>🇺🇸 PROMPT VIDEO (TIME-BASED):</Text>
                        <View style={[dynamicStyles.resultBox, {borderColor: colors.primary}]}>
                            <View style={{flexDirection:'row', justifyContent:'flex-end', marginBottom: 5}}>
                                <TouchableOpacity onPress={() => copyToClipboard(videoPromptEn)}>
                                    <View style={{flexDirection:'row', alignItems:'center'}}>
                                        <Ionicons name="copy" size={16} color={colors.primary} />
                                        <Text style={{fontSize:12, fontWeight:'bold', color:colors.primary, marginLeft:5}}>COPY</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                            <Text style={{color: colors.text, fontStyle: 'italic'}}>{videoPromptEn}</Text>
                        </View>

                        {/* DỊCH TIẾNG VIỆT */}
                        <Text style={[dynamicStyles.label, {color: colors.success}]}>🇻🇳 NỘI DUNG TIẾNG VIỆT:</Text>
                        <View style={[dynamicStyles.resultBox, {borderColor: colors.success}]}>
                            <Text style={{color: colors.text}}>{videoPromptVi}</Text>
                        </View>
                    </View>
                )}
            </View>
          )}

          {/* === GIAO DIỆN ẢNH (GIẢN LƯỢC) === */}
          {mediaType === 'image' && (
            <View>
                <Text style={dynamicStyles.label}>Ý tưởng ảnh:</Text>
                <TextInput style={[dynamicStyles.input, {height: 100}]} multiline value={imagePrompt} onChangeText={setImagePrompt} placeholder="Mô tả ảnh..." placeholderTextColor={colors.subText}/>
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={() => generateOther('image')} disabled={isGenerating}>
                    {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Prompt Ảnh</Text>}
                </TouchableOpacity>
                {imageResult ? <View style={[dynamicStyles.resultBox, {marginTop: 20}]}><Text style={{color:colors.text}}>{imageResult}</Text></View> : null}
            </View>
          )}

          {/* === GIAO DIỆN TIÊU ĐỀ (GIẢN LƯỢC) === */}
          {mediaType === 'title' && (
             <View>
                <Text style={dynamicStyles.label}>Nội dung video:</Text>
                <TextInput style={[dynamicStyles.input, {height: 100}]} multiline value={titleInput} onChangeText={setTitleInput} placeholder="Nội dung..." placeholderTextColor={colors.subText}/>
                <View style={{flexDirection: 'row', marginTop: 10}}>
                    {['video', 'short'].map((p: any) => (
                        <TouchableOpacity key={p} onPress={() => setTitlePlatform(p)} style={{padding: 10, marginRight: 10, borderRadius: 8, backgroundColor: titlePlatform === p ? colors.primary : colors.iconBg}}>
                            <Text style={{color: titlePlatform === p ? 'white' : colors.text}}>{p === 'short' ? 'Shorts' : 'Video Dài'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={() => generateOther('title')} disabled={isGenerating}>
                     {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Tiêu Đề</Text>}
                </TouchableOpacity>
                {titleResult ? <View style={[dynamicStyles.resultBox, {marginTop: 20}]}><Text style={{color:colors.text}}>{titleResult}</Text></View> : null}
             </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
