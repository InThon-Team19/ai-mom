/** Optional extension of the existing numeric AvatarConfig. Old profiles stay SVG. */
export type PortraitSelection = { version: 1; character: 'mother' | 'father'; hair: 0 | 1; outfit: 0 | 1 };
export type PortraitConfig = { style?: 'svg' | 'illustration'; portrait?: PortraitSelection };
export type PortraitId = `${'mother' | 'father'}-${0 | 1}-${0 | 1}`;

export function portraitSelection(config?: PortraitConfig, title?: string): PortraitSelection {
  const p = config?.portrait;
  return {
    version: 1,
    character: p?.character === 'father' || p?.character === 'mother' ? p.character : title === '아빠' ? 'father' : 'mother',
    hair: p?.hair === 1 ? 1 : 0,
    outfit: p?.outfit === 1 ? 1 : 0,
  };
}
export function portraitId(config?: PortraitConfig, title?: string): PortraitId | null {
  if (config?.style !== 'illustration') return null;
  const p = portraitSelection(config, title);
  return `${p.character}-${p.hair}-${p.outfit}`;
}
export function mouthCalibration(scale = 1): 'normal' | 'small' | 'large' {
  return scale < .9 ? 'small' : scale > 1.1 ? 'large' : 'normal';
}
export const PORTRAIT_OPTIONS = {
  mother: { hair: ['단발', '묶은 머리'], outfit: ['피치 티셔츠', '크림 카디건'] },
  father: { hair: ['가르마', '짧은 웨이브'], outfit: ['크림 티셔츠', '세이지 셔츠'] },
} as const;
