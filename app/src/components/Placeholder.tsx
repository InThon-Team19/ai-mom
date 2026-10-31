// 빈 화면 표시용 — 각 화면 구현하면서 지우기
import { Text, View } from 'react-native';

export function Placeholder({ title, owner }: { title: string; owner: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: '#888' }}>TODO · 담당 {owner}</Text>
    </View>
  );
}
