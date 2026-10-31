// 아이 목소리: 오늘 자동 녹음된 말소리 클립 목록 + 재생 (한 번에 하나만) — 담당: 태희
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { ITEMS } from '@/content/curriculum';
import { api } from '@/lib/api';
import type { ChildClip } from '@/lib/types';
import { C, R, T } from '@/theme';
import { Text } from '@/components/AppText';

const time = (at: number) => {
  const d = new Date(at * 1000); // 서버 at = 초 단위
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const itemLabel = (id: string) => {
  const it = (ITEMS as Record<string, { ko: string } | undefined>)[id];
  return it ? `${it.ko} 놀이` : id;
};

export function ClipList({ childId, clips, state }: { childId: string; clips: ChildClip[]; state: 'loading' | 'ok' | 'fail' }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useFocusEffect(useCallback(() => () => {
    request.current++;
    player.pause();
    setPlayingId(null);
  }, [player]));

  // 끝나면 자동으로 재생 표시가 꺼지게 상태에서 바로 계산 (로딩 중엔 재생 중으로 봄)
  const isActive = (id: string) =>
    playingId === id && !status.didJustFinish && (status.playing || status.isBuffering || !status.isLoaded);

  const toggle = async (clip: ChildClip) => {
    const current = ++request.current;
    setError(null);
    try {
      if (isActive(clip.id)) {
        player.pause();
        setPlayingId(null);
        return;
      }
      player.pause();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      if (current !== request.current) return;
      const source = await api.childClipSource(childId, clip.id);
      if (current !== request.current) return;
      player.replace(source);
      player.play();
      setPlayingId(clip.id);
    } catch {
      if (current !== request.current) return;
      setPlayingId(null);
      setError('재생하지 못했어요. 서버 연결을 확인해 주세요.');
    }
  };

  if (state === 'loading') return <Text style={T.sub}>불러오는 중...</Text>;
  if (state === 'fail') return <Text style={T.sub}>녹음 목록을 불러오지 못했어요.</Text>;
  if (!clips.length) return <Text style={T.sub}>오늘 녹음된 목소리가 없어요</Text>;

  return (
    <View style={{ gap: 8 }}>
      {clips.map((c) => {
        const active = isActive(c.id);
        return (
          // 디자인 Recordings: 흰 카드 · 2px 연한 테두리 · 노랑 재생 원 · "말" · 놀이 · ✓ · 시각
          <View
            key={c.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: R.md,
              borderWidth: 2,
              borderColor: c.alert ? C.warn : active ? C.primaryStrong : C.border,
              backgroundColor: c.alert ? C.warnSoft : active ? C.primarySoft : C.white,
            }}>
            <Pressable
              onPress={() => void toggle(c)}
              accessibilityRole="button"
              accessibilityLabel={active ? '멈추기' : '재생'}
              hitSlop={6}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={12} height={12} viewBox="0 0 12 12">
                {active ? (
                  <>
                    <Rect x={2} y={1} width={3} height={10} rx={1} fill={C.text} />
                    <Rect x={7} y={1} width={3} height={10} rx={1} fill={C.text} />
                  </>
                ) : (
                  <Path d="M3 1 L11 6 L3 11 Z" fill={C.text} />
                )}
              </Svg>
            </Pressable>
            <Text style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: c.alert ? '700' : '400' }} numberOfLines={2}>
              {c.text ? `"${c.text}"` : '(말소리)'}
              {c.item ? ` · ${itemLabel(c.item)}` : ''}
              {c.duration_s ? <Text style={{ color: C.sub, fontSize: 12 }}>{` · ${c.duration_s.toFixed(1)}초`}</Text> : null}
            </Text>
            {c.matched ? <Text style={{ fontSize: 14, fontWeight: '700', color: '#3F6212' }}>✓</Text> : null}
            <Text style={{ fontSize: 12, color: C.sub }}>{time(c.at)}</Text>
          </View>
        );
      })}
      {error && <Text style={{ fontSize: 13, color: C.warn }}>{error}</Text>}
    </View>
  );
}
