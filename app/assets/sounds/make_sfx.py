"""아이봄 효과음 합성 (자체 제작 → 라이선스 문제 없음). 영유아용으로 작은 음량(최대 0.35)."""
import sys, wave
import numpy as np
out = sys.argv[1]; sr = 22050; rng = np.random.default_rng(7)
def env(n, a=0.005, d=0.15):
    t = np.arange(n) / sr
    return np.minimum(1, t / a) * np.exp(-t / d)
def save(name, x):
    x = x / (np.abs(x).max() + 1e-9) * 0.35
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
print("ok")
