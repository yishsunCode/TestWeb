"""
Convert all tile_*.svg files in this folder to PNGs named tile_*.png.
Requires: pip install cairosvg

Usage (PowerShell):
  python .\svg_to_png.py

The script will skip files that already have a newer PNG.
"""
import os
import sys
from glob import glob

try:
    import cairosvg
except Exception as e:
    print("cairosvg not found. Install with: pip install cairosvg")
    sys.exit(1)

this_dir = os.path.dirname(os.path.abspath(__file__))
svg_files = glob(os.path.join(this_dir, 'tile_*.svg'))
if not svg_files:
    print('No SVG files found in', this_dir)
    sys.exit(0)

for svg in svg_files:
    png = svg[:-4] + '.png'
    try:
        svg_mtime = os.path.getmtime(svg)
        if os.path.exists(png) and os.path.getmtime(png) >= svg_mtime:
            print('Skipping up-to-date', os.path.basename(png))
            continue
        cairosvg.svg2png(url=svg, write_to=png, output_width=200, output_height=200)
        print('Wrote', os.path.basename(png))
    except Exception as e:
        print('Failed to convert', svg, e)

print('Done')
