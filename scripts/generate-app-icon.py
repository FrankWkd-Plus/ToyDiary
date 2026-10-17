#!/usr/bin/env python3
"""Generate the ToyDiary iOS app icon and launch screen.

Design: the same kawaii bear as <LoadingBear/> sits behind an open diary,
inside a frosted "liquid glass" tile over a warm aurora background.

Run from the repo root:

    python3 scripts/generate-app-icon.py

Writes (all opaque, no alpha — App Store requirement):
    web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
    web/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICON_OUT = (
    ROOT
    / "web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
)
SPLASH_DIR = ROOT / "web/ios/App/App/Assets.xcassets/Splash.imageset"

BASE = 1024
SS = 3  # draw at 3x, then downsample for clean edges


# ---------------------------------------------------------------- helpers


def px(v: float, scale: int = SS) -> int:
    return int(round(v * scale))


def diagonal_gradient(size: int, c0: tuple[int, int, int], c1: tuple[int, int, int]) -> Image.Image:
    """Linear gradient from c0 (top-left) to c1 (bottom-right)."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    t = (x + y) / (2 * (size - 1))
    arr = np.zeros((size, size, 3), np.float32)
    for i in range(3):
        arr[..., i] = c0[i] * (1 - t) + c1[i] * t
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB")


def soft_blob(
    size: int,
    box: tuple[float, float, float, float],
    color: tuple[int, int, int],
    blur: float,
    alpha: int,
    scale: int = SS,
) -> Image.Image:
    """A blurred ellipse of a single colour (blur the mask, not the RGBA)."""
    layer = Image.new("RGBA", (size, size), color + (255,))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse(
        (px(box[0], scale), px(box[1], scale), px(box[2], scale), px(box[3], scale)),
        fill=alpha,
    )
    layer.putalpha(mask.filter(ImageFilter.GaussianBlur(px(blur, scale))))
    return layer


def soft_ellipse_mask(
    size: int, box: tuple[float, float, float, float], blur: float, scale: int = SS
) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse(
        (px(box[0], scale), px(box[1], scale), px(box[2], scale), px(box[3], scale)),
        fill=255,
    )
    return mask.filter(ImageFilter.GaussianBlur(px(blur, scale)))


def rounded_mask(
    size: int, inset: float, radius: float, scale: int = SS, alpha: int = 255
) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (px(inset, scale), px(inset, scale), size - px(inset, scale), size - px(inset, scale)),
        radius=px(radius, scale),
        fill=alpha,
    )
    return mask


def overlay(base: Image.Image, layer: Image.Image) -> Image.Image:
    return Image.alpha_composite(base.convert("RGBA"), layer)


def bezier(points: list[tuple[float, float]], steps: int = 40) -> list[tuple[float, float]]:
    """Cubic bezier through p0, c0, c1, p3."""
    p0, p1, p2, p3 = points
    out = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        out.append((px(x), px(y)))
    return out


def star_points(cx: float, cy: float, outer: float, inner: float, rotation: float = -8.0):
    pts = []
    for i in range(10):
        r = outer if i % 2 == 0 else inner
        a = math.radians(rotation - 90 + i * 36)
        pts.append((px(cx + r * math.cos(a)), px(cy + r * math.sin(a))))
    return pts


# ---------------------------------------------------------------- artwork


def draw_aurora(size: int, scale: int) -> Image.Image:
    """Warm, soft background that shows through the glass tile."""
    bg = diagonal_gradient(size, (255, 247, 231), (238, 240, 220)).convert("RGBA")
    blobs = [
        # box (in 1024-space), colour, blur, alpha
        ((690, 40, 1190, 500), (246, 197, 111), 150, 235),   # mustard, top right
        ((20, 330, 520, 790), (243, 184, 166), 150, 175),    # rose, left
        ((60, 700, 620, 1240), (186, 221, 176), 160, 215),   # mint, bottom left
        ((640, 640, 1250, 1240), (134, 188, 169), 165, 205), # mist, bottom right
        ((300, 120, 760, 560), (255, 255, 255), 120, 120),   # soft glow, centre
    ]
    for box, color, blur, alpha in blobs:
        bg = overlay(bg, soft_blob(size, box, color, blur, alpha, scale))
    # tiny liquid bubbles behind the glass
    for cx, cy, r, a in ((850, 210, 46, 90), (210, 300, 34, 75), (900, 640, 26, 70)):
        bg = overlay(
            bg,
            soft_blob(size, (cx - r, cy - r, cx + r, cy + r), (255, 255, 255), 18, a, scale),
        )
    return bg


