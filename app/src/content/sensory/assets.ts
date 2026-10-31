import manifest from '../../../assets/images/sensory_story_assets/manifest.json';
export type WordId = 'sun' | 'moon' | 'tiger' | 'hat' | 'pouch' | 'stick' | 'crow' | 'pitcher' | 'stone';
export const frames: Record<WordId, number[]> = {
  sun: [require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/sun/sun_01.png'), require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/sun/sun_02.png')],
  moon: [require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/moon/moon_01.png'), require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/moon/moon_02.png'), require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/moon/moon_03.png'), require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/moon/moon_04.png')],
  tiger: [require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/tiger/tiger_01.png'), require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/tiger/tiger_02.png'), require('../../../assets/images/sensory_story_assets/story_01_햇님과달님/tiger/tiger_03.png')],
  hat: [require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/hat/hat_01.png'), require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/hat/hat_02.png')],
  pouch: [require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/pouch/pouch_01.png'), require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/pouch/pouch_02.png'), require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/pouch/pouch_03.png'), require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/pouch/pouch_04.png')],
  stick: [require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/stick/stick_01.png'), require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/stick/stick_02.png'), require('../../../assets/images/sensory_story_assets/story_02_도깨비이야기/stick/stick_03.png')],
  crow: [require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/crow/crow_01.png'), require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/crow/crow_02.png')],
  pitcher: [require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/pitcher/pitcher_01.png'), require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/pitcher/pitcher_02.png'), require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/pitcher/pitcher_03.png'), require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/pitcher/pitcher_04.png')],
  stone: [require('../../../assets/images/sensory_story_assets/story_03_까마귀와물주전자/stone/stone_01.png')],
};
export const words = manifest.words;
export const stories = [1, 2, 3].map(id => ({ id, title: words.find(w => w.story_id === id)!.story_title, words: words.filter(w => w.story_id === id) }));
