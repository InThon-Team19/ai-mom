import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar, AVATAR_OPTIONS, type AvatarCategory, type AvatarConfig } from './Avatar';
import { FamilyAvatar } from './FamilyAvatar';
import { Text } from './AppText';
import { Chip } from './ui';
import { PORTRAITS } from '@/lib/portraitAssets';
import { PORTRAIT_OPTIONS, portraitSelection, type PortraitId } from '@/lib/portraitConfig';
import { C } from '@/theme';

const categories: { key: AvatarCategory; label: string }[] = [
  { key: 'face', label: '얼굴형' }, { key: 'hair', label: '머리' }, { key: 'eyes', label: '눈' },
  { key: 'outfit', label: '옷' }, { key: 'color', label: '피부색' },
];
export function ParentAppearancePicker({ config, onChange, title }: { config: AvatarConfig; onChange: (config: AvatarConfig) => void; title?: string }) {
  const [category, setCategory] = useState<AvatarCategory>('hair');
  const illustrated = config.style === 'illustration';
  const selection = portraitSelection(config, title);
  const chooseStyle = (style: 'svg' | 'illustration') => onChange({ ...config, style, portrait: selection });
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Chip label="일러스트" selected={illustrated} onPress={() => chooseStyle('illustration')} />
      <Chip label="기존 캐릭터" selected={!illustrated} onPress={() => chooseStyle('svg')} />
    </View>
    <View style={{ alignItems: 'center', backgroundColor: C.primarySoft, borderRadius: 20, minHeight: 242 }}>
      <FamilyAvatar config={config} size={220} expression="neutral" />
    </View>
    {illustrated ? <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['mother', 'father'] as const).map(character => <Chip key={character} label={character === 'mother' ? '엄마' : '아빠'} selected={selection.character === character}
          onPress={() => onChange({ ...config, portrait: { ...selection, character } })} />)}
      </View>
      {(['hair', 'outfit'] as const).map(key => <View key={key} style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{key === 'hair' ? '머리' : '옷'}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {PORTRAIT_OPTIONS[selection.character][key].map((label, index) => {
            const choice = { ...selection, [key]: index as 0 | 1 };
            const id: PortraitId = `${choice.character}-${choice.hair}-${choice.outfit}`;
            const selected = selection[key] === index;
            return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onChange({ ...config, portrait: choice })}
              style={{ flex: 1, alignItems: 'center', borderWidth: 2, borderColor: selected ? C.primaryStrong : C.border, borderRadius: 16, backgroundColor: C.white, padding: 8 }}>
              <Image source={PORTRAITS[id].normal.neutral} style={{ width: 104, height: 104 }} contentFit="contain" transition={0} />
              <Text style={{ color: C.text, fontSize: 13, fontWeight: selected ? '700' : '400' }}>{label}</Text>
            </Pressable>;
          })}
        </View>
      </View>)}
    </> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categories.map(cat => <Chip key={cat.key} label={cat.label} selected={category === cat.key} onPress={() => setCategory(cat.key)} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AVATAR_OPTIONS[category].map((label, index) => <Pressable key={`${category}-${index}`} accessibilityRole="button"
          accessibilityLabel={category === 'color' ? `피부색 ${index + 1}` : label} accessibilityState={{ selected: config[category] === index }}
          onPress={() => onChange({ ...config, [category]: index })}
          style={{ width: '22%', minHeight: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: config[category] === index ? C.primaryStrong : C.border, backgroundColor: C.white }}>
          {category === 'color' ? <Avatar config={{ ...config, [category]: index }} size={48} blink={false} /> : <Text style={{ color: C.text, fontSize: 12 }}>{label}</Text>}
        </Pressable>)}
      </View>
    </>}
  </View>;
}
