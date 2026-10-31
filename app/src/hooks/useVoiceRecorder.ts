// 마이크 녹음 (부모 목소리 샘플, 아이 따라 말하기 공통) — 담당: 태희
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback } from 'react';
import { Platform } from 'react-native';

export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted)
      throw new Error(
        Platform.OS === 'web'
          ? '마이크를 쓸 수 있게 허용해 주세요. 주소창 왼쪽 자물쇠 아이콘에서 이 사이트의 마이크 권한을 켜면 돼요.'
          : '마이크를 쓸 수 있게 허용해 주세요. 휴대폰 설정에서 이 앱의 마이크 권한을 켜면 돼요.',
      );
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  /** 녹음 종료 → 파일 uri */
  const stop = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri;
  }, [recorder]);

  return {
    start,
    stop,
    isRecording: state.isRecording,
    seconds: (state.durationMillis ?? 0) / 1000,
    metering: state.metering, // dB (음량 바 표시용)
  };
}
