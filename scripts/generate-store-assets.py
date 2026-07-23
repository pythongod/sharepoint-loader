#!/usr/bin/env python3
"""Generate deterministic Chrome Web Store PNG artwork using system Cairo."""

import ctypes
from pathlib import Path


CAIRO = ctypes.CDLL("libcairo.so.2")
CAIRO.cairo_image_surface_create.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
CAIRO.cairo_image_surface_create.restype = ctypes.c_void_p
for name in ("cairo_create",):
    getattr(CAIRO, name).argtypes = [ctypes.c_void_p]
    getattr(CAIRO, name).restype = ctypes.c_void_p
CAIRO.cairo_set_source_rgb.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double, ctypes.c_double]
CAIRO.cairo_set_source_rgba.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double]
CAIRO.cairo_rectangle.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double]
CAIRO.cairo_fill.argtypes = [ctypes.c_void_p]
CAIRO.cairo_move_to.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double]
CAIRO.cairo_line_to.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double]
CAIRO.cairo_set_line_width.argtypes = [ctypes.c_void_p, ctypes.c_double]
CAIRO.cairo_stroke.argtypes = [ctypes.c_void_p]
CAIRO.cairo_arc.argtypes = [ctypes.c_void_p, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double]
CAIRO.cairo_select_font_face.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int, ctypes.c_int]
CAIRO.cairo_set_font_size.argtypes = [ctypes.c_void_p, ctypes.c_double]
CAIRO.cairo_show_text.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
CAIRO.cairo_surface_write_to_png.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
CAIRO.cairo_surface_destroy.argtypes = [ctypes.c_void_p]
CAIRO.cairo_destroy.argtypes = [ctypes.c_void_p]

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets"
OUT.mkdir(exist_ok=True)


def color(ctx, value, alpha=1):
    value = value.lstrip("#")
    rgb = tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))
    CAIRO.cairo_set_source_rgba(ctx, *rgb, alpha)


def rect(ctx, x, y, width, height, fill):
    color(ctx, fill)
    CAIRO.cairo_rectangle(ctx, x, y, width, height)
    CAIRO.cairo_fill(ctx)


def text(ctx, x, y, value, size, fill="#17253b", bold=False):
    color(ctx, fill)
    CAIRO.cairo_select_font_face(ctx, b"DejaVu Sans", 0, 1 if bold else 0)
    CAIRO.cairo_set_font_size(ctx, size)
    CAIRO.cairo_move_to(ctx, x, y)
    CAIRO.cairo_show_text(ctx, value.encode("utf-8"))


def line(ctx, x1, y1, x2, y2, fill="#d9e2ec", width=1):
    color(ctx, fill)
    CAIRO.cairo_set_line_width(ctx, width)
    CAIRO.cairo_move_to(ctx, x1, y1)
    CAIRO.cairo_line_to(ctx, x2, y2)
    CAIRO.cairo_stroke(ctx)


def circle(ctx, x, y, radius, fill):
    color(ctx, fill)
    CAIRO.cairo_arc(ctx, x, y, radius, 0, 6.2832)
    CAIRO.cairo_fill(ctx)


def canvas(width, height, filename, painter):
    surface = CAIRO.cairo_image_surface_create(0, width, height)
    ctx = CAIRO.cairo_create(surface)
    painter(ctx, width, height)
    CAIRO.cairo_surface_write_to_png(surface, str(OUT / filename).encode())
    CAIRO.cairo_destroy(ctx)
    CAIRO.cairo_surface_destroy(surface)


def logo(ctx, x, y, size):
    rect(ctx, x, y, size, size, "#0f6cbd")
    rect(ctx, x + size * .18, y + size * .22, size * .64, size * .12, "#ffffff")
    rect(ctx, x + size * .18, y + size * .44, size * .48, size * .12, "#ffffff")
    rect(ctx, x + size * .18, y + size * .66, size * .32, size * .12, "#ffffff")
    color(ctx, "#41c7a5")
    CAIRO.cairo_move_to(ctx, x + size * .68, y + size * .50)
    CAIRO.cairo_line_to(ctx, x + size * .88, y + size * .70)
    CAIRO.cairo_line_to(ctx, x + size * .68, y + size * .90)
    CAIRO.cairo_fill(ctx)


