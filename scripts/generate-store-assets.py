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
CAIRO.cairo_new_sub_path.argtypes = [ctypes.c_void_p]
CAIRO.cairo_close_path.argtypes = [ctypes.c_void_p]


class TextExtents(ctypes.Structure):
    """cairo_text_extents_t, so button labels can be centred on real metrics."""

    _fields_ = [
        ("x_bearing", ctypes.c_double),
        ("y_bearing", ctypes.c_double),
        ("width", ctypes.c_double),
        ("height", ctypes.c_double),
        ("x_advance", ctypes.c_double),
        ("y_advance", ctypes.c_double),
    ]


CAIRO.cairo_text_extents.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.POINTER(TextExtents)]

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


def measure(ctx, value, size, bold=False):
    CAIRO.cairo_select_font_face(ctx, b"DejaVu Sans", 0, 1 if bold else 0)
    CAIRO.cairo_set_font_size(ctx, size)
    extents = TextExtents()
    CAIRO.cairo_text_extents(ctx, value.encode("utf-8"), ctypes.byref(extents))
    return extents.x_advance


def text_centered(ctx, center_x, y, value, size, fill="#17253b", bold=False):
    text(ctx, center_x - measure(ctx, value, size, bold) / 2, y, value, size, fill, bold)


def rounded_path(ctx, x, y, width, height, radius):
    right = x + width - radius
    bottom = y + height - radius
    CAIRO.cairo_new_sub_path(ctx)
    CAIRO.cairo_arc(ctx, right, y + radius, radius, -1.5708, 0)
    CAIRO.cairo_arc(ctx, right, bottom, radius, 0, 1.5708)
    CAIRO.cairo_arc(ctx, x + radius, bottom, radius, 1.5708, 3.1416)
    CAIRO.cairo_arc(ctx, x + radius, y + radius, radius, 3.1416, 4.7124)
    CAIRO.cairo_close_path(ctx)


def rounded_rect(ctx, x, y, width, height, radius, fill=None, border=None, border_width=1):
    if fill:
        color(ctx, fill)
        rounded_path(ctx, x, y, width, height, radius)
        CAIRO.cairo_fill(ctx)
    if border:
        color(ctx, border)
        CAIRO.cairo_set_line_width(ctx, border_width)
        rounded_path(ctx, x, y, width, height, radius)
        CAIRO.cairo_stroke(ctx)


def button(ctx, x, y, width, label, primary=True, disabled=False):
    """Matches the panel's own styling: filled primary, outlined secondary."""
    height = 32
    if disabled:
        fill = "#a7c8e4" if primary else "#ffffff"
        edge = "#a7c8e4"
        ink = "#ffffff" if primary else "#a7c8e4"
    elif primary:
        fill, edge, ink = "#0f6cbd", "#0f6cbd", "#ffffff"
    else:
        fill, edge, ink = "#ffffff", "#0f6cbd", "#0f6cbd"
    rounded_rect(ctx, x, y, width, height, 4, fill, edge)
    text_centered(ctx, x + width / 2, y + 21, label, 13, ink, True)


def canvas(width, height, filename, painter):
    surface = CAIRO.cairo_image_surface_create(0, width, height)
    ctx = CAIRO.cairo_create(surface)
    painter(ctx, width, height)
    CAIRO.cairo_surface_write_to_png(surface, str(OUT / filename).encode())
    CAIRO.cairo_destroy(ctx)
    CAIRO.cairo_surface_destroy(surface)


def logo(ctx, x, y, size):
    """Mirrors icons/icon-*.png so the store icon matches the installed one."""
    rounded_rect(ctx, x, y, size, size, size * .16, "#0f6cbd")
    rect(ctx, x + size * .22, y + size * .22, size * .56, size * .09, "#ffffff")
    rect(ctx, x + size * .22, y + size * .37, size * .44, size * .09, "#ffffff")
    rect(ctx, x + size * .22, y + size * .52, size * .32, size * .09, "#ffffff")
    color(ctx, "#ffffff")
    CAIRO.cairo_move_to(ctx, x + size * .42, y + size * .62)
    CAIRO.cairo_line_to(ctx, x + size * .82, y + size * .62)
    CAIRO.cairo_line_to(ctx, x + size * .62, y + size * .82)
    CAIRO.cairo_close_path(ctx)
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
    panel(ctx, running)


