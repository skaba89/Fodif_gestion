"""One-time generator for the PWA icons under apps/web/public/icons/ (axe D2,
docs/14-ROADMAP-SAAS-PREMIUM.md). Not run in CI - re-run manually only if the brand mark or
palette changes; the generated PNGs are committed like any other static asset.

Draws a blocky "FD" monogram (same idea as the .mark badge in apps/web/app/entrepreneur/
portal.module.css: a gold mark on the institutional green) on a 32x32 grid, rasterised with
plain zlib/struct - no Pillow/canvas dependency, since none is installed in this repo and one
shouldn't be added just to generate a handful of static icons once.
"""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

# Brand palette (apps/web/app/globals.css) - primary-500 background, accent-300 monogram, to
# match the existing gradient .mark badge used across every portal header.
GREEN = (0x0F, 0x6B, 0x45)
GOLD = (0xF0, 0xC0, 0x4A)

GRID = 32


def build_grid() -> list[list[int]]:
    """32x32 grid: 1 = monogram (gold), 0 = background (green). Two blocky letters, "F" then
    "D", built from plain rectangles only (no curves) so the design survives being rasterised
    at any resolution without anti-aliasing."""
    grid = [[0] * GRID for _ in range(GRID)]

    def fill(x0: int, y0: int, x1: int, y1: int, value: int = 1) -> None:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    grid[y][x] = value

    # "F": left vertical bar + top bar + shorter middle bar.
    fill(4, 8, 7, 24)
    fill(4, 8, 14, 11)
    fill(4, 15, 12, 18)

    # "D": full rectangle with a rectangular counter cut out - the simplest way to get a "D"
    # silhouette from plain rectangles.
    fill(18, 8, 28, 24)
    fill(21, 11, 25, 21, value=0)

    return grid


def render_inner(inner_size: int) -> list[list[tuple[int, int, int]]]:
    """Rasterise the 32x32 grid to an inner_size x inner_size pixel buffer (list of rows of
    RGB tuples), nearest-neighbour scaled - the artwork itself is never stretched or trimmed,
    only the canvas around it changes between icon variants."""
    grid = build_grid()
    cell = inner_size // GRID
    pixels: list[list[tuple[int, int, int]]] = []
    for gy in range(GRID):
        row = []
        for gx in range(GRID):
            color = GOLD if grid[gy][gx] else GREEN
            row.extend([color] * cell)
        # Column remainder (inner_size may not divide evenly by GRID): repeat the last
        # column's colour so the edge stays flush instead of leaving a stray gap.
        while len(row) < inner_size:
            row.append(row[-1])
        for _ in range(cell):
            pixels.append(row)
    while len(pixels) < inner_size:
        pixels.append(pixels[-1])
    return pixels


def render(size: int, margin_fraction: float) -> list[list[tuple[int, int, int]]]:
    """Full size x size canvas, filled with background and the monogram artwork centred and
    scaled down to leave `margin_fraction` of the canvas as a plain border on every side -
    used for the maskable icon's safe zone, where the OS may crop the canvas to a circle or
    squircle and anything outside the safe zone can be lost."""
    margin = round(size * margin_fraction)
    inner_size = size - 2 * margin
    inner = render_inner(inner_size)
    canvas = [[GREEN] * size for _ in range(size)]
    for y in range(inner_size):
        canvas[margin + y][margin:margin + inner_size] = inner[y]
    return canvas


def write_png(path: Path, size: int, margin_fraction: float = 0.0) -> None:
    canvas = render(size, margin_fraction)
    scanlines = b''.join(
        b'\x00' + b''.join(struct.pack('BBB', *p) for p in row) for row in canvas
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack('!I', len(data)) + tag + data + struct.pack(
            '!I', zlib.crc32(tag + data) & 0xFFFFFFFF
        )

    ihdr = struct.pack('!IIBBBBB', size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(scanlines, 9)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    path.write_bytes(png)
    print(f'Wrote {path} ({size}x{size})')


def main() -> None:
    out_dir = Path('apps/web/public/icons')
    out_dir.mkdir(parents=True, exist_ok=True)
    # "any" purpose icons: monogram fills the canvas edge-to-edge.
    write_png(out_dir / 'icon-192.png', 192)
    write_png(out_dir / 'icon-512.png', 512)
    write_png(out_dir / 'apple-touch-icon.png', 180)
    # "maskable" icon: OSes may crop to a circle/squircle, so the manifest spec's safe zone
    # requires the meaningful content within the inner ~80% of the canvas - a 12% margin on
    # every side keeps the monogram clear of that crop with a comfortable buffer.
    write_png(out_dir / 'icon-512-maskable.png', 512, margin_fraction=0.12)


if __name__ == '__main__':
    sys.exit(main())
