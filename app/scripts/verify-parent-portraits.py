"""Verify final runtime PNGs without regenerating them (Pillow + numpy)."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

p = Path(__file__).resolve().parents[1] / 'assets/parent-portraits'
manifest = json.loads((p/'manifest.json').read_text(encoding='utf-8'))
checked = 0
for vid, item in manifest['variants'].items():
    base = np.asarray(Image.open(p/f'{vid}-normal-neutral.png'))
    x0,y0,x1,y1 = [int(v) for v in item['mouthRoi']]
    for scale in ['small','normal','large']:
        distinct = set()
        for state in ['neutral','closed','open','wide','round','narrow']:
            name=f'{vid}-{scale}-{state}.png'
            a=np.asarray(Image.open(p/name))
            assert a.shape==(512,512,4), name
            assert np.array_equal(a[:,:,3],base[:,:,3]), name
            diff=np.any(a!=base,axis=2)
            diff[y0-3:y1+3,x0-3:x1+3]=False
            assert not diff.any(), name
            assert (a[:,:,3]==0).any() and (a[:,:,3]==255).any(), name
            distinct.add(a.tobytes());checked+=1
        assert len(distinct)==6, (vid,scale,'indistinguishable mouth assets')
    for kind in ['blink','right']:
        overlay=np.asarray(Image.open(p/f'{vid}-{kind}.png'))
        assert overlay.shape==(512,512,4)
        # Eye overlays must never modify any pixel in the mouth region.
        assert not overlay[y0-3:y1+3,:,3].any()
assert len(manifest['variants'])==8 and checked==144
print('PASS: 8 combinations, 144 calibrated PNGs, 6 unique states each; identical pixels/alpha outside mouth; 16 eye overlays isolated')