def sharepoint_mock(ctx, running=False):
    rect(ctx, 0, 0, 1280, 800, "#f5f7fa")
    rect(ctx, 0, 0, 1280, 52, "#0f6cbd")
    rect(ctx, 0, 52, 1280, 56, "#ffffff")
    text(ctx, 28, 35, "S", 25, "#ffffff", True)
    text(ctx, 70, 34, "SharePoint", 18, "#ffffff", True)
    text(ctx, 26, 88, "Contoso workspace", 18, "#17253b", True)
    text(ctx, 1115, 34, "Help     Settings", 14, "#ffffff")
    rect(ctx, 0, 108, 205, 692, "#ffffff")
    text(ctx, 28, 153, "Home", 15)
    text(ctx, 28, 198, "Documents", 15, "#0f6cbd", True)
    text(ctx, 28, 243, "Site contents", 15)
    rect(ctx, 236, 137, 1005, 610, "#ffffff")
    text(ctx, 268, 182, "Documents", 27, "#17253b", True)
    rect(ctx, 268, 208, 108, 36, "#0f6cbd")
    text(ctx, 292, 232, "+  New", 14, "#ffffff", True)
    text(ctx, 402, 232, "Upload     Share     Copy link", 14, "#34495e")
    line(ctx, 268, 267, 1207, 267)
    text(ctx, 305, 297, "Name", 13, "#536579", True)
    text(ctx, 837, 297, "Modified", 13, "#536579", True)
    text(ctx, 1030, 297, "Modified by", 13, "#536579", True)
    names = ["Brand assets", "Campaign planning", "Customer resources", "Design system", "Launch materials", "Research", "Team operations"]
    for index, name in enumerate(names):
        y = 337 + index * 53
        line(ctx, 268, y + 25, 1207, y + 25, "#edf1f5")
        rect(ctx, 295, y - 13, 22, 18, "#f2c94c")
        text(ctx, 338, y + 3, name, 14)
        text(ctx, 837, y + 3, f"July {22-index}, 2026", 13, "#536579")
        text(ctx, 1030, y + 3, "Project team", 13, "#536579")
    rect(ctx, 1002, 685, 209, 46, "#0f6cbd")
    text(ctx, 1025, 714, "Loading... 128" if running else "Load full list", 15, "#ffffff", True)


def screenshot(ctx, _, __, running=False):
    sharepoint_mock(ctx, running)
    rect(ctx, 0, 0, 1280, 108, "#092e54")
    logo(ctx, 30, 24, 60)
    text(ctx, 116, 54, "See progress as your list loads" if running else "Load every item with one click", 29, "#ffffff", True)
    text(ctx, 117, 82, "Stop at any time — no setup required" if running else "Built for long SharePoint lists and libraries", 16, "#cfe7fb")


def icon(ctx, _, __):
    rect(ctx, 0, 0, 128, 128, "#eaf5ff")
    logo(ctx, 14, 14, 100)


def promo(ctx, _, __):
    rect(ctx, 0, 0, 440, 280, "#092e54")
    circle(ctx, 372, 42, 110, "#0f6cbd")
    circle(ctx, 415, 220, 105, "#41c7a5")
    logo(ctx, 30, 36, 72)
    text(ctx, 30, 150, "SharePoint", 35, "#ffffff", True)
    text(ctx, 30, 192, "Loader", 35, "#ffffff", True)
    text(ctx, 31, 232, "Load the full list. One click.", 16, "#cfe7fb")


canvas(128, 128, "icon-128.png", icon)
canvas(1280, 800, "screenshot-load-full-list.png", lambda c, w, h: screenshot(c, w, h, False))
canvas(1280, 800, "screenshot-loading-progress.png", lambda c, w, h: screenshot(c, w, h, True))
canvas(440, 280, "small-promo-tile.png", promo)
print(f"Generated Chrome Web Store artwork in {OUT}")
