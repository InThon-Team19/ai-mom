// 아이 카메라 → 주기적으로 프레임을 서버에 보내 얼굴·응시·입 벌림 받기 — 담당: 태희
import type { CameraView } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import type { ChildFrameOut } from '@/lib/types';

export function useChildSensing(camera: React.RefObject<CameraView | null>, enabled: boolean, intervalMs = 1500) {
  const [latest, setLatest] = useState<ChildFrameOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(async () => {
      if (busy.current || !camera.current) return;
      busy.current = true;
      try {
        const pic = await camera.current.takePictureAsync({ quality: 0.4, shutterSound: false });
        setLatest(await api.childFrame(pic.uri));
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        busy.current = false;
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [camera, enabled, intervalMs]);

  return { latest, error };
}
