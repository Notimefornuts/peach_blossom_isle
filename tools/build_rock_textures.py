"""Build the weathered-limestone rock maps used by the island facade.

Source: "Rock Boulder Dry" by Sergej Majboroda on Poly Haven
(https://polyhaven.com/a/rock_boulder_dry), CC0. The script downloads the 2K
JPEG set once and re-grades it into three compact WebP maps:

  rock-albedo.webp  sRGB  pale weathered limestone, neutral with a warm bias
  rock-normal.webp  linear tangent-space normal, OpenGL convention (green up)
  rock-orm.webp     linear  R = baked cavity occlusion, G = roughness,
                           B = lichen speckle mask

The grading keeps the photographic structure of the source (mottled patches,
dark pits, light calcite blooms) while pushing it towards the pale, slightly
warm stone of the reference boulders. Run it from the project root:

    python3 tools/build_rock_textures.py
"""

from pathlib import Path
import io
import json
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'textures'
CACHE = ROOT / 'tools' / '.cache' / 'rock-boulder-dry'
NAME = 'rock_boulder_dry'
BASE = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/%s/%s_2k.jpg'

SOURCES = {'diff': 'diff', 'nor_gl': 'nor_gl', 'rough': 'rough', 'ao': 'ao'}
SIZE = 1024
ORM_SIZE = 512


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    for key, tag in SOURCES.items():
        target = CACHE / f'{NAME}_{key}.jpg'
        if target.exists() and target.stat().st_size > 10000:
            continue
        url = BASE % (NAME, NAME)
        # Poly Haven keeps the map type in the file name.
        url = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{NAME}/{NAME}_{tag}_2k.jpg'
        print('fetch', url)
        with urllib.request.urlopen(url, timeout=120) as response:
            target.write_bytes(response.read())


def read(key):
    with Image.open(CACHE / f'{NAME}_{key}.jpg') as im:
        return np.asarray(im.convert('RGB')).astype(np.float32) / 255.0


def luminance(rgb):
    return rgb[..., 0] * .2126 + rgb[..., 1] * .7152 + rgb[..., 2] * .0722


def fractal_noise(width, height, octaves=5, seed=7):
    rng = np.random.default_rng(seed)
    total = np.zeros((height, width), np.float32)
    amplitude, norm = 1.0, 0.0
    for octave in range(octaves):
        cells = 2 ** (octave + 1)
        grid = rng.random((cells + 1, cells + 1)).astype(np.float32)
        layer = Image.fromarray((grid * 255).astype(np.uint8)).resize(
            (width, height), Image.BICUBIC)
        total += np.asarray(layer).astype(np.float32) / 255.0 * amplitude
        norm += amplitude
        amplitude *= .52
    total /= norm
    lo, hi = total.min(), total.max()
    return (total - lo) / max(hi - lo, 1e-6)


def build_albedo(diff):
    lum = luminance(diff)
    pivot = .585
    # Smooth roll-off keeps the calcite blooms from clipping to flat white.
    detail = np.tanh((lum - pivot) * 2.15) * .225
    chroma = diff - lum[..., None]
    base = np.array([.800, .789, .755], np.float32)
    tint = np.array([1.0, .980, .930], np.float32)
    out = base + detail[..., None] * tint + chroma * .30
    # A trace of cool shade in the pits keeps the stone from reading as flat.
    shade = np.clip((pivot + .16 - lum) * 2.2, 0, 1)
    out *= (1.0 - shade * .10)[..., None]
    return np.clip(out, 0, 1)


def build_normal(nor):
    n = nor * 2.0 - 1.0
    n[..., :2] *= 2.05
    length = np.sqrt((n * n).sum(-1, keepdims=True))
    n = n / np.maximum(length, 1e-5)
    return np.clip(n * .5 + .5, 0, 1)


def _down(array, size):
    image = Image.fromarray((np.clip(array, 0, 1) * 255).astype(np.uint8))
    return np.asarray(image.resize((size, size), Image.LANCZOS)).astype(np.float32) / 255.0


def build_orm(ao, rough, albedo):
    cavity = np.clip((_down(ao[..., 0], ORM_SIZE) - .48) / .52, 0, 1)
    occlusion = np.clip((cavity - .02) / .98, 0, 1)
    roughness = np.clip((_down(rough[..., 1], ORM_SIZE) - .44) / .46, 0, 1)
    roughness = .66 + roughness * .32
    lichen = fractal_noise(ORM_SIZE, ORM_SIZE, 5, 21)
    dark = np.clip((.78 - _down(luminance(albedo), ORM_SIZE)) * 2.6, 0, 1)
    mask = np.clip(dark * .75 + (lichen - .52) * 1.5, 0, 1)
    mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255.0
    return np.stack([occlusion, roughness, mask], -1)


def save(array, name, quality):
    image = Image.fromarray((np.clip(array, 0, 1) * 255 + .5).astype(np.uint8))
    image.save(OUT / name, 'WEBP', quality=quality, method=6)
    print(f'  {name:20s} {image.size[0]}x{image.size[1]}  '
          f'{(OUT / name).stat().st_size / 1024:.1f} KiB')


def resize(array, size):
    """Resample a float image and return float data again."""
    image = Image.fromarray((np.clip(array, 0, 1) * 255 + .5).astype(np.uint8))
    image = image.resize((size, size), Image.LANCZOS)
    return np.asarray(image).astype(np.float32) / 255.0


def linear_mean(array):
    value = np.clip(array, 0, 1)
    return float((value <= .04045).sum() * 0 +
                 np.mean(np.where(value <= .04045, value / 12.92,
                                  ((value + .055) / 1.055) ** 2.4)))


def main():
    download()
    OUT.mkdir(parents=True, exist_ok=True)
    diff = read('diff')
    nor = read('nor_gl')
    rough = read('rough')
    ao = read('ao')
    albedo = build_albedo(diff)
    normal = build_normal(nor)
    orm = build_orm(ao, rough, albedo)
    print('writing maps')
    save(resize(albedo, SIZE), 'rock-albedo.webp', 82)
    save(resize(normal, SIZE), 'rock-normal.webp', 92)
    save(resize(orm, ORM_SIZE), 'rock-orm.webp', 86)
    mean = linear_mean(albedo)
    print(f'albedo linear mean {mean:.4f} -> instance tint gain {1 / mean:.4f}')
    (OUT / 'rock-constants.json').write_text(json.dumps({
        'albedoLinearMean': round(mean, 5),
        'tintGain': round(1 / mean, 5),
    }, indent=2) + '\n')


if __name__ == '__main__':
    sys.exit(main())
