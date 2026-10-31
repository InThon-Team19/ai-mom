// 아이 얼굴 실시간 인식 (기기 안에서 0.05초마다) — 담당: 태희
// WebView 안에서 MediaPipe FaceLandmarker(웹)를 돌리고 결과를 RN 으로 보냄 → Expo Go 에서도 동작.
// 첫 실행 때 CDN 에서 wasm·모델(약 4MB)을 받으므로 인터넷 필요.
// 수치 계산식은 server/app/vision/landmarks.py 와 같음 (임계값 바꾸면 둘 다 수정)
// 기획 2-4 카메라 인식 화면용으로 입 둘레 좌표(lips)·얼굴 상자(box)·어두움(dark)도 같이 보냄 → FaceGuide 가 그림.
// 좌표는 화면에 보이는 미리보기 기준 0~1 (거울 반전·object-fit:cover 잘림까지 반영) → RN 에서 크기만 곱하면 됨.
// 표정(expr): blendshape 로 웃음·놀람·찡그림을 나눔 (기획 1-1 시각 반응 "표정 변화"). 앱에서만 쓰는 값 (서버 landmarks.py 엔 없음)
import { useCameraPermissions } from 'expo-camera';
import { createElement, memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/AppText';

export type FaceFrame = {
  face: boolean;
  looking: boolean;
  mouthOpen: boolean;
  open: number; // 입 벌림 (눈 사이 거리 대비)
  width: number; // 입 너비
  yaw: number;
  pitch: number;
  iris: number;
  smile: boolean; // 웃는 표정 (blendshape mouthSmile)
  fps: number;
  lips?: [number, number][]; // 입 바깥 윤곽 20점 (미리보기 기준 0~1, 순서대로 이으면 닫힌 고리)
  box?: { x: number; y: number; w: number; h: number }; // 얼굴 상자 (미리보기 기준 0~1)
  dark?: boolean; // 화면이 어두움 (1초마다 밝기 측정)
  expr?: FaceExpr; // 표정 (얼굴이 있을 때만)
};

export type FaceExpr = 'smile' | 'surprise' | 'frown' | 'neutral';

export type FaceTrackerProps = {
  onFrame: (f: FaceFrame) => void;
  onError?: (msg: string) => void;
  intervalMs?: number; // 기본 50ms = 초당 20회
  style?: ViewStyle;
  guide?: boolean; // 점선 얼굴 가이드 (입모양 촬영 화면)
};

const TASKS_VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

// MediaPipe Face Mesh 입술 바깥 고리 (아래 입술 → 위 입술 순서로 한 바퀴)
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

const html = (intervalMs: number) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}</style></head>
<body><video id="v" autoplay playsinline muted></video>
<script type="module">
const post = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
try {
  const { FaceLandmarker, FilesetResolver } = await import('${TASKS_VISION}/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks('${TASKS_VISION}/wasm');
  const make = (delegate) => FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '${MODEL}', delegate },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
  });
  let lm; try { lm = await make('GPU'); } catch { lm = await make('CPU'); }

  const v = document.getElementById('v');
  v.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false,
  });
  await v.play();
  post({ type: 'ready' });

  const d = (p, a, b) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
  const r = (x, lo, hi) => (hi !== lo ? (x - lo) / (hi - lo) : 0.5);
  let last = 0, n = 0, t0 = performance.now(), fps = 0, sOpen = 0;

  // 영상 좌표(0~1) → 화면에 보이는 미리보기 좌표(0~1). 거울 반전(scaleX(-1)) + object-fit:cover 잘림 반영
  const LIPS = ${JSON.stringify(LIPS)};
  const q = (x) => Math.round(x * 1000) / 1000;
  function mapper() {
    const vw = v.videoWidth || 1, vh = v.videoHeight || 1, W = window.innerWidth || 1, H = window.innerHeight || 1;
    const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s, ox = (dw - W) / 2, oy = (dh - H) / 2;
    return (x, y) => [q(((1 - x) * dw - ox) / W), q((y * dh - oy) / H)];
  }

  // 밝기: 1초마다 32x24 로 줄여 평균 휘도 (0~255). 기준 아래로 내려가면 dark (오르내림 떨림 방지로 두 기준)
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 24;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  let dark = false, lastLum = -1e9;
  function measure(now) {
    if (now - lastLum < 1000) return;
    lastLum = now;
    try {
      cx.drawImage(v, 0, 0, 32, 24);
      const px = cx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const m = sum / (px.length / 4);
      dark = dark ? m < 70 : m < 50;
    } catch (e) {}
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (now - last < ${intervalMs} || v.readyState < 2) return;
    last = now;
    const res = lm.detectForVideo(v, now);
    n++; if (now - t0 > 1000) { fps = n * 1000 / (now - t0); n = 0; t0 = now; }
    measure(now);
    const p = res.faceLandmarks && res.faceLandmarks[0];
    if (!p) { post({ type: 'frame', face: false, looking: false, mouthOpen: false, open: 0, width: 0, yaw: 0, pitch: 0, iris: 0, smile: false, fps, dark }); return; }
    const bs = (res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories) || [];
    const sc = (n) => { const c = bs.find((x) => x.categoryName === n); return c ? c.score : 0; };
    const avg = (a, b) => (sc(a) + sc(b)) / 2;
    const smile = avg('mouthSmileLeft', 'mouthSmileRight') > 0.5;
    // 표정: 웃음 > 놀람(눈썹 안쪽 올림, 또는 입 크게 + 눈 크게) > 찡그림(입꼬리 내림, 또는 눈썹 내림) > 보통
    const surprise = sc('browInnerUp') > 0.5 || (sc('jawOpen') > 0.5 && avg('eyeWideLeft', 'eyeWideRight') > 0.4);
    const frown = avg('mouthFrownLeft', 'mouthFrownRight') > 0.4 || avg('browDownLeft', 'browDownRight') > 0.5;
    const expr = !bs.length ? undefined : smile ? 'smile' : surprise ? 'surprise' : frown ? 'frown' : 'neutral';
    const eye = d(p, 33, 263) || 1e-6;
    const open = d(p, 13, 14) / eye, width = d(p, 61, 291) / eye;
    sOpen = sOpen * 0.4 + open * 0.6; // 떨림 줄이기
    const yaw = r(p[1].x, p[234].x, p[454].x), pitch = r(p[1].y, p[10].y, p[152].y);
    const iris = (r(p[468].x, p[33].x, p[133].x) + r(p[473].x, p[362].x, p[263].x)) / 2;
    const looking = Math.abs(yaw - 0.5) < 0.15 && pitch > 0.35 && pitch < 0.75 && iris > 0.3 && iris < 0.7;
    const m = mapper();
    const lips = LIPS.map((i) => m(p[i].x, p[i].y));
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i]; if (a.x < x0) x0 = a.x; if (a.x > x1) x1 = a.x; if (a.y < y0) y0 = a.y; if (a.y > y1) y1 = a.y; }
    const tl = m(x1, y0), br = m(x0, y1); // 거울 반전이라 x 최대값이 왼쪽
    const box = { x: tl[0], y: tl[1], w: q(br[0] - tl[0]), h: q(br[1] - tl[1]) };
    post({ type: 'frame', face: true, looking, mouthOpen: sOpen > 0.08, open: sOpen, width, yaw, pitch, iris, smile, fps, lips, box, dark, expr });
  }
  requestAnimationFrame(tick);
} catch (e) { post({ type: 'error', message: String(e && e.message || e) }); }
</script></body></html>`;

// 부모가 다시 그려져도 WebView 가 재시작되지 않게 memo + 콜백은 ref 로 최신값 사용
export const FaceTracker = memo(function FaceTracker({ onFrame, onError, intervalMs = 50, style, guide }: FaceTrackerProps) {
  const [perm, requestPerm] = useCameraPermissions();
  const cb = useRef({ onFrame, onError });
  useEffect(() => {
    cb.current = { onFrame, onError };
  }, [onFrame, onError]);
  const source = useMemo(() => ({ html: html(intervalMs), baseUrl: 'https://localhost' }), [intervalMs]); // https 여야 카메라 사용 가능

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm().catch(() => {});
  }, [perm, requestPerm]);

  if (!perm?.granted) {
    return (
      <Pressable onPress={() => requestPerm().catch(() => {})} style={[{ justifyContent: 'center', backgroundColor: '#ddd' }, style]}>
        <Text style={{ textAlign: 'center' }}>카메라 허용</Text>
      </Pressable>
    );
  }

  const guideView = guide && (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: '45%', height: '85%', borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: '#F2B705' }} />
    </View>
  );

  // 웹(데모 링크): WebView 가 없어서 같은 페이지를 iframe 으로 띄움. ReactNativeWebView.postMessage → parent.postMessage 로 이어 줌
  if (Platform.OS === 'web') {
    return (
      <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
        <WebFrame html={source.html} onMessage={(data) => handleMessage(data, cb.current)} />
        {guideView}
      </View>
    );
  }

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <WebView
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        scrollEnabled={false}
        style={{ flex: 1, backgroundColor: '#000' }}
        onMessage={(e) => handleMessage(e.nativeEvent.data, cb.current)}
      />
      {guideView}
    </View>
  );
});

function handleMessage(data: unknown, cb: Pick<FaceTrackerProps, 'onFrame' | 'onError'>) {
  let msg: { type?: string; message?: string };
  try {
    msg = JSON.parse(String(data));
  } catch {
    return;
  }
  if (msg.type === 'frame') cb.onFrame(msg as unknown as FaceFrame);
  else if (msg.type === 'error') cb.onError?.(String(msg.message));
}

/** 웹 전용: 카메라·MediaPipe 페이지를 iframe 으로 (allow=camera) */
function WebFrame({ html: page, onMessage }: { html: string; onMessage: (data: unknown) => void }) {
  const [frame, setFrame] = useState<{ contentWindow?: unknown } | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);
  useEffect(() => {
    if (!frame) return;
    const listen = (e: { source?: unknown; data?: unknown }) => {
      if (e.source === frame.contentWindow) handler.current(e.data);
    };
    const w = globalThis as unknown as { addEventListener: (t: string, f: typeof listen) => void; removeEventListener: (t: string, f: typeof listen) => void };
    w.addEventListener('message', listen);
    return () => w.removeEventListener('message', listen);
  }, [frame]);
  const shim = '<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage(m,"*")}}</script>';
  return createElement('iframe', {
    ref: setFrame,
    srcDoc: page.replace('<body>', '<body>' + shim),
    allow: 'camera; microphone; autoplay',
    style: { border: 0, width: '100%', height: '100%', background: '#000' },
  });
}
