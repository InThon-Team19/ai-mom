// 모드 선택 (부모 / 아이) — 서버 연결 확인용
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

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
  useEffect(() => {
    api.health().then(() => setServer('연결됨')).catch(() => setServer(`연결 실패 — ${API_URL}`));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, gap: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>아이봄</Text>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} style={{ fontSize: 18, paddingVertical: 6 }}>
          {label}
        </Link>
      ))}
      <Text style={{ color: '#888' }}>서버: {server}</Text>
    </SafeAreaView>
  );
}
