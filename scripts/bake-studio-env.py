"""
Bake the studio HDRI into the three small environment maps the deck's paper
shader reflects (src/lib/magazinePaper.ts).

The source is an 80 MB, 4096×2048 EXR — far too heavy to ship, and far sharper
than a coated magazine ever reflects. What the shader needs is the room seen
through the coating at three roughnesses, each prefiltered here once:

  gloss  512×256  the clear coat: the lights nearly sharp, softened ~2°
  haze   128×64   the coat's spread: the same lights ~12° wide
  irr     32×16   the paper's diffuse light: ~45°, what the ink is lit by

Written as Radiance .hdr (RGBE, run-length encoded) to public/env/, which
three's HDRLoader reads without any further conversion.

Usage (needs numpy + OpenEXR):
  python3 -m venv .venv && .venv/bin/pip install numpy OpenEXR
  .venv/bin/python scripts/bake-studio-env.py "/path/to/Light HDRI.exr"

Directions follow the shader: an equirect whose u = 0.5 looks down -z, v = 0
straight up. The room's orientation relative to the deck is not baked in —
it's ENV_YAW in magazinePaper.ts.
"""

import os
import sys

import numpy as np
import OpenEXR

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "env")


def load(path):
    exr = OpenEXR.File(path)
    part = exr.parts[0]
    for name in ("RGBA", "RGB"):
        if name in part.channels:
            return np.asarray(part.channels[name].pixels, dtype=np.float32)[..., :3]
    raise SystemExit("expected an RGB(A) EXR")


def downsample(img, width):
    """Box-filter down to `width` × width/2 (the source must divide evenly)."""
    h, w, _ = img.shape
    f = w // width
    return img[: (h // f) * f, : width * f].reshape(h // f, f, width, f, 3).mean(axis=(1, 3))


def directions(width, height):
    u = (np.arange(width) + 0.5) / width
    v = (np.arange(height) + 0.5) / height
    phi = (u - 0.5) * 2 * np.pi
    theta = (0.5 - v) * np.pi  # elevation
    ct = np.cos(theta)[:, None]
    d = np.stack(
        [
            ct * np.sin(phi)[None, :],
            np.broadcast_to(np.sin(theta)[:, None], (height, width)),
            -ct * np.cos(phi)[None, :],
        ],
        axis=-1,
    )
    # Each texel's solid angle, so the poles don't count for more than they are.
    area = np.broadcast_to(ct, (height, width))
    return d.reshape(-1, 3), area.reshape(-1)


def convolve(src, width, sigma_deg):
    """
    Blur on the sphere with a von Mises–Fisher kernel (a Gaussian on the sphere)
    of angular width sigma, sampled at width × width/2. Brute force over a
    source small enough for it; energy is kept, so a tiny bright lamp spreads
    into a dimmer, wider one exactly as a rough coat spreads it.
    """
    sh, sw, _ = src.shape
    sdirs, sarea = directions(sw, sh)
    sval = src.reshape(-1, 3) * sarea[:, None]
    odirs, _ = directions(width, width // 2)
    kappa = 1.0 / np.radians(sigma_deg) ** 2
    out = np.empty((odirs.shape[0], 3), dtype=np.float64)
    step = 512
    for i in range(0, odirs.shape[0], step):
        w = np.exp(kappa * (odirs[i : i + step] @ sdirs.T - 1.0))
        out[i : i + step] = (w @ sval) / (w @ sarea)[:, None]
    return out.reshape(width // 2, width, 3).astype(np.float32)


def blur_equirect(img, sigma_deg):
    """
    Narrow blur, separable, for the gloss level where brute force would be too
    slow: vertical in elevation, horizontal widened by 1/cos(elevation) so the
    kernel stays the same angular size away from the horizon.
    """
    h, w, _ = img.shape
    px = sigma_deg / (180.0 / h)
    radius = int(np.ceil(px * 3))
    k = np.exp(-0.5 * (np.arange(-radius, radius + 1) / px) ** 2)
    k /= k.sum()
    out = np.zeros_like(img)
    for dy, wk in zip(range(-radius, radius + 1), k):
        out += wk * img[np.clip(np.arange(h) + dy, 0, h - 1)]
    rows = np.empty_like(out)
    for y in range(h):
        elevation = (0.5 - (y + 0.5) / h) * np.pi
        spx = min(px / max(np.cos(elevation), 0.05), w / 4)
        r = int(np.ceil(spx * 3))
        kk = np.exp(-0.5 * (np.arange(-r, r + 1) / spx) ** 2)
        kk /= kk.sum()
        row = out[y]
        acc = np.zeros_like(row)
        for dx, wk in zip(range(-r, r + 1), kk):
            acc += wk * np.roll(row, -dx, axis=0)  # wraps: the equirect is a loop
        rows[y] = acc
    return rows


def to_rgbe(img):
    peak = img.max(axis=-1)
    mantissa, exponent = np.frexp(peak)
    scale = np.where(peak > 1e-32, mantissa * 256.0 / np.maximum(peak, 1e-32), 0.0)
    rgbe = np.zeros(img.shape[:2] + (4,), dtype=np.uint8)
    rgbe[..., :3] = np.clip(img * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(peak > 1e-32, exponent + 128, 0).astype(np.uint8)
    return rgbe


def rle(channel):
    """Radiance's per-channel run-length encoding of one scanline."""
    out = bytearray()
    i, n = 0, len(channel)
    while i < n:
        run = 1
        while i + run < n and run < 127 and channel[i + run] == channel[i]:
            run += 1
        if run >= 3:
            out += bytes([128 + run, channel[i]])
            i += run
            continue
        start = i
        while i < n and i - start < 128:
            if i + 2 < n and channel[i] == channel[i + 1] == channel[i + 2]:
                break
            i += 1
        out += bytes([i - start]) + bytes(channel[start:i])
    return out


def write_hdr(path, img):
    h, w, _ = img.shape
    rgbe = to_rgbe(img)
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode())
        for y in range(h):
            line = rgbe[y]
            if not 8 <= w < 32768:
                f.write(line.tobytes())
                continue
            f.write(bytes([2, 2, w >> 8, w & 255]))
            for c in range(4):
                f.write(rle(line[:, c].tolist()))
    print(f"  {os.path.relpath(path)}  {w}×{h}  {os.path.getsize(path) // 1024} KB")


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    print("reading", sys.argv[1])
    src = load(sys.argv[1])
    base = downsample(src, 1024)
    print("baking")
    write_hdr(os.path.join(OUT, "studio-gloss.hdr"), downsample(blur_equirect(base, 2.0), 512))
    small = downsample(base, 256)
    write_hdr(os.path.join(OUT, "studio-haze.hdr"), convolve(small, 128, 12.0))
    write_hdr(os.path.join(OUT, "studio-irr.hdr"), convolve(downsample(base, 64), 32, 45.0))


if __name__ == "__main__":
    main()
