// ipa/app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabaseConfig';

// --- CẤU HÌNH KÍCH THƯỚC ---
const CARD_WIDTH = 100;
const CARD_HEIGHT = 50;
const SPACING = 20;

type Member = {
  id: string;
  full_name: string;
  gender: string;
  birth_date: string;
  bio: string;
  father_id: string | null;
  mother_id: string | null;
  wife_husband_id: string | null;
  created_at?: string;
  children?: Member[];
  spouse?: Member;
  
  relation?: string;
  generation?: number;
};

export default function FamilyTreeScreen() {
  const { colors } = useTheme();
  const [treeData, setTreeData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [modalType, setModalType] = useState<'DETAIL' | 'ADD_CHILD' | 'ADD_SPOUSE' | 'ADD_PARENT' | 'EDIT' | null>(null);
  const [formData, setFormData] = useState({ fullName: '', gender: 'Nam', birthDate: '', bio: '' });

  const [rootPersonId, setRootPersonId] = useState<string | null>(null);

  // --- 1. LOGIC TÍNH TOÁN QUAN HỆ (Siêu Radar Ngoại & Nội - Có Cố/Cụ) ---
  const calculateRelations = (members: Member[], rootId: string | null) => {
      if (!rootId) return members;

      const map: Record<string, Member> = {};
      members.forEach(m => map[m.id] = {...m, relation: '', generation: 999});
      const mapVals = Object.values(map); 
      
      const root = map[rootId];
      if (!root) return members;

      // HÀM SOI TUỔI TÁC
      const isOlder = (a: Member, b: Member) => {
          if (a.birth_date && b.birth_date) {
              const getYear = (d: string) => { const match = d.match(/\d{4}/); return match ? parseInt(match[0], 10) : null; };
              const yearA = getYear(a.birth_date);
              const yearB = getYear(b.birth_date);
              if (yearA !== null && yearB !== null && yearA !== yearB) return yearA < yearB; 
          }
          if (a.created_at && b.created_at) {
              return new Date(a.created_at).getTime() < new Date(b.created_at).getTime();
          }
          return a.id < b.id;
      };

      root.relation = 'Tôi';
      root.generation = 0;

      if (root.wife_husband_id && map[root.wife_husband_id]) {
          map[root.wife_husband_id].relation = root.gender === 'Nam' ? 'Vợ' : 'Chồng';
          map[root.wife_husband_id].generation = 0;
      }

      const dad = root.father_id ? map[root.father_id] : null;
      const mom = root.mother_id ? map[root.mother_id] : null;

      // --- NHÁNH NỘI ---
      if (dad) {
          dad.relation = 'Bố'; dad.generation = -1;
          
          if (dad.father_id && map[dad.father_id]) { 
              map[dad.father_id].relation = 'Ông Nội'; map[dad.father_id].generation = -2; 
              if (map[dad.father_id].father_id && map[map[dad.father_id].father_id!]) {
                  map[map[dad.father_id].father_id!].relation = 'Cố Nội'; map[map[dad.father_id].father_id!].generation = -3;
              }
          }
          if (dad.mother_id && map[dad.mother_id]) { 
              map[dad.mother_id].relation = 'Bà Nội'; map[dad.mother_id].generation = -2; 
          }
          
          mapVals.forEach(m => {
              // Tìm anh chị em của Bố
              if (m.id !== dad.id && ((dad.father_id && m.father_id === dad.father_id) || (dad.mother_id && m.mother_id === dad.mother_id))) {
                   m.generation = -1;
                   if (isOlder(m, dad)) { 
                       m.relation = m.gender === 'Nam' ? 'Bác Trai' : 'Bác Gái';
                       if (m.wife_husband_id && map[m.wife_husband_id]) {
                           map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Bác Dâu' : 'Bác Rể';
                           map[m.wife_husband_id].generation = -1;
                       }
                   } else { 
                       m.relation = m.gender === 'Nam' ? 'Chú' : 'Cô';
                       if (m.wife_husband_id && map[m.wife_husband_id]) {
                           map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Thím' : 'Dượng';
                           map[m.wife_husband_id].generation = -1;
                       }
                   }
                   
                   // Anh/Chị/Em Họ
                   mapVals.forEach(cousin => {
                       if (cousin.father_id === m.id || cousin.mother_id === m.id) {
                           cousin.generation = 0;
                           if (isOlder(cousin, root)) {
                               cousin.relation = cousin.gender === 'Nam' ? 'Anh Họ' : 'Chị Họ';
                           } else {
                               cousin.relation = cousin.gender === 'Nam' ? 'Em Trai Họ' : 'Em Gái Họ'; 
                           }
                       }
                   });
              }
          });
      }

      // --- NHÁNH NGOẠI ---
      if (mom) {
          mom.relation = 'Mẹ'; mom.generation = -1;
          
          if (mom.father_id && map[mom.father_id]) { 
              map[mom.father_id].relation = 'Ông Ngoại'; map[mom.father_id].generation = -2; 
              if (map[mom.father_id].father_id && map[map[mom.father_id].father_id!]) {
                  map[map[mom.father_id].father_id!].relation = 'Cố Ngoại'; map[map[mom.father_id].father_id!].generation = -3;
              }
          }
          if (mom.mother_id && map[mom.mother_id]) { 
              map[mom.mother_id].relation = 'Bà Ngoại'; map[mom.mother_id].generation = -2; 
          }

          mapVals.forEach(m => {
            // Tìm anh chị em của Mẹ
            if (m.id !== mom.id && ((mom.father_id && m.father_id === mom.father_id) || (mom.mother_id && m.mother_id === mom.mother_id))) {
                 m.generation = -1;
                 if (isOlder(m, mom)) { 
                     m.relation = m.gender === 'Nam' ? 'Bác Trai (Ngoại)' : 'Bác Gái (Ngoại)';
                     if (m.wife_husband_id && map[m.wife_husband_id]) {
                         map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Bác Dâu (Ngoại)' : 'Bác Rể (Ngoại)';
                         map[m.wife_husband_id].generation = -1;
                     }
                 } else { 
                     m.relation = m.gender === 'Nam' ? 'Cậu' : 'Dì';
                     if (m.wife_husband_id && map[m.wife_husband_id]) {
                         map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Mợ' : 'Dượng';
                         map[m.wife_husband_id].generation = -1;
                     }
                 }
                 
                 // Anh/Chị/Em Họ (Ngoại)
                 mapVals.forEach(cousin => {
                    if (cousin.father_id === m.id || cousin.mother_id === m.id) {
                        cousin.generation = 0;
                        if (isOlder(cousin, root)) {
                             cousin.relation = cousin.gender === 'Nam' ? 'Anh Họ (Ngoại)' : 'Chị Họ (Ngoại)';
                        } else {
                             cousin.relation = cousin.gender === 'Nam' ? 'Em Trai Họ (Ngoại)' : 'Em Gái Họ (Ngoại)';
                        }
                    }
                });
            }
        });
      }

      // TÌM NGANG: Anh Chị Em ruột
      mapVals.forEach(m => {
          if (m.id !== root.id && ((root.father_id && m.father_id === root.father_id) || (root.mother_id && m.mother_id === root.mother_id))) {
              m.generation = 0;
              if (isOlder(m, root)) { 
                  m.relation = m.gender === 'Nam' ? 'Anh Trai' : 'Chị Gái';
                  if (m.wife_husband_id && map[m.wife_husband_id]) {
                      map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Chị Dâu' : 'Anh Rể';
                      map[m.wife_husband_id].generation = 0;
                  }
              } else { 
                  m.relation = m.gender === 'Nam' ? 'Em Trai' : 'Em Gái';
                  if (m.wife_husband_id && map[m.wife_husband_id]) {
                      map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Em Dâu' : 'Em Rể';
                      map[m.wife_husband_id].generation = 0;
                  }
              }
              
              mapVals.forEach(nephew => {
                  if (nephew.father_id === m.id || nephew.mother_id === m.id) {
                      nephew.relation = 'Cháu'; nephew.generation = 1;
                  }
              });
          }
      });

      // TÌM XUÔI XUỐNG: Con, Cháu, Chắt
      mapVals.forEach(m => {
          if (m.father_id === rootId || m.mother_id === rootId) {
              m.relation = 'Con'; m.generation = 1;
              if (m.wife_husband_id && map[m.wife_husband_id]) {
                  map[m.wife_husband_id].relation = m.gender === 'Nam' ? 'Con Dâu' : 'Con Rể'; map[m.wife_husband_id].generation = 1;
              }
              
              mapVals.forEach(grandChild => {
                  if (grandChild.father_id === m.id || grandChild.mother_id === m.id) {
                      grandChild.relation = 'Cháu Nội/Ngoại'; grandChild.generation = 2;
                      
                      mapVals.forEach(greatGrandChild => {
                          if (greatGrandChild.father_id === grandChild.id || greatGrandChild.mother_id === grandChild.id) {
                              greatGrandChild.relation = 'Chắt'; greatGrandChild.generation = 3;
                          }
                      });
                  }
              });
          }
      });

      return mapVals;
  };


  // --- 2. LOGIC XÂY CÂY ---
  const fetchAndBuildTree = async () => {
    setLoading(true);
    const { data: allMembers, error } = await supabase.from('members').select('*');
    if (error) { setLoading(false); return; }
    if (!allMembers) return;

    const processedMembers = calculateRelations(allMembers, rootPersonId);

    const memberMap: Record<string, Member> = {};
    processedMembers.forEach((m) => { memberMap[m.id] = { ...m, children: [] }; });
    const rootMembers: Member[] = [];

    processedMembers.forEach((m) => {
      const current = memberMap[m.id];
      if (m.wife_husband_id && memberMap[m.wife_husband_id]) current.spouse = memberMap[m.wife_husband_id];
      if (m.father_id && memberMap[m.father_id]) memberMap[m.father_id].children?.push(current);
      else if (m.mother_id && memberMap[m.mother_id]) memberMap[m.mother_id].children?.push(current);
      else if (!m.father_id && !m.mother_id) {
         if (m.wife_husband_id && memberMap[m.wife_husband_id]) {
            const spouse = memberMap[m.wife_husband_id];
            if (spouse.father_id || spouse.mother_id) return; 
            if (m.gender === 'Nam' || (m.gender === spouse.gender && m.id < spouse.id)) rootMembers.push(current);
         } else { rootMembers.push(current); }
      }
    });
    setTreeData(rootMembers);
    setLoading(false);
  };

  useEffect(() => { fetchAndBuildTree(); }, [rootPersonId]);

  // --- CÁC HÀM XỬ LÝ ---
  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${message}`)) onConfirm(); }
    else { Alert.alert(title, message, [{ text: "Hủy", style: "cancel" }, { text: "Đồng ý", style: "destructive", onPress: onConfirm }]); }
  };
  const finalizeAction = (msg: string) => { Alert.alert('Thành công', msg); setModalType(null); setSelectedMember(null); fetchAndBuildTree(); };
  
  const handleDelete = () => {
    if (!selectedMember) return;
    confirmAction("Xóa", `Xóa ${selectedMember.full_name}?`, async () => { await supabase.from('members').delete().eq('id', selectedMember.id); finalizeAction('Đã xóa!'); });
  };
  const handleDivorce = () => {
    if (!selectedMember || !selectedMember.wife_husband_id) return;
    confirmAction("Gỡ quan hệ", "Gỡ vợ chồng?", async () => {
        const sId = selectedMember.wife_husband_id; await supabase.from('members').update({ wife_husband_id: null }).eq('id', selectedMember.id); await supabase.from('members').update({ wife_husband_id: null }).eq('id', sId); finalizeAction("Đã gỡ.");
    });
  };

  // NÂNG CẤP HÀM LƯU: Xử lý chức năng thêm Bố/Mẹ
  const handleSave = async () => {
    if (!formData.fullName.trim()) return Alert.alert('Lỗi', 'Cần nhập tên');
    if (modalType === 'EDIT' && selectedMember) { 
        await supabase.from('members').update({ full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio }).eq('id', selectedMember.id); 
        finalizeAction('Cập nhật!'); 
    }
    else if (modalType === 'ADD_CHILD' && selectedMember) {
        const fId = selectedMember.gender === 'Nam' ? selectedMember.id : selectedMember.wife_husband_id;
        const mId = selectedMember.gender === 'Nữ' ? selectedMember.id : selectedMember.wife_husband_id;
        await supabase.from('members').insert([{ full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio, father_id: fId, mother_id: mId }]); 
        finalizeAction('Đã thêm con!');
    } 
    else if (modalType === 'ADD_SPOUSE' && selectedMember) {
        const { data: nS } = await supabase.from('members').insert([{ full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio, wife_husband_id: selectedMember.id }]).select().single();
        if (nS) { await supabase.from('members').update({ wife_husband_id: nS.id }).eq('id', selectedMember.id); finalizeAction('Kết duyên!'); }
    }
    else if (modalType === 'ADD_PARENT' && selectedMember) {
        // Tạo hồ sơ Bố hoặc Mẹ mới
        const { data: newParent, error } = await supabase.from('members').insert([{ 
            full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio 
        }]).select().single();
        
        if (newParent && !error) {
            // Nối ID của Bố/Mẹ mới vào hồ sơ của người hiện tại
            const updateField = formData.gender === 'Nam' ? { father_id: newParent.id } : { mother_id: newParent.id };
            await supabase.from('members').update(updateField).eq('id', selectedMember.id);
            finalizeAction(`Đã thêm ${formData.gender === 'Nam' ? 'Bố' : 'Mẹ'}!`);
        } else {
            Alert.alert('Lỗi', 'Không thể thêm Bố/Mẹ. Hãy thử lại.');
        }
    }
  };

  const handleSetRoot = () => {
      if(selectedMember) {
          setRootPersonId(selectedMember.id);
          Alert.alert("Đã đặt làm Gốc", `Đang hiển thị họ hàng dưới góc nhìn của "${selectedMember.full_name}".`);
          setModalType(null);
      }
  };

  // --- COMPONENT VẼ CÂY ---
  const TreeNode = ({ node, isFirst, isLast, isRoot }: { node: Member, isFirst?: boolean, isLast?: boolean, isRoot?: boolean }) => {
    const allChildren = [...(node.children || [])];
    if (node.spouse && node.spouse.children) {
        node.spouse.children.forEach(sc => { if(!allChildren.find(c => c.id === sc.id)) allChildren.push(sc); });
    }

    return (
      <View style={styles.nodeWrapper}>
        {!isRoot && (
           <View style={styles.lineAboveContainer}>
             <View style={[styles.lineHorizontal, isFirst && styles.lineHiddenLeft, isLast && styles.lineHiddenRight]} />
             <View style={styles.lineVerticalTop} />
           </View>
        )}

        <View style={styles.coupleRow}>
          {node.spouse && <View style={styles.ghostSpouse} />}
          
          <View style={styles.mainMemberContainer}>
            <TouchableOpacity 
              style={[
                  styles.memberCard, 
                  { backgroundColor: node.gender === 'Nam' ? '#E0F2FE' : '#FCE7F3', borderColor: node.gender === 'Nam' ? '#7DD3FC' : '#FBCFE8' },
                  node.id === rootPersonId && { borderWidth: 2, borderColor: '#EF4444' } 
              ]} 
              onPress={() => { setSelectedMember(node); setModalType('DETAIL'); }}
            >
              <View>
                 <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                    <Ionicons name={node.gender === 'Nam' ? 'man' : 'woman'} size={12} color={node.gender === 'Nam' ? '#0369A1' : '#BE185D'} />
                    <Text style={styles.nameText} numberOfLines={1}>{node.full_name}</Text>
                 </View>
                 {node.relation && (
                     <Text style={{fontSize: 9, color: '#DC2626', fontWeight: 'bold', textAlign: 'center', marginTop: 2}}>{node.relation}</Text>
                 )}
              </View>
            </TouchableOpacity>
            {allChildren.length > 0 && <View style={styles.lineVerticalBottom} />}
          </View>

          {node.spouse && (
            <View style={styles.spouseContainer}>
               <View style={styles.connector} />
               <TouchableOpacity 
                 style={[styles.memberCard, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]} 
                 onPress={() => { setSelectedMember(node.spouse!); setModalType('DETAIL'); }}
               >
                 <View>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                        <Ionicons name={node.spouse.gender === 'Nam' ? 'man' : 'woman'} size={12} color="gray" />
                        <Text style={[styles.nameText, {color: 'gray'}]} numberOfLines={1}>{node.spouse.full_name}</Text>
                    </View>
                    {node.spouse.relation && (
                         <Text style={{fontSize: 9, color: '#DC2626', fontWeight: 'bold', textAlign: 'center', marginTop: 2}}>{node.spouse.relation}</Text>
                     )}
                 </View>
               </TouchableOpacity>
            </View>
          )}
        </View>

        {allChildren.length > 0 && (
          <View style={styles.childrenListContainer}>
            {allChildren.map((child, index) => (
              <TreeNode key={child.id} node={child} isFirst={index === 0} isLast={index === (allChildren.length - 1)} />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Gia Phả Chính Thống</Text>
        {rootPersonId ? (
            <TouchableOpacity style={styles.exitRootBtn} onPress={() => setRootPersonId(null)}>
                <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>❌ Thoát xem quan hệ</Text>
            </TouchableOpacity>
        ) : (
            <Text style={{textAlign: 'center', color: '#666', fontSize: 12, marginBottom: 10}}>
                {'Chọn một người -> "Đặt làm Gốc" để xem họ hàng'}
            </Text>
        )}
      </View>

      {loading ? ( <ActivityIndicator size="large" style={{marginTop: 50}} /> ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
             {treeData.length === 0 ? (
                <TouchableOpacity onPress={() => { setModalType('ADD_CHILD'); setSelectedMember({id: 'root'} as any); }} style={styles.rootBtn}><Text style={{color:'white'}}>+ Thêm Người Đầu Tiên</Text></TouchableOpacity>
             ) : ( treeData.map((root) => <TreeNode key={root.id} node={root} isRoot={true} />) )}
          </ScrollView>
        </ScrollView>
      )}

      <Modal visible={modalType !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {modalType === 'DETAIL' && selectedMember ? (
              <>
                <View style={styles.detailHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedMember.full_name}</Text>
                    <View style={{flexDirection: 'row'}}>
                        <TouchableOpacity onPress={handleDelete} style={{marginRight: 15}}><Ionicons name="trash-outline" size={24} color="#EF4444" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => { setFormData({fullName: selectedMember.full_name, gender: selectedMember.gender, birthDate: selectedMember.birth_date || '', bio: selectedMember.bio || ''}); setModalType('EDIT'); }}><Ionicons name="pencil" size={24} color={colors.primary} /></TouchableOpacity>
                    </View>
                </View>
                <View style={styles.infoBox}>
                    <Text style={{color: colors.text}}>🎂 {selectedMember.birth_date || '?'}</Text>
                    <Text style={{color: colors.text}}>⚥ {selectedMember.gender}</Text>
                    {selectedMember.relation && <Text style={{color: '#DC2626', fontWeight: 'bold', marginTop: 5}}>Vai vế: {selectedMember.relation}</Text>}
                </View>

                <TouchableOpacity style={styles.setRootBtn} onPress={handleSetRoot}>
                    <Text style={{color: '#D97706', fontWeight: 'bold'}}>★ Đặt làm Gốc (Xem quan hệ)</Text>
                </TouchableOpacity>

                <View style={styles.menuGrid}>
                  {/* NÚT MỚI: Thêm Bố/Mẹ */}
                  <TouchableOpacity style={[styles.menuItem, {backgroundColor: '#DBEAFE'}]} onPress={() => { setFormData({fullName:'', gender:'Nam', birthDate:'', bio:''}); setModalType('ADD_PARENT'); }}>
                      <Text style={{color: '#1D4ED8', fontSize: 13}}>+ Bố/Mẹ</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.menuItem, {backgroundColor: '#DCFCE7'}]} onPress={() => { setFormData({fullName:'', gender:'Nam', birthDate:'', bio:''}); setModalType('ADD_CHILD'); }}>
                      <Text style={{color: '#16A34A', fontSize: 13}}>+ Con</Text>
                  </TouchableOpacity>
                  
                  {!selectedMember.wife_husband_id ? (
                    <TouchableOpacity style={[styles.menuItem, {backgroundColor: '#FCE7F3'}]} onPress={() => { setFormData({fullName:'', gender: selectedMember.gender === 'Nam' ? 'Nữ' : 'Nam', birthDate:'', bio:''}); setModalType('ADD_SPOUSE'); }}>
                        <Text style={{color: '#DB2777', fontSize: 13}}>+ Vợ/Ch</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.menuItem, {borderWidth: 1, borderColor: '#DB2777'}]} onPress={handleDivorce}>
                        <Text style={{color: '#DB2777', fontSize: 13}}>Ly hôn</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={{alignItems:'center', padding:10}} onPress={() => setModalType(null)}><Text style={{color: 'gray'}}>Đóng</Text></TouchableOpacity>
              </>
            ) : (
               <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {modalType === 'ADD_PARENT' ? 'Thêm Bố / Mẹ' : 'Thông Tin'}
                </Text>
                <TextInput style={[styles.input, {color: colors.text, borderColor: colors.border}]} placeholder="Họ tên" value={formData.fullName} onChangeText={(t)=>setFormData({...formData, fullName: t})} />
                <View style={{flexDirection:'row', marginBottom:15}}>
                    <TextInput style={[styles.input, {flex:1, marginRight:10, color:colors.text, borderColor:colors.border}]} placeholder="Ngày sinh (VD: 1990)" value={formData.birthDate} onChangeText={(t)=>setFormData({...formData, birthDate: t})} />
                    
                    {/* Tùy chỉnh giới tính nếu đang thêm Bố/Mẹ để định hình chức danh */}
                    {modalType === 'ADD_PARENT' ? (
                        <>
                            <TouchableOpacity onPress={()=>setFormData({...formData, gender:'Nam'})} style={[styles.genderBtn, formData.gender==='Nam' && {backgroundColor:'#E0F2FE'}]}><Text>Bố</Text></TouchableOpacity>
                            <TouchableOpacity onPress={()=>setFormData({...formData, gender:'Nữ'})} style={[styles.genderBtn, formData.gender==='Nữ' && {backgroundColor:'#FCE7F3'}]}><Text>Mẹ</Text></TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity onPress={()=>setFormData({...formData, gender:'Nam'})} style={[styles.genderBtn, formData.gender==='Nam' && {backgroundColor:'#E0F2FE'}]}><Text>Nam</Text></TouchableOpacity>
                            <TouchableOpacity onPress={()=>setFormData({...formData, gender:'Nữ'})} style={[styles.genderBtn, formData.gender==='Nữ' && {backgroundColor:'#FCE7F3'}]}><Text>Nữ</Text></TouchableOpacity>
                        </>
                    )}
                </View>
                <TextInput style={[styles.input, {height:60}]} placeholder="Ghi chú" multiline value={formData.bio} onChangeText={(t)=>setFormData({...formData, bio: t})} />
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={{color:'white', fontWeight:'bold'}}>Lưu</Text></TouchableOpacity>
                <TouchableOpacity style={{alignItems:'center', marginTop:10}} onPress={() => setModalType(null)}><Text style={{color: 'gray'}}>Hủy</Text></TouchableOpacity>
               </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { marginTop: 50, marginBottom: 5, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  exitRootBtn: { backgroundColor: '#EF4444', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 10 },
  scrollContent: { padding: 40, alignItems: 'flex-start', minWidth: '100%', minHeight: '100%' },
  nodeWrapper: { alignItems: 'center' },
  coupleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  mainMemberContainer: { alignItems: 'center', width: CARD_WIDTH, zIndex: 10 },
  spouseContainer: { flexDirection: 'row', alignItems: 'center', height: CARD_HEIGHT },
  connector: { width: SPACING, height: 2, backgroundColor: '#9CA3AF' },
  ghostSpouse: { width: CARD_WIDTH + SPACING, height: CARD_HEIGHT },
  memberCard: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', paddingHorizontal: 4 },
  nameText: { fontWeight: 'bold', fontSize: 11, marginLeft: 4, flexShrink: 1, maxWidth: 75, textAlign: 'center' },
  lineVerticalBottom: { width: 2, height: 25, backgroundColor: '#9CA3AF' },
  lineAboveContainer: { height: 20, width: '100%', alignItems: 'center', position: 'relative' },
  lineVerticalTop: { width: 2, height: '100%', backgroundColor: '#9CA3AF' },
  lineHorizontal: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#9CA3AF' },
  lineHiddenLeft: { left: '50%' },
  lineHiddenRight: { right: '50%' },
  childrenListContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 15, maxWidth: 350, width: '100%', alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  infoBox: { backgroundColor: '#f3f4f6', padding: 10, borderRadius: 8, marginBottom: 15 },
  setRootBtn: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B', alignItems: 'center', marginBottom: 15 },
  menuGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  menuItem: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', marginHorizontal: 3 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  genderBtn: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginLeft: 5 },
  saveBtn: { backgroundColor: '#4F46E5', padding: 12, borderRadius: 8, alignItems: 'center' },
  rootBtn: { backgroundColor: '#4F46E5', padding: 15, borderRadius: 10 }
});