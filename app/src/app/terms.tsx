// 이용약관 · 개인정보 처리 안내 (웹 데모·APK 공통) — 담당: 태희
// 실제로 저장·전송하는 것만 적음 (CLAUDE.md 개인정보 규칙: 얼굴 영상 저장 안 함, 건강 정보·실제 부모-아이 대화 안 받음)
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { Button } from '@/components/ui';
import { useDevice } from '@/lib/layout';
import { goBack } from '@/lib/nav';
import { C } from '@/theme';

const UPDATED = '2026년 11월 1일';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. 서비스 소개',
    body: [
      '아이맘은 InThon 2026 해커톤 19팀이 만든 시연용 서비스예요. 맞벌이 부모가 고른 캐릭터 아바타가 부모 목소리와 말투로 2~5세 아이와 짧은 놀이 대화를 하고, 부모는 저녁에 리포트를 보고 다음 날 대화를 정해요.',
      '심사·시연을 위한 서비스라 예고 없이 기능이 바뀌거나 운영이 끝날 수 있어요. 의료·보육 서비스를 대신하지 않아요.',
    ],
  },
  {
    title: '2. 이용 대상과 보호자 동의',
    body: [
      '가입은 만 14세 이상 보호자만 할 수 있어요. 아이 화면은 보호자가 가입하고 동의한 뒤, 보호자가 연결한 기기에서만 열려요.',
      '보호자는 가입 마지막 단계에서 (1) 부모 목소리·입모양 수치 사용, (2) 아이 반응 기록에 각각 동의해요. 동의하지 않으면 가입을 마칠 수 없어요.',
    ],
  },
  {
    title: '3. 모으는 정보',
    body: [
      '계정: 아이디, 비밀번호(암호화해서 저장), 부모 PIN(암호화).',
      '아이 소개: 이름 또는 별명, 태어난 해·달, 말하기 수준, 좋아하는 것 카테고리.',
      '부모 아바타: 고른 캐릭터 모양, 호칭·말투, 문장을 읽은 목소리 녹음, 입 벌림 수치. 얼굴 사진·영상은 저장하지 않아요. 카메라 화면은 기기 안에서만 입모양 수치를 계산해요.',
      '아이 반응: 아이 화면에서 아바타와 놀 때의 말소리 토막, 터치·바라봄·웃음 같은 반응 횟수.',
      '받지 않는 정보: 건강·질병 정보, 싫어하는 것, 실제 부모와 아이의 대화.',
    ],
  },
  {
    title: '4. 정보를 쓰는 곳',
    body: [
      '부모 목소리로 아바타가 말하게 하고, 입 움직임을 부모 입모양 크기에 맞추는 데 써요.',
      '아이 말소리를 글자로 바꿔 따라 말하기를 확인하고, 하루 감각 리포트(시각·청각·촉각)와 "확인해 줄 점"을 만드는 데 써요.',
      '광고, 판매, 다른 목적의 분석에는 쓰지 않아요.',
    ],
  },
  {
    title: '5. 다른 회사에 보내는 정보',
    body: [
      'Groq: 아이 말소리와 부모 녹음을 글자로 바꾸는 데 음성 파일을 보내요.',
      'Fish Audio: 아바타가 부모 목소리로 말하도록 부모 녹음과 말할 문장을 보내요.',
      'Lablup Token Factory: 아바타의 다음 말을 만들 때 아이가 한 말(글자)과 짧은 대화 맥락을 보내요. 이름 외의 계정 정보는 보내지 않아요.',
      'Render(싱가포르 지역 서버): 위 정보를 저장하는 서버를 운영해요.',
    ],
  },
  {
    title: '6. 보관 기간과 지우기',
    body: [
      '정보는 해커톤 심사 기간 동안만 보관하고, 심사가 끝나면 서버의 데이터를 모두 지워요.',
      '부모 앱 설정의 "이 기기 기록 지우기"로 기기에 저장된 정보를 지울 수 있어요. 서버에 저장된 정보 삭제를 원하면 아래 문의처로 알려 주세요.',
    ],
  },
  {
    title: '7. 아이를 위한 안전 원칙',
    body: [
      '아바타는 정해진 학습 범위 안에서만 말하고, 모르는 질문은 지어내지 않고 부모 확인 목록에 남겨요.',
      '"아파" 같은 위험 신호는 판단하지 않고 기록해서 부모에게 알려요. 아이에게 틀렸다는 표시는 하지 않아요.',
      '진동·소리·움직임은 짧고 약하게 쓰고, 설정에서 끌 수 있어요.',
    ],
  },
  {
    title: '8. 책임의 한계',
    body: [
      '시연용 서비스라 연결 상태나 외부 서비스 사정에 따라 일부 기능이 멈출 수 있어요. 아이를 돌보는 일은 언제나 보호자가 직접 해 주세요.',
    ],
  },
  {
    title: '9. 문의',
    body: ['InThon 2026 19팀 아이맘 — 저장소: github.com/InThon-Team19/ai-mom'],
  },
];

export default function Terms() {
  const { frame } = useDevice();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 32, gap: 18 }, frame]}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.text }}>이용약관 · 개인정보 처리 안내</Text>
          <Text style={{ fontSize: 13, color: C.sub }}>시행일 {UPDATED}</Text>
        </View>
        {SECTIONS.map((s) => (
          <View key={s.title} style={{ gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{s.title}</Text>
            {s.body.map((b) => (
              <Text key={b} style={{ fontSize: 14, lineHeight: 22, color: C.text }}>
                {b}
              </Text>
            ))}
          </View>
        ))}
        <Button label="돌아가기" onPress={() => goBack('/')} />
      </ScrollView>
    </SafeAreaView>
  );
}
