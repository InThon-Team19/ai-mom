// 모드 선택 (부모 / 아이) + 서버 주소 설정 — 화면 디자인은 민철 와이어프레임 나오면 교체
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { loadApiUrl, saveApiUrl } from '@/lib/config';

const LINKS = [
  ['/parent/onboarding', '가입 1 배경 정보'],
  ['/parent/avatar', '가입 2 아바타'],
  ['/parent/voice', '가입 3 목소리'],
  ['/parent/mouth', '가입 4 입모양'],
  ['/parent/persona', '가입 5 페르소나'],
  ['/parent/evening', '밤: 대화 확인'],
  ['/parent/plan-read', '밤: 계획 낭독'],
  ['/child', '아이 모드'],
] as const;

export default function Home() {
  const [server, setServer] = useState('확인 중...');
  const [url, setUrl] = useState('');

  const check = useCallback(() => {
    setServer('확인 중...');
    api.health().then(() => setServer('연결됨')).catch(() => setServer('연결 실패'));
  }, []);

  useEffect(() => {
    loadApiUrl().then((u) => {
      setUrl(u);
      check();
    });
  }, [check]);

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, gap: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>아이봄</Text>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} style={{ fontSize: 18, paddingVertical: 6 }}>
          {label}
        </Link>
      ))}

      <View style={{ gap: 6, marginTop: 'auto' }}>
        <Text style={{ color: '#888' }}>서버: {server}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://노트북IP:8000"
            style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 }}
          />
          <Pressable
            onPress={async () => {
              setUrl(await saveApiUrl(url));
              check();
            }}
            style={{ paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#208AEF', borderRadius: 8 }}>
            <Text style={{ color: 'white' }}>저장</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
