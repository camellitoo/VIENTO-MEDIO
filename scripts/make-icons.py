#!/usr/bin/env python3
"""Icono cuadrado: mar, tres rachas y un ala. Sin texto, para que iOS lo enmascare bien."""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "icons"
SEA = (14, 58, 66)
CREAM = (236, 246, 244)
AMBER = (240, 160, 75)


def draw(size):
    image = Image.new("RGB", (size, size), SEA)
    pen = ImageDraw.Draw(image)
    thickness = max(4, size // 22)

    def bar(y, x0, x1):
        radius = thickness // 2
        pen.rounded_rectangle((x0, y, x1, y + thickness), radius=radius, fill=CREAM)

    left = int(size * 0.16)
    bar(int(size * 0.30), left, int(size * 0.50))
    bar(int(size * 0.44), left, int(size * 0.62))
    bar(int(size * 0.58), left, int(size * 0.44))

    profile = []
    steps = 24
    for index in range(steps + 1):
        t = index / steps
        x = size * (0.50 + t * 0.34)
        lift = math.sin(t * math.pi)
        profile.append((x, size * (0.46 - 0.16 * lift)))
    for index in range(steps, -1, -1):
        t = index / steps
        x = size * (0.50 + t * 0.34)
        camber = math.sin(t * math.pi)
        profile.append((x, size * (0.54 - 0.05 * camber)))
    pen.polygon(profile, fill=AMBER)
    return image


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    master = draw(512)
    master.save(ROOT / "icon-512.png", optimize=True)
    master.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "icon-192.png", optimize=True)
    master.resize((180, 180), Image.Resampling.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)
    small = master.resize((32, 32), Image.Resampling.LANCZOS)
    small.save(ROOT / "favicon-32.png", optimize=True)
    small.save(ROOT.parent / "favicon.ico", sizes=[(32, 32)])
    mask = Image.new("RGB", (512, 512), SEA)
    inner = draw(340)
    mask.paste(inner, ((512 - 340) // 2, (512 - 340) // 2))
    mask.save(ROOT / "icon-maskable-512.png", optimize=True)


if __name__ == "__main__":
    main()