def draw_glass_tile(base: Image.Image, size: int, scale: int) -> Image.Image:
    inset, radius = 82.0, 212.0

    # drop shadow under the tile
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    smask = rounded_mask(size, inset, radius, scale, alpha=80)
    smask = smask.filter(ImageFilter.GaussianBlur(px(40, scale)))
    shadow.putalpha(ImageChops.offset(smask, 0, px(18, scale)))
    base = overlay(base, shadow)

    tile_mask = rounded_mask(size, inset, radius, scale)

    # frosted glass: blurred background, lifted toward a warm white
    frosted = base.convert("RGB").filter(ImageFilter.GaussianBlur(px(20, scale)))
    frosted = Image.blend(frosted, Image.new("RGB", (size, size), (255, 252, 246)), 0.32)
    frosted = ImageEnhance.Color(frosted).enhance(1.3)
    frosted = ImageEnhance.Brightness(frosted).enhance(1.04)
    glass = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glass.paste(frosted.convert("RGBA"), (0, 0), tile_mask)

    # warm glass tint so the panel reads luminous rather than grey
    tint = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tint_mask = tile_mask.point(lambda v: int(v * 0.10))
    tint.paste((255, 246, 230, 255), (0, 0), tint_mask)
    glass = overlay(glass, tint)

    # coloured liquid glows inside the panel
    for box, color, a in (
        ((560, 90, 1080, 560), (247, 199, 118), 60),
        ((40, 700, 560, 1180), (176, 219, 168), 55),
        ((60, 280, 420, 760), (246, 186, 168), 40),
    ):
        glow = soft_blob(size, box, color, 95, a, scale)
        glow.putalpha(ImageChops.multiply(glow.getchannel("A"), tile_mask))
        glass = overlay(glass, glow)

    # inner bottom shade for depth
    shade_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(shade_mask).rectangle(
        (px(inset, scale), px(600, scale), size - px(inset, scale), size - px(inset, scale)),
        fill=255,
    )
    shade_mask = shade_mask.filter(ImageFilter.GaussianBlur(px(90, scale)))
    shade_mask = ImageChops.multiply(shade_mask, tile_mask)
    shade = Image.new("RGBA", (size, size), (90, 78, 60, 255))
    shade.putalpha(shade_mask.point(lambda v: int(v * 0.10)))
    glass = overlay(glass, shade)

    base = overlay(base, glass)

    # gradient rim: bright top-left, faint bottom-right
    outer = rounded_mask(size, inset, radius, scale)
    inner = rounded_mask(size, inset + 7, radius - 7, scale)
    ring = ImageChops.subtract(outer, inner)
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    t = ((x + y) / (2 * (size - 1))).clip(0, 1)
    rim_alpha = np.clip(232 * (1 - t) ** 1.6 + 26, 0, 255).astype(np.uint8)
    rim = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    rim.putalpha(ImageChops.multiply(Image.fromarray(rim_alpha, "L"), ring))
    base = overlay(base, rim)

    return base


