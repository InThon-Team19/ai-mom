"""아이맘 효과음 합성 (자체 제작 → 라이선스 문제 없음). 영유아용으로 작은 음량(최대 0.35)."""
import sys, wave
import numpy as np
out = sys.argv[1]; sr = 22050; rng = np.random.default_rng(7)
def env(n, a=0.005, d=0.15):
    t = np.arange(n) / sr
    return np.minimum(1, t / a) * np.exp(-t / d)
def save(name, x, peak=0.35):
    x = x / (np.abs(x).max() + 1e-9) * peak
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
def burst(n, d, hp=0.0):
    x = rng.normal(0, 1, n)
    if hp: x = np.diff(x, prepend=0) * hp + x * (1 - hp)
    return x * env(n, 0.002, d)
# 와그작: 짧은 노이즈 버스트 여러 개
crunch = np.zeros(int(sr * 0.45))
for i, s in enumerate([0, 0.06, 0.13, 0.22]):
    b = burst(int(sr * 0.12), 0.03, 0.7) * (1 - i * 0.15); k = int(sr * s); crunch[k:k + len(b)] += b
save("crunch", crunch)
# 스르륵: 부드럽게 길게 미끄러지는 노이즈
n = int(sr * 0.7); t = np.arange(n) / sr
peel = rng.normal(0, 1, n) * np.sin(np.pi * t / t[-1]) ** 2
peel = np.convolve(peel, np.ones(12) / 12, "same")
save("peel", peel)
# 바삭: 날카로운 클릭 + 짧은 노이즈
snap = np.zeros(int(sr * 0.3)); snap[:int(sr * 0.08)] += burst(int(sr * 0.08), 0.015, 0.9)
k = int(sr * 0.05); b = burst(int(sr * 0.1), 0.02, 0.8) * 0.6; snap[k:k + len(b)] += b
save("snap", snap)
# 톡 (칭찬): 올라가는 짧은 음
n = int(sr * 0.25); t = np.arange(n) / sr; f = 600 + 900 * t / t[-1]
save("pop", np.sin(2 * np.pi * np.cumsum(f) / sr) * env(n, 0.004, 0.08))
# 둥 (북)
n = int(sr * 0.6); t = np.arange(n) / sr
save("drum", np.sin(2 * np.pi * (90 + 40 * np.exp(-t * 20)) * t) * env(n, 0.003, 0.18))
# 통 (사물이 바닥에 닿음): 낮고 부드러운 음이 살짝 내려감 — 더 작게(0.22)
n = int(sr * 0.22); t = np.arange(n) / sr
tong = np.sin(2 * np.pi * np.cumsum(170 + 90 * np.exp(-t * 30)) / sr) * env(n, 0.003, 0.06)
tong += np.convolve(rng.normal(0, 1, n), np.ones(30) / 30, "same") * env(n, 0.001, 0.015) * 0.6
save("tong", tong, 0.22)
# 쏙 (바구니에 들어감): 짧게 올라가는 부드러운 음 — 작게(0.22)
n = int(sr * 0.16); t = np.arange(n) / sr; f = 380 + 900 * (t / t[-1]) ** 1.6
save("ssok", np.sin(2 * np.pi * np.cumsum(f) / sr) * np.abs(np.sin(np.pi * t / t[-1])) ** 1.5, 0.22)
# 쓱 (쓸어내기): 아주 부드럽게 쓸리는 노이즈 — 손가락을 따라 자주 나므로 가장 작게(0.16)
n = int(sr * 0.22); t = np.arange(n) / sr
swish = np.convolve(rng.normal(0, 1, n), np.ones(18) / 18, "same") * np.sin(np.pi * t / t[-1]) ** 2
swish = np.diff(swish, prepend=0) * 0.5 + swish * 0.5  # 너무 웅웅거리지 않게 살짝 밝게
save("swish", swish, 0.16)
# 둥! (세게 친 북): 더 낮고 길게 울림 — 그래도 최대 0.35
n = int(sr * 0.8); t = np.arange(n) / sr
drum_big = np.sin(2 * np.pi * (70 + 55 * np.exp(-t * 18)) * t) * env(n, 0.002, 0.26)
drum_big += np.convolve(rng.normal(0, 1, n), np.ones(20) / 20, "same") * env(n, 0.001, 0.02) * 0.5
save("drum_big", drum_big)
print("ok")