def panel(ctx, running=False):
    """The extension's own panel, as src/panel.js renders it."""
    x, width = 960, 300
    height = 248 if running else 224
    y = 780 - height
    inner = x + 16
    content = width - 32

    color(ctx, "#000000", .16)
    rounded_path(ctx, x + 2, y + 4, width, height, 6)
    CAIRO.cairo_fill(ctx)
    rounded_rect(ctx, x, y, width, height, 6, "#ffffff", "#d1d1d1")

    text(ctx, inner, y + 25, "SharePoint Loader", 13, "#242424", True)
    # Drawn rather than typed: DejaVu Sans coverage of U+2699 and U+2715 is not
    # guaranteed, and a missing glyph would silently render as tofu.
    gear_x, gear_y = x + width - 46, y + 20
    circle(ctx, gear_x, gear_y, 6, "#616161")
    circle(ctx, gear_x, gear_y, 2.5, "#ffffff")
    close_x, close_y = x + width - 24, y + 20
    for dx, dy in ((-4, -4), (-4, 4)):
        line(ctx, close_x + dx, close_y + dy, close_x - dx, close_y - dy, "#616161", 1.5)
    line(ctx, x, y + 38, x + width, y + 38, "#ededed")

    text(ctx, inner, y + 62, "Documents · 8,300 items", 12, "#616161")

    button(ctx, inner, y + 76, content, "Load full list", True, running)
    half = (content - 6) / 2
    button(ctx, inner, y + 116, half, "Export CSV", False, running)
    button(ctx, inner + half + 6, y + 116, half, "Export JSON", False, running)

    check_y = y + 160
    rounded_rect(ctx, inner, check_y, 14, 14, 2, "#0f6cbd" if running else "#ffffff", "#8a8886")
    if running:
        color(ctx, "#ffffff")
        CAIRO.cairo_set_line_width(ctx, 2)
        CAIRO.cairo_move_to(ctx, inner + 3, check_y + 7)
        CAIRO.cairo_line_to(ctx, inner + 6, check_y + 10)
        CAIRO.cairo_line_to(ctx, inner + 11, check_y + 4)
        CAIRO.cairo_stroke(ctx)
    text(ctx, inner + 22, check_y + 12, "Include subfolders", 12, "#242424")

    if running:
        button(ctx, inner, y + 186, content, "Stop", True)
        text(ctx, inner, y + 236, "2,910 found · scanning Archive/2019", 12, "#616161")
    else:
        text(ctx, inner, y + 204, "Idle", 12, "#616161")


def screenshot(ctx, _, __, running=False):
    sharepoint_mock(ctx, running)
    rect(ctx, 0, 0, 1280, 108, "#092e54")
    logo(ctx, 30, 24, 60)
    text(ctx, 116, 54,
         "Real progress, and stop whenever" if running else "Load the whole list, or export it",
         29, "#ffffff", True)
    text(ctx, 117, 82,
         "Walk every subfolder and save the lot" if running
         else "Every item in the page, or as a CSV or JSON file",
         16, "#cfe7fb")


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
    text(ctx, 31, 232, "The whole list. In the page, or as a file.", 15, "#cfe7fb")


canvas(128, 128, "icon-128.png", icon)
canvas(1280, 800, "screenshot-panel.png", lambda c, w, h: screenshot(c, w, h, False))
canvas(1280, 800, "screenshot-export-progress.png", lambda c, w, h: screenshot(c, w, h, True))
canvas(440, 280, "small-promo-tile.png", promo)
print(f"Generated Chrome Web Store artwork in {OUT}")