def draw_bear_and_book(base: Image.Image, size: int, scale: int) -> Image.Image:
    d = ImageDraw.Draw(base)

    # ---- open diary -------------------------------------------------
    # contact shadow
    base = overlay(
        base,
        soft_blob(size, (320, 826, 704, 900), (90, 74, 52), 22, 70, scale),
    )
    d = ImageDraw.Draw(base)

    cover = [(512, 604), (318, 646), (318, 822), (512, 852), (706, 822), (706, 646)]
    d.polygon([(px(x, scale), px(y, scale)) for x, y in cover], fill=(201, 164, 94, 255))

    pages = [(512, 618), (332, 656), (332, 806), (512, 832), (692, 806), (692, 656)]
    d.polygon([(px(x, scale), px(y, scale)) for x, y in pages], fill=(255, 249, 236, 255))

    # spine shading
    spine = soft_blob(size, (462, 600, 562, 850), (214, 190, 146), 28, 120, scale)
    base = overlay(base, spine)
    d = ImageDraw.Draw(base)

    # page rules
    rule = (196, 176, 140, 210)
    for side in (-1, 1):
        for k in range(3):
            y0 = 700 + k * 30
            x0 = 512 + side * 26
            x1 = 512 + side * 152
            y1 = y0 - 26
            d.line(
                [(px(x0, scale), px(y0, scale)), (px(x1, scale), px(y1, scale))],
                fill=rule,
                width=px(4.5, scale),
            )

    # ribbon bookmark
    ribbon = [(500, 618), (524, 618), (524, 884), (512, 866), (500, 884)]
    d.polygon([(px(x, scale), px(y, scale)) for x, y in ribbon], fill=(215, 142, 128, 255))

    # page top highlights
    d.line(
        [(px(340, scale), px(659, scale)), (px(508, scale), px(621, scale))],
        fill=(255, 255, 255, 190),
        width=px(3, scale),
    )
    d.line(
        [(px(684, scale), px(659, scale)), (px(516, scale), px(621, scale))],
        fill=(255, 255, 255, 190),
        width=px(3, scale),
    )

    # ---- bear -------------------------------------------------------
    # soft contact shadow where the bear meets the book
    base = overlay(base, soft_blob(size, (458, 590, 566, 640), (96, 74, 50), 16, 42, scale))
    d = ImageDraw.Draw(base)

    head_cx, head_cy, head_r = 512.0, 465.0, 145.0
    scale_r = head_r / 38.0  # LoadingBear head radius is 38

    def bear_xy(x: float, y: float) -> tuple[float, float]:
        return (head_cx + (x - 60) * scale_r, head_cy + (y - 62) * scale_r)

    # ears
    for ex in (28, 92):
        exx, eyy = bear_xy(ex, 32)
        d.ellipse(
            (
                px(exx - 16 * scale_r, scale),
                px(eyy - 16 * scale_r, scale),
                px(exx + 16 * scale_r, scale),
                px(eyy + 16 * scale_r, scale),
            ),
            fill=(232, 201, 160, 255),
        )
    for ex in (28, 92):
        exx, eyy = bear_xy(ex, 32)
        d.ellipse(
            (
                px(exx - 9 * scale_r, scale),
                px(eyy - 9 * scale_r, scale),
                px(exx + 9 * scale_r, scale),
                px(eyy + 9 * scale_r, scale),
            ),
            fill=(245, 220, 192, 255),
        )

    # head
    d.ellipse(
        (
            px(head_cx - head_r, scale),
            px(head_cy - head_r, scale),
            px(head_cx + head_r, scale),
            px(head_cy + head_r, scale),
        ),
        fill=(240, 210, 168, 255),
    )

    # blush (soft)
    for bx in (34, 86):
        bxx, byy = bear_xy(bx, 72)
        base = overlay(
            base,
            soft_blob(
                size,
                (bxx - 8 * scale_r, byy - 5 * scale_r, bxx + 8 * scale_r, byy + 5 * scale_r),
                (255, 184, 176),
                9,
                150,
                scale,
            ),
        )
    d = ImageDraw.Draw(base)

    # snout
    snx, sny = bear_xy(60, 78)
    d.ellipse(
        (
            px(snx - 18 * scale_r, scale),
            px(sny - 14 * scale_r, scale),
            px(snx + 18 * scale_r, scale),
            px(sny + 14 * scale_r, scale),
        ),
        fill=(255, 246, 232, 255),
    )

    # eyes
    for ex in (46, 74):
        exx, eyy = bear_xy(ex, 58)
        d.ellipse(
            (
                px(exx - 4.2 * scale_r, scale),
                px(eyy - 4.2 * scale_r, scale),
                px(exx + 4.2 * scale_r, scale),
                px(eyy + 4.2 * scale_r, scale),
            ),
            fill=(74, 67, 60, 255),
        )
        d.ellipse(
            (
                px(exx + 0.2 * scale_r, scale),
                px(eyy - 2.8 * scale_r, scale),
                px(exx + 2.8 * scale_r, scale),
                px(eyy - 0.2 * scale_r, scale),
            ),
            fill=(255, 255, 255, 255),
        )

    # nose
    nxx, nyy = bear_xy(60, 72)
    d.ellipse(
        (
            px(nxx - 5 * scale_r, scale),
            px(nyy - 3.8 * scale_r, scale),
            px(nxx + 5 * scale_r, scale),
            px(nyy + 3.8 * scale_r, scale),
        ),
        fill=(92, 83, 74, 255),
    )

    # smile
    m0 = bear_xy(52, 80)
    m1 = bear_xy(55.5, 85)
    m2 = bear_xy(64.5, 85)
    m3 = bear_xy(68, 80)
    d.line(bezier([m0, m1, m2, m3], 36), fill=(92, 83, 74, 255), width=px(2.2 * scale_r, scale), joint="curve")

    # ---- star accent ------------------------------------------------
    sxx, syy = bear_xy(60, 20)
    d.polygon(star_points(sxx, syy, 7.8 * scale_r, 3.3 * scale_r), fill=(255, 255, 255, 150))
    d.polygon(star_points(sxx, syy, 7.0 * scale_r, 3.0 * scale_r), fill=(240, 201, 106, 255))
    d.polygon(
        star_points(sxx - 1.0 * scale_r, syy - 1.2 * scale_r, 2.4 * scale_r, 1.0 * scale_r),
        fill=(255, 255, 255, 210),
    )

    return base


