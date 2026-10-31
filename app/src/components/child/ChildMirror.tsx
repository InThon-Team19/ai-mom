// 아이 얼굴 거울 + 입모양 선 — 담당: 태희
// 평소: 작고 흐린 센서(응시·웃음·입 벌림 기록). 따라 말하기 때(big): 크게 보이며 아이 입 윤곽선이 연두색 선으로 따라 움직임
// 영상은 기기 안에서만 처리 (저장·전송 안 함). 선은 이 컴포넌트 안에서만 다시 그림 (학습 화면 전체 재렌더 방지)
import { memo, useCallback, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { FaceSensor } from '@/components/child/kit';
import type { FaceFrame } from '@/components/FaceTracker';
import { C, R } from '@/theme';

const SMALL = { width: 72, height: 54 };
const BIG = { width: 220, height: 165 };

export const ChildMirror = memo(function ChildMirror({ onFrame, big }: { onFrame: (f: FaceFrame) => void; big: boolean }) {
  const [lips, setLips] = useState<[number, number][] | null>(null);
  const [open, setOpen] = useState(false);
  const size = big ? BIG : SMALL;

  const handle = useCallback(
    (f: FaceFrame) => {
      onFrame(f);
      if (big) {
        setLips(f.face && f.lips && f.lips.length > 2 ? f.lips : null);
        setOpen(f.mouthOpen);
      }
    },
    [onFrame, big],
  );

  const pts = lips?.map(([x, y]) => `${(x * size.width).toFixed(1)},${(y * size.height).toFixed(1)}`).join(' ');
  return (
    <View
      style={{
        ...size,
        borderRadius: big ? R.md : 12,
        overflow: 'hidden',
        opacity: big ? 1 : 0.45,
        borderWidth: big ? 3 : 0,
        borderColor: lips ? C.green : C.primaryStrong,
      }}>
      <FaceSensor onFrame={handle} style={{ ...size }} />
      {big && pts && (
        <Svg width={size.width} height={size.height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Polygon points={pts} fill={open ? 'rgba(181,217,107,0.25)' : 'none'} stroke={C.green} strokeWidth={2.5} strokeLinejoin="round" />
          {lips!.map(([x, y], i) => (
            <Circle key={i} cx={x * size.width} cy={y * size.height} r={1.8} fill={C.white} />
          ))}
        </Svg>
      )}
    </View>
  );
});
