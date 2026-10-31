import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { frames, stories, type WordId } from '@/content/sensory/assets';
import { stopSound } from '@/content/sensory/feedback';
import { SensoryToy } from '@/components/sensory/SensoryToy';
import { ChunkyButton, K, SOFT2 } from '@/components/child/design';
import { dayOf } from '@/content/curriculum';
import { useProfile } from '@/lib/store';

export default function SensoryStories() {
  const profile = useProfile();
  const dailyStory = dayOf(profile?.day ?? 1).story;
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { width, height } = useWindowDimensions();
  const story = stories.find(s => s.id === selected);
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setSelected(null); stopSound(); }; }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { setForeground(value === 'active'); if (value !== 'active') stopSound(); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    void Asset.loadAsync(Object.values(frames).flat()).then(() => { if (alive) setReady(true); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <ChunkyButton height={48} fontSize={16} label={story ? '‹ 동화 고르기' : '‹ 돌아가기'} onPress={() => story ? setSelected(null) : router.back()} />
      <Text style={styles.title}>{story?.title ?? '동화 고르기'}</Text>
    </View>
    {!story && dailyStory && <View style={styles.daily}>
      <Text style={styles.dailyTitle}>오늘의 동화 · {dailyStory.title}</Text>
      <ChunkyButton height={48} fontSize={16} label="읽어줘" onPress={() => router.push('/child/story')} />
    </View>}
    {!story && <Text style={styles.section}>만지고 느끼는 동화</Text>}
    {!ready ? <View style={styles.center}><Text style={styles.title}>{failed ? '그림을 불러오지 못했어요. 다시 들어와 주세요.' : '동화 그림을 준비하고 있어요…'}</Text></View>
      : !story ? <View style={[styles.items, { flexDirection: width > height ? 'row' : 'column' }]}>
        {stories.map(s => <Pressable key={s.id} style={styles.choice} accessibilityRole="button" onPress={() => setSelected(s.id)}>
          <Image source={frames[s.words[0].word_id as WordId][0]} contentFit="contain" style={{ flex: 1, width: '100%' }} />
          <Text style={styles.title}>{s.title}</Text>
        </Pressable>)}
      </View> : <View style={[styles.items, { flexDirection: width > height ? 'row' : 'column' }]}>
        {focused && foreground && story.words.map(word => <SensoryToy key={`${story.id}-${word.word_id}`} id={word.word_id as WordId} label={word.word_ko} />)}
      </View>}
  </SafeAreaView></GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 12, backgroundColor: K.bg },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 12 },
  daily: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', backgroundColor: K.peach, borderRadius: 24, borderWidth: 2, borderColor: K.line, padding: 12, marginBottom: 12 },
  dailyTitle: { flexShrink: 1, color: K.ink, fontSize: 18, fontWeight: '800' },
  section: { color: K.sub, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: K.ink, textAlign: 'center' },
  items: { flex: 1, gap: 12 },
  choice: { flex: 1, minHeight: 100, backgroundColor: K.white, boxShadow: SOFT2, borderRadius: 24, padding: 12, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