def draw_reflections(base: Image.Image, size: int, scale: int) -> Image.Image:
    tile_mask = rounded_mask(size, 82, 212, scale)

    # broad specular sweep across the top-left
    sweep = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    streak_mask = Image.new("L", (size, size), 0)
    sd = ImageDraw.Draw(streak_mask)
    sd.rounded_rectangle(
        (px(150, scale), px(120, scale), px(560, scale), px(250, scale)),
        radius=px(60, scale),
        fill=130,
    )
    streak_mask = streak_mask.filter(ImageFilter.GaussianBlur(px(42, scale)))
    streak = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    streak.putalpha(ImageChops.multiply(streak_mask, tile_mask))
    sweep = overlay(sweep, streak)
    base = overlay(base, sweep)

    # small glass bubbles on the tile
    for cx, cy, r, a in ((806, 232, 30, 110), (856, 292, 14, 90), (196, 250, 12, 80)):
        bubble = soft_blob(size, (cx - r, cy - r, cx + r, cy + r), (255, 255, 255), 5, a, scale)
        bubble.putalpha(ImageChops.multiply(bubble.getchannel("A"), tile_mask))
        base = overlay(base, bubble)
        ring = Image.new("L", (size, size), 0)
        ImageDraw.Draw(ring).ellipse(
            (px(cx - r, scale), px(cy - r, scale), px(cx + r, scale), px(cy + r, scale)),
            outline=170,
            width=px(2.5, scale),
        )
        ring = ring.filter(ImageFilter.GaussianBlur(px(2, scale)))
        rim = ImageChops.multiply(ring, tile_mask)
        hl = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        hl.putalpha(rim)
        base = overlay(base, hl)

    return base


def render_icon() -> Image.Image:
    size = BASE * SS
    art = draw_aurora(size, SS)
    art = draw_glass_tile(art, size, SS)
    art = draw_bear_and_book(art, size, SS)
    art = draw_reflections(art, size, SS)
    icon = art.convert("RGB").resize((BASE, BASE), Image.LANCZOS)
    return icon


# ---------------------------------------------------------------- splash


def render_splash(icon: Image.Image) -> Image.Image:
    """Cream launch screen with the new icon floating in the centre."""
    size = 2732
    bg = diagonal_gradient(size, (255, 248, 234), (232, 242, 226)).convert("RGBA")

    glow_a = soft_blob(size, (620, 380, 2120, 1880), (255, 246, 224), 260, 150, 1)
    glow_b = soft_blob(size, (300, 1500, 1500, 2700), (232, 245, 238), 240, 140, 1)
    bg = overlay(bg, glow_a)
    bg = overlay(bg, glow_b)

    icon_px = 760
    tile = icon.resize((icon_px, icon_px), Image.LANCZOS).convert("RGBA")
    tile_mask = Image.new("L", (icon_px, icon_px), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle(
        (0, 0, icon_px - 1, icon_px - 1), radius=int(212 / BASE * icon_px), fill=255
    )
    tile.putalpha(tile_mask)

    x = (size - icon_px) // 2
    y = int(size * 0.40) - icon_px // 2

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sh = Image.new("L", (size, size), 0)
    sh.paste(tile_mask.filter(ImageFilter.GaussianBlur(26)), (x, y + 26))
    shadow.putalpha(sh.point(lambda v: int(v * 0.30)))
    bg = overlay(bg, shadow)

    bg.alpha_composite(tile, (x, y))
    return bg.convert("RGB")


# ---------------------------------------------------------------- main


def main() -> None:
    icon = render_icon()
    ICON_OUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(ICON_OUT, "PNG", optimize=True)
    print(f"wrote {ICON_OUT.relative_to(ROOT)}")

    splash = render_splash(icon)
    SPLASH_DIR.mkdir(parents=True, exist_ok=True)
    for name in (
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ):
        path = SPLASH_DIR / name
        splash.save(path, "PNG", optimize=True)
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
