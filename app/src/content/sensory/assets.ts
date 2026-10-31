import manifest from '../../../assets/images/sensory_story_assets/manifest.json';
export type WordId = 'sun' | 'moon' | 'tiger' | 'hat' | 'pouch' | 'stick' | 'crow' | 'pitcher' | 'stone';
export const frames: Record<WordId, number[]> = {
  sun: [require('../../../assets/images/sensory_story_assets/story_01_sun_moon/sun/sun_01.png'), require('../../../assets/images/sensory_story_assets/story_01_sun_moon/sun/sun_02.png')],
  moon: [require('../../../assets/images/sensory_story_assets/story_01_sun_moon/moon/moon_01.png'), require('../../../assets/images/sensory_story_assets/story_01_sun_moon/moon/moon_02.png'), require('../../../assets/images/sensory_story_assets/story_01_sun_moon/moon/moon_03.png'), require('../../../assets/images/sensory_story_assets/story_01_sun_moon/moon/moon_04.png')],
  tiger: [require('../../../assets/images/sensory_story_assets/story_01_sun_moon/tiger/tiger_01.png'), require('../../../assets/images/sensory_story_assets/story_01_sun_moon/tiger/tiger_02.png'), require('../../../assets/images/sensory_story_assets/story_01_sun_moon/tiger/tiger_03.png')],
  hat: [require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/hat/hat_01.png'), require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/hat/hat_02.png')],
  pouch: [require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/pouch/pouch_01.png'), require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/pouch/pouch_02.png'), require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/pouch/pouch_03.png'), require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/pouch/pouch_04.png')],
  stick: [require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/stick/stick_01.png'), require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/stick/stick_02.png'), require('../../../assets/images/sensory_story_assets/story_02_dokkaebi/stick/stick_03.png')],
  crow: [require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/crow/crow_01.png'), require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/crow/crow_02.png')],
  pitcher: [require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/pitcher/pitcher_01.png'), require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/pitcher/pitcher_02.png'), require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/pitcher/pitcher_03.png'), require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/pitcher/pitcher_04.png')],
  stone: [require('../../../assets/images/sensory_story_assets/story_03_crow_pitcher/stone/stone_01.png')],
};
export const words = manifest.words;
export const stories = [1, 2, 3].map(id => ({ id, title: words.find(w => w.story_id === id)!.story_title, words: words.filter(w => w.story_id === id) }));
