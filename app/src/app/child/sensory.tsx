import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { frames, stories, type WordId } from '@/content/sensory/assets';
import { stopSound } from '@/content/sensory/feedback';
import { SensoryToy } from '@/components/sensory/SensoryToy';
import { ChunkyButton, K, SOFT2, useKid } from '@/components/child/design';
import { Text } from '@/components/AppText';

export default function SensoryStories() {
  const { cards } = useLocalSearchParams<{ cards?: string }>();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // 크기: 다른 아이 화면처럼 보드(1180x820) 비율로 키움 (폰 가로에선 예전 크기가 최소)
  const { u, f, width, height } = useKid();
  const btn = { height: u(60, 48), fontSize: f(22, 16) };
  const titleSize = { fontSize: f(30, 22) };
  const story = stories.find(s => String(s.id) === cards);
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); stopSound(); }; }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { setForeground(value === 'active'); if (value !== 'active') stopSound(); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    void Asset.loadAsync(Object.values(frames).flat()).then(() => { if (alive) setReady(true); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaView style={[styles.screen, { padding: u(28, 12) }]}>
    <View style={[styles.header, { gap: u(16, 12), paddingBottom: u(16, 12) }]}>
      <ChunkyButton {...btn} label={story ? '‹ 동화 고르기' : '‹ 돌아가기'} onPress={() => story ? router.setParams({ cards: '' }) : router.back()} />
      <Text style={[styles.title, titleSize]}>{story?.title ?? '동화 고르기'}</Text>
    </View>
    {!story && <Text style={[styles.section, { fontSize: f(22, 18), marginBottom: u(12, 8) }]}>동화를 듣고 단어 카드로 놀아요</Text>}
    {!ready ? <View style={styles.center}><Text style={[styles.title, titleSize]}>{failed ? '그림을 불러오지 못했어요. 다시 들어와 주세요.' : '동화 그림을 준비하고 있어요…'}</Text></View>
      : !story ? <View style={[styles.items, { gap: u(20, 12), flexDirection: width > height ? 'row' : 'column' }]}>
        {stories.map(s => <Pressable key={s.id} style={[styles.choice, { padding: u(16, 12), borderRadius: u(32, 24) }]} accessibilityRole="button" onPress={() => router.push({ pathname: '/child/story', params: { storyId: String(s.id) } })}>
          <Image source={frames[s.words[0].word_id as WordId][0]} contentFit="contain" style={{ flex: 1, width: '100%' }} />
          <Text style={[styles.title, titleSize]}>{s.title}</Text>
        </Pressable>)}
      </View> : <View style={[styles.items, { gap: u(20, 12), flexDirection: width > height ? 'row' : 'column' }]}>
        {focused && foreground && story.words.map(word => <SensoryToy key={`${story.id}-${word.word_id}`} id={word.word_id as WordId} label={word.word_ko} />)}
      </View>}
  </SafeAreaView></GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 12, backgroundColor: K.bg },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 12 },
  section: { color: K.sub, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: K.ink, textAlign: 'center' },
  items: { flex: 1, gap: 12 },
  choice: { flex: 1, minHeight: 100, backgroundColor: K.white, boxShadow: SOFT2, borderRadius: 24, padding: 12, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
