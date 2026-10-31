// 아이 목소리: 오늘 자동 녹음된 말소리 클립 목록 + 재생 (한 번에 하나만) — 담당: 태희
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ITEMS } from '@/content/curriculum';
import { api } from '@/lib/api';
import type { ChildClip } from '@/lib/types';
import { C, R, T } from '@/theme';

const time = (at: number) => {
  const d = new Date(at * 1000); // 서버 at = 초 단위
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const itemLabel = (id: string) => {
  const it = (ITEMS as Record<string, { ko: string; emoji: string } | undefined>)[id];
  return it ? `${it.emoji} ${it.ko}` : id;
};

export function ClipList({ childId, clips, state }: { childId: string; clips: ChildClip[]; state: 'loading' | 'ok' | 'fail' }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 끝나면 자동으로 재생 표시가 꺼지게 상태에서 바로 계산 (로딩 중엔 재생 중으로 봄)
  const isActive = (id: string) =>
    playingId === id && !status.didJustFinish && (status.playing || status.isBuffering || !status.isLoaded);

  const toggle = async (clip: ChildClip) => {
    setError(null);
    try {
      if (isActive(clip.id)) {
        player.pause();
        setPlayingId(null);
        return;
      }
      player.pause();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      player.replace(await api.childClipSource(childId, clip.id));
      player.play();
      setPlayingId(clip.id);
    } catch {
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
          <View
            key={c.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 10,
              borderRadius: R.md,
              backgroundColor: c.alert ? C.white : active ? C.primarySoft : C.card,
              borderWidth: c.alert ? 1.5 : 0,
              borderColor: C.warn,
            }}
          >
            <Pressable
              onPress={() => void toggle(c)}
              accessibilityRole="button"
              accessibilityLabel={active ? '멈추기' : '듣기'}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 18, color: C.onPrimary, fontWeight: '800' }}>{active ? '❚❚' : '▶'}</Text>
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={T.small}>
                {time(c.at)}
                {c.item ? ` · ${itemLabel(c.item)}` : ''}
                {c.duration_s ? ` · ${c.duration_s.toFixed(1)}초` : ''}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.alert ? C.warn : C.text }}>
                {c.alert ? '⚠ ' : ''}
                {c.text ? `"${c.text}"` : '(말소리)'}
                {c.matched ? <Text style={{ color: C.ok }}>{'  ✓'}</Text> : null}
              </Text>
            </View>
          </View>
        );
      })}
      {error && <Text style={{ fontSize: 13, color: C.warn }}>{error}</Text>}
    </View>
  );
}
