"""Frame raw simulator captures into App Store screenshots (1320x2868).

Usage: python3 scripts/compose_store_screenshots.py <raw dir> <out dir>
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAW, OUT = sys.argv[1], sys.argv[2]
SIZE = (1320, 2868)
FONT = '/System/Library/Fonts/SFNSRounded.ttf'

# (raw file, title, subtitle, background top, background bottom)
SHOTS = [
    ('map.png', 'A Journey of 40 levels', 'Four sweet worlds to pop your way through', '#ffd6e8', '#ffeaf3'),
    ('level.png', 'Clear jelly, crack sugar', 'Every level has its own goals and moves', '#fff1b8', '#fff9de'),
    ('pop.png', 'Pop lines, chain combos', 'Fill a row or column and watch it pop', '#cdeeff', '#eaf7ff'),
    ('intro.png', 'Plan every move', 'Earn up to 3 stars on each level', '#e6dcff', '#f4efff'),
    ('home.png', 'Or play Classic, endless', 'Chase your best score, no move limit', '#d4f7e6', '#ecfcf4'),
    ('capsules.png', 'Collect mochi friends', 'Unlock cute skins from the Capsule Machine', '#ffd9c7', '#fff0e8'),
]


def font(size, weight=800):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes([400, weight])
    return f


def compose(raw, title, sub, c1, c2):
    w, h = SIZE
    bg = Image.new('RGB', (w, h), c2)
    top = Image.new('RGB', (w, h), c1)
    mask = Image.linear_gradient('L').resize((w, h)).point(lambda v: 255 - v)
    canvas = Image.composite(top, bg, mask).convert('RGBA')
    dots = ImageDraw.Draw(canvas)
    for y in range(0, h, 70):
        for x in range((y // 70) % 2 * 35, w, 70):
            dots.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 255, 255, 110))
    d = ImageDraw.Draw(canvas)
    tf = font(112)
    while d.textlength(title, font=tf) > w * 0.9:
        tf = font(int(tf.size * 0.95))
    sf = font(54, 600)
    while d.textlength(sub, font=sf) > w * 0.88:
        sf = font(int(sf.size * 0.95), 600)
    ty = 130
    d.text(((w - d.textlength(title, font=tf)) / 2, ty + 6), title, font=tf, fill='#f7b6d0')
    d.text(((w - d.textlength(title, font=tf)) / 2, ty), title, font=tf, fill='#d9437f')
    sy = ty + int(tf.size * 1.3)
    d.text(((w - d.textlength(sub, font=sf)) / 2, sy), sub, font=sf, fill='#7a4f73')

    shot_top = sy + int(sf.size * 1.9)
    avail_h = h - shot_top - 90
    scale = min(w * 0.82 / raw.width, avail_h / raw.height)
    sw, sh = int(raw.width * scale), int(raw.height * scale)
    shot = raw.convert('RGB').resize((sw, sh), Image.LANCZOS)
    r = int(sw * 0.12)
    x, y = (w - sw) // 2, shot_top + (avail_h - sh) // 2
    bez = 22
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x - bez, y - bez + 20, x + sw + bez, y + sh + bez + 20), r + bez, fill=(200, 90, 150, 90))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(40)))
    ImageDraw.Draw(canvas).rounded_rectangle((x - bez, y - bez, x + sw + bez, y + sh + bez), r + bez, fill='#ffffff')
    m = Image.new('L', shot.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sw - 1, sh - 1), r, fill=255)
    shot = shot.convert('RGBA')
    shot.putalpha(m)
    canvas.alpha_composite(shot, (x, y))
    return canvas.convert('RGB')


os.makedirs(OUT, exist_ok=True)
for i, (name, title, sub, c1, c2) in enumerate(SHOTS, 1):
    compose(Image.open(os.path.join(RAW, name)), title, sub, c1, c2).save(os.path.join(OUT, f'{i:02d}.png'), optimize=True)
print('wrote', len(SHOTS), 'to', OUT)
