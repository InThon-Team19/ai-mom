// 아이 얼굴 실시간 인식 (기기 안에서 0.05초마다) — 담당: 태희
// WebView 안에서 MediaPipe FaceLandmarker(웹)를 돌리고 결과를 RN 으로 보냄 → Expo Go 에서도 동작.
// 첫 실행 때 CDN 에서 wasm·모델(약 4MB)을 받으므로 인터넷 필요.
// 수치 계산식은 server/app/vision/landmarks.py 와 같음 (임계값 바꾸면 둘 다 수정)
import { useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

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
};

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

  function tick(now) {
    requestAnimationFrame(tick);
    if (now - last < ${intervalMs} || v.readyState < 2) return;
    last = now;
    const res = lm.detectForVideo(v, now);
    n++; if (now - t0 > 1000) { fps = n * 1000 / (now - t0); n = 0; t0 = now; }
    const p = res.faceLandmarks && res.faceLandmarks[0];
    if (!p) { post({ type: 'frame', face: false, looking: false, mouthOpen: false, open: 0, width: 0, yaw: 0, pitch: 0, iris: 0, smile: false, fps }); return; }
    const bs = (res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories) || [];
    const sc = (n) => { const c = bs.find((x) => x.categoryName === n); return c ? c.score : 0; };
    const smile = (sc('mouthSmileLeft') + sc('mouthSmileRight')) / 2 > 0.5;
    const eye = d(p, 33, 263) || 1e-6;
    const open = d(p, 13, 14) / eye, width = d(p, 61, 291) / eye;
    sOpen = sOpen * 0.4 + open * 0.6; // 떨림 줄이기
    const yaw = r(p[1].x, p[234].x, p[454].x), pitch = r(p[1].y, p[10].y, p[152].y);
    const iris = (r(p[468].x, p[33].x, p[133].x) + r(p[473].x, p[362].x, p[263].x)) / 2;
    const looking = Math.abs(yaw - 0.5) < 0.15 && pitch > 0.35 && pitch < 0.75 && iris > 0.3 && iris < 0.7;
    post({ type: 'frame', face: true, looking, mouthOpen: sOpen > 0.08, open: sOpen, width, yaw, pitch, iris, smile, fps });
  }
  requestAnimationFrame(tick);
} catch (e) { post({ type: 'error', message: String(e && e.message || e) }); }
</script></body></html>`;

export function FaceTracker({ onFrame, onError, intervalMs = 50, style, guide }: FaceTrackerProps) {
  const [perm, requestPerm] = useCameraPermissions();

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [perm, requestPerm]);

  if (!perm?.granted) {
    return (
      <Pressable onPress={requestPerm} style={[{ justifyContent: 'center', backgroundColor: '#ddd' }, style]}>
        <Text style={{ textAlign: 'center' }}>카메라 허용</Text>
      </Pressable>
    );
  }

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <WebView
        source={{ html: html(intervalMs), baseUrl: 'https://localhost' }} // https 여야 카메라 사용 가능
        originWhitelist={['*']}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        scrollEnabled={false}
        style={{ flex: 1, backgroundColor: '#000' }}
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'frame') onFrame(msg as FaceFrame);
          else if (msg.type === 'error') onError?.(msg.message);
        }}
      />
      {guide && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: '45%', height: '85%', borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: '#2453D6' }} />
        </View>
      )}
    </View>
  );
}
