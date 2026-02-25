// ipa/app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabaseConfig';

// --- CẤU HÌNH KÍCH THƯỚC ---
const CARD_WIDTH = 100;
const CARD_HEIGHT = 50; // Tăng chiều cao để hiện thêm vai vế
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
  children?: Member[];
  spouse?: Member;
  
  // Thuộc tính tính toán quan hệ
  relation?: string; // Vai vế đối với người được chọn làm Gốc
  generation?: number; // Đời thứ mấy (0: Gốc, -1: Cha, -2: Ông, 1: Con...)
};

export default function FamilyTreeScreen() {
  const { colors } = useTheme();
  const [treeData, setTreeData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [modalType, setModalType] = useState<'DETAIL' | 'ADD_CHILD' | 'ADD_SPOUSE' | 'EDIT' | null>(null);
  const [formData, setFormData] = useState({ fullName: '', gender: 'Nam', birthDate: '', bio: '' });

  // Người được chọn làm GỐC để tính quan hệ
  const [rootPersonId, setRootPersonId] = useState<string | null>(null);

  // --- 1. LOGIC TÍNH TOÁN QUAN HỆ (Huyết thống 3 đời) ---
  const calculateRelations = (members: Member[], rootId: string | null) => {
      if (!rootId) return members; // Nếu chưa chọn ai làm gốc thì trả về bình thường

      const map: Record<string, Member> = {};
      members.forEach(m => map[m.id] = {...m, relation: '', generation: 999});
      
      const root = map[rootId];
      if (!root) return members;

      // Đặt gốc
      root.relation = 'Tôi';
      root.generation = 0;

      // 1. Tìm ngược lên (Bố Mẹ, Ông Bà)
      if (root.father_id && map[root.father_id]) {
          const father = map[root.father_id];
          father.relation = 'Bố';
          father.generation = -1;
          
          if (father.father_id && map[father.father_id]) {
              map[father.father_id].relation = 'Ông Nội';
              map[father.father_id].generation = -2;
          }
          if (father.mother_id && map[father.mother_id]) {
              map[father.mother_id].relation = 'Bà Nội';
              map[father.mother_id].generation = -2;
          }
          // Anh em của bố (Chú/Bác/Cô)
          members.forEach(m => {
              if (m.father_id === father.father_id && m.id !== father.id && m.id !== root.mother_id) {
                   m.relation = m.gender === 'Nam' ? 'Chú/Bác' : 'Cô';
                   m.generation = -1;
              }
          });
      }

      if (root.mother_id && map[root.mother_id]) {
          const mother = map[root.mother_id];
          mother.relation = 'Mẹ';
          mother.generation = -1;

          if (mother.father_id && map[mother.father_id]) {
              map[mother.father_id].relation = 'Ông Ngoại';
              map[mother.father_id].generation = -2;
          }
          if (mother.mother_id && map[mother.mother_id]) {
              map[mother.mother_id].relation = 'Bà Ngoại';
              map[mother.mother_id].generation = -2;
          }
           // Anh em của mẹ (Cậu/Dì)
           members.forEach(m => {
            if (m.father_id === mother.father_id && m.id !== mother.id && m.id !== root.father_id) {
                 m.relation = m.gender === 'Nam' ? 'Cậu' : 'Dì';
                 m.generation = -1;
            }
        });
      }

      // 2. Tìm xuôi xuống (Con, Cháu)
      members.forEach(m => {
          if (m.father_id === rootId || m.mother_id === rootId) {
              m.relation = 'Con';
              m.generation = 1;
              
              // Cháu
              members.forEach(grandChild => {
                  if (grandChild.father_id === m.id || grandChild.mother_id === m.id) {
                      grandChild.relation = 'Cháu';
                      grandChild.generation = 2;
                  }
              });
          }
      });

      // 3. Tìm ngang hàng (Anh chị em, Vợ chồng)
      if (root.wife_husband_id && map[root.wife_husband_id]) {
          map[root.wife_husband_id].relation = root.gender === 'Nam' ? 'Vợ' : 'Chồng';
          map[root.wife_husband_id].generation = 0;
      }
      
      members.forEach(m => {
          if (m.id !== root.id && m.father_id && m.father_id === root.father_id) {
              m.relation = 'Anh/Chị/Em';
              m.generation = 0;
          }
      });

      return Object.values(map);
  };


  // --- 2. LOGIC XÂY CÂY ---
  const fetchAndBuildTree = async () => {
    setLoading(true);
    const { data: allMembers, error } = await supabase.from('members').select('*');
    if (error) { setLoading(false); return; }
    if (!allMembers) return;

    // Tính toán quan hệ trước khi xây cây
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

  useEffect(() => { fetchAndBuildTree(); }, [rootPersonId]); // Chạy lại khi đổi người Gốc

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
  const handleSave = async () => {
    if (!formData.fullName.trim()) return Alert.alert('Lỗi', 'Cần nhập tên');
    if (modalType === 'EDIT' && selectedMember) { await supabase.from('members').update({ full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio }).eq('id', selectedMember.id); finalizeAction('Cập nhật!'); }
    else if (modalType === 'ADD_CHILD' && selectedMember) {
        const fId = selectedMember.gender === 'Nam' ? selectedMember.id : selectedMember.wife_husband_id;
        const mId = selectedMember.gender === 'Nữ' ? selectedMember.id : selectedMember.wife_husband_id;
        await supabase.from('members').insert([{ full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio, father_id: fId, mother_id: mId }]); finalizeAction('Đã thêm con!');
    } else if (modalType === 'ADD_SPOUSE' && selectedMember) {
        const { data: nS } = await supabase.from('members').insert([{ full_name: formData.fullName, gender: formData.gender, birth_date: formData.birthDate || null, bio: formData.bio, wife_husband_id: selectedMember.id }]).select().single();
        if (nS) { await supabase.from('members').update({ wife_husband_id: nS.id }).eq('id', selectedMember.id); finalizeAction('Kết duyên!'); }
    }
  };

  const handleSetRoot = () => {
      if(selectedMember) {
          setRootPersonId(selectedMember.id);
          Alert.alert("Đã đặt làm Gốc", `Cây gia phả sẽ hiển thị quan hệ dựa trên góc nhìn của "${selectedMember.full_name}" (Hiển thị 3 đời).`);
          setModalType(null);
      }
  };

  // --- COMPONENT VẼ CÂY ---
  const TreeNode = ({ node, isFirst, isLast, isRoot }: { node: Member, isFirst?: boolean, isLast?: boolean, isRoot?: boolean }) => {
    
    // Logic lọc hiển thị 3 đời:
    // Nếu có RootPersonId, chỉ hiển thị những người có generation từ -2 đến 2
    // Hoặc nếu không có generation (người ngoài nhánh) thì có thể ẩn hoặc làm mờ.
    const shouldShow = !rootPersonId || (node.generation !== undefined && Math.abs(node.generation) <= 2);
    
    // Nếu không nằm trong phạm vi 3 đời -> Render null (Ẩn luôn) hoặc render mờ
    // Ở đây Tèo chọn cách vẫn render cấu trúc nhưng làm mờ để giữ layout cây không bị vỡ
    const opacity = shouldShow ? 1 : 0.3;

    const allChildren = [...(node.children || [])];
    if (node.spouse && node.spouse.children) {
        node.spouse.children.forEach(sc => { if(!allChildren.find(c => c.id === sc.id)) allChildren.push(sc); });
    }

    return (
      <View style={[styles.nodeWrapper, {opacity}]}>
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
                  node.id === rootPersonId && { borderWidth: 2, borderColor: '#EF4444' } // Viền đỏ nếu là Gốc
              ]} 
              onPress={() => { setSelectedMember(node); setModalType('DETAIL'); }}
            >
              <View>
                 <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                    <Ionicons name={node.gender === 'Nam' ? 'man' : 'woman'} size={12} color={node.gender === 'Nam' ? '#0369A1' : '#BE185D'} />
                    <Text style={styles.nameText} numberOfLines={1}>{node.full_name}</Text>
                 </View>
                 {/* HIỂN THỊ QUAN HỆ */}
                 {node.relation && (
                     <Text style={{fontSize: 9, color: '#DC2626', fontWeight: 'bold', textAlign: 'center'}}>{node.relation}</Text>
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
                         <Text style={{fontSize: 9, color: '#DC2626', fontWeight: 'bold', textAlign: 'center'}}>{node.spouse.relation}</Text>
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
      <Text style={[styles.title, { color: colors.text }]}>Gia Phả Chính Thống</Text>
      <Text style={{textAlign: 'center', color: '#666', fontSize: 12, marginBottom: 10}}>
          {rootPersonId ? 'Đang xem quan hệ với: Người được chọn (Viền đỏ)' : 'Chọn một người -> "Đặt làm Gốc" để xem quan hệ'}
      </Text>

      {loading ? ( <ActivityIndicator size="large" style={{marginTop: 50}} /> ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} horizontal>
          <ScrollView contentContainerStyle={styles.scrollContent}>
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
                    {selectedMember.relation && <Text style={{color: '#DC2626', fontWeight: 'bold', marginTop: 5}}>Quan hệ: {selectedMember.relation}</Text>}
                </View>

                {/* NÚT ĐẶT LÀM GỐC */}
                <TouchableOpacity style={[styles.menuItem, {backgroundColor: '#FEF3C7', marginBottom: 15, borderWidth: 1, borderColor: '#F59E0B'}]} onPress={handleSetRoot}>
                    <Text style={{color: '#D97706', fontWeight: 'bold'}}>★ Đặt làm Gốc (Xem quan hệ)</Text>
                </TouchableOpacity>

                <View style={styles.menuGrid}>
                  <TouchableOpacity style={[styles.menuItem, {backgroundColor: '#DCFCE7'}]} onPress={() => { setFormData({fullName:'', gender:'Nam', birthDate:'', bio:''}); setModalType('ADD_CHILD'); }}><Text style={{color: '#16A34A'}}>+ Con</Text></TouchableOpacity>
                  {!selectedMember.wife_husband_id ? (
                    <TouchableOpacity style={[styles.menuItem, {backgroundColor: '#FCE7F3'}]} onPress={() => { setFormData({fullName:'', gender: selectedMember.gender === 'Nam' ? 'Nữ' : 'Nam', birthDate:'', bio:''}); setModalType('ADD_SPOUSE'); }}><Text style={{color: '#DB2777'}}>+ Vợ/Chồng</Text></TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.menuItem, {borderWidth: 1, borderColor: '#DB2777'}]} onPress={handleDivorce}><Text style={{color: '#DB2777', fontSize: 10}}>Ly hôn</Text></TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={{alignItems:'center', padding:10}} onPress={() => setModalType(null)}><Text style={{color: 'gray'}}>Đóng</Text></TouchableOpacity>
              </>
            ) : (
               <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Thông Tin</Text>
                <TextInput style={[styles.input, {color: colors.text, borderColor: colors.border}]} placeholder="Họ tên" value={formData.fullName} onChangeText={(t)=>setFormData({...formData, fullName: t})} />
                <View style={{flexDirection:'row', marginBottom:15}}>
                    <TextInput style={[styles.input, {flex:1, marginRight:10, color:colors.text, borderColor:colors.border}]} placeholder="Ngày sinh" value={formData.birthDate} onChangeText={(t)=>setFormData({...formData, birthDate: t})} />
                    <TouchableOpacity onPress={()=>setFormData({...formData, gender:'Nam'})} style={[styles.genderBtn, formData.gender==='Nam' && {backgroundColor:'#E0F2FE'}]}><Text>Nam</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setFormData({...formData, gender:'Nữ'})} style={[styles.genderBtn, formData.gender==='Nữ' && {backgroundColor:'#FCE7F3'}]}><Text>Nữ</Text></TouchableOpacity>
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
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 50, marginBottom: 5 },
  scrollContent: { padding: 40, alignItems: 'flex-start' },
  nodeWrapper: { alignItems: 'center' },
  coupleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  mainMemberContainer: { alignItems: 'center', width: CARD_WIDTH, zIndex: 10 },
  spouseContainer: { flexDirection: 'row', alignItems: 'center', height: CARD_HEIGHT },
  connector: { width: SPACING, height: 2, backgroundColor: '#9CA3AF' },
  ghostSpouse: { width: CARD_WIDTH + SPACING, height: CARD_HEIGHT },
  memberCard: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', paddingHorizontal: 4 },
  nameText: { fontWeight: 'bold', fontSize: 11, marginLeft: 4, flexShrink: 1, textAlign: 'center', maxWidth: 75 },
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
  menuGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  menuItem: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  genderBtn: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginLeft: 5 },
  saveBtn: { backgroundColor: '#4F46E5', padding: 12, borderRadius: 8, alignItems: 'center' },
  rootBtn: { backgroundColor: '#4F46E5', padding: 15, borderRadius: 10 }
});