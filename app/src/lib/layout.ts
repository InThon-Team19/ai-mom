// 기기별 화면 크기 기준 (폰 / 태블릿) — 담당: 태희
// 폰: 화면 폭에 맞춤. 태블릿: 가운데 정렬 + 최대 폭 제한 (가로가 넓어 카드·카메라가 지나치게 커지지 않게)
import { useWindowDimensions } from 'react-native';

export const TABLET_MIN = 600; // 짧은 변이 이 이상이면 태블릿

export function useDevice() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN;
  const landscape = width > height;
  const maxContent = isTablet ? 640 : width;
  const contentWidth = Math.min(width - 48, maxContent - 48 > 0 ? maxContent : width - 48);
  // 카메라 상자: 폭은 내용 폭(태블릿은 최대 520), 높이는 4:3 이되 화면 높이의 일정 비율을 넘지 않게
  const camW = isTablet ? Math.min(520, contentWidth) : contentWidth;
  const camH = Math.round(Math.max(180, Math.min(camW * 0.75, height * (landscape ? 0.34 : 0.32))));
  return {
    width,
    height,
    isTablet,
    landscape,
    contentWidth,
    /** 화면 좌우 여백: 폰 24, 태블릿은 내용이 가운데 640 폭 안에 오도록 넓게 */
    gutter: isTablet ? Math.max(24, Math.round((width - 640) / 2)) : 24,
    /** 스크롤 내용·카드를 감쌀 때: 태블릿에서 가운데 정렬 + 최대 폭 */
    frame: { width: '100%' as const, maxWidth: maxContent, alignSelf: 'center' as const },
    camera: { width: camW, height: camH, alignSelf: 'center' as const },
  };
}
