#!/usr/bin/env python3
"""Tile check stills into one labelled contact sheet, so they can be looked at in one go.

usage: sheet.py <out.jpg> <img> [<img> ...] [--cols 3] [--width 360]
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('imgs', nargs='+')
ap.add_argument('--cols', type=int, default=3); ap.add_argument('--width', type=int, default=360)
a = ap.parse_args()
ims = [Image.open(p).convert('RGB') for p in a.imgs]
w = a.width; h = int(ims[0].height * w / ims[0].width); lab = 34
rows = (len(ims) + a.cols - 1) // a.cols
sheet = Image.new('RGB', (a.cols * w, rows * (h + lab)), (18, 18, 20))
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype(os.path.join(os.path.dirname(__file__), '..', 'fonts', 'Inter.ttf'), 20) if os.path.exists(
    os.path.join(os.path.dirname(__file__), '..', 'fonts', 'Inter.ttf')) else ImageFont.load_default()
for i, (p, im) in enumerate(zip(a.imgs, ims)):
    x, y = (i % a.cols) * w, (i // a.cols) * (h + lab)
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y + lab))
    d.text((x + 10, y + 6), os.path.splitext(os.path.basename(p))[0], fill=(240, 240, 240), font=font)
sheet.save(a.out, quality=90)
print('saved', a.out)
