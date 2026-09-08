from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path.home() / "Desktop"
TEMPLATE = ROOT / "assets" / "references-v6" / "items" / "robinhood-seed-pack.png"
OUT = ROOT / "artifacts" / "meshy" / "stock-seed-packs" / "references-v2"
CONTACT = ROOT / "artifacts" / "meshy" / "stock-seed-packs" / "contact-sheet-v2.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
FONT_REGULAR = Path(r"C:\Windows\Fonts\arial.ttf")

ASSETS = [
    {"slug": "msft", "ticker": "MSFT", "name": "MICROSOFT", "color": "#258ffa", "dark": "#102b4a", "logo": "hBf2ToCT9Jkue5XpZkqoZog66f685GK5C55nThnccHCY02Onz0027cSqCK60iODI9nVXIT3pgJuN-j3W2uCTFdoKwUaH76Tdv4zfsYPtBMs38VERU1tCYIIFvHKQAEEr5U4SBC9d63QQVRvvsRmcSXyWK6UFCX-oWtFfvIwNoAkILD9rM873sv90jh4OqbWo.jpg"},
    {"slug": "tsla", "ticker": "TSLA", "name": "TESLA", "color": "#e82127", "dark": "#491014", "logo": "ZlUnepARUeATgIvcuufhCoBu4I9vnDLIGNcc4fusLznYPXE9hCPrXHar3RMR5fRSOpIq7iJ3XLdRj_JHd1_l8PjV62RU2QKW2ku4cQyQg-diipKxGl2LZrdg5YYzlS6lVKTuE2uTRgzQpQN7NYQu9MHRtJhVjFz8t9NFGe11ZQsqjybQ3vUVoyBMj5KEb41r.jpg", "mono": "white"},
    {"slug": "nvda", "ticker": "NVDA", "name": "NVIDIA", "color": "#76b900", "dark": "#233d0d", "logo": "kIDFxNEmMTJCf2Y78Vk9MgfAM2YMguvt6qEi92-EpU3bcD7fcbUtbKOpvHKPdlCSMUHdcjG4dDxITnSNd9Dcn6acAoBJRGRQRyuMNDAFsAOP8IdeJofuW2GjANZMo8CH09B7K89oC56O8lNAR-vgvp6xDKJ3c51A5V9dvkdEJABMb05EzoJo_v3EOlOTlWl5.jpg"},
    {"slug": "mstr", "ticker": "MSTR", "name": "MICROSTRATEGY", "color": "#e31837", "dark": "#4b0c19", "logo": "vSYAp331VbmlVyyF0SP-tRYUdSOu_Bt_2eToF0vXE6Ud8BfzP_WNTya50WitkeQ4WeCaorUMEAjr-jh2Xco0dKnWG3xdbEDovkEo6E5bke54nUWYtrPqRI95krdCiuxV-FVb2EcB_H-Qmc7fRsYeGD1LtA02x7w3zKmGWOFb8btXeAW0I1xRpzB9HYlHFOMA.jpg", "mono": "white"},
    {"slug": "aapl", "ticker": "AAPL", "name": "APPLE", "color": "#707780", "dark": "#20242a", "logo": "QDewgZLntlRQmHP2B4tLSf5FwLtV2yfAjFGcb3VhTHv1gMTOMDpm01o1yotOkO098_1Sc-39JRNq2SkTRl7E6pxf6Wykf_dqiDD4D2kQeDuWXI3StB3N_1kgsGwoqReoEJr1BAN3Ju9C8Qfw-gFx1kT8Vmuk7ZO5CTK5cnabMB3TFfzILAxXUUeTvnrdY0IL.jpg", "mono": "white"},
    {"slug": "qqq", "ticker": "QQQ", "name": "INVESCO QQQ", "color": "#6c20a3", "dark": "#260b3d", "logo": "38094.png"},
    {"slug": "googl", "ticker": "GOOGL", "name": "GOOGLE", "color": "#4285f4", "dark": "#102d58", "logo": "2ufQx_EGPFi8AXrp44Iir1S1ylsZVZjNJe7kBs936rLGmFnG_OrnCsfUS69NRSNbqZgiPWbfp8oAQrP4HdFs8pW-gyXjszcWt8ZlmWZe370oTTK7_8-_bLILjdSxG53ZxGFhgkRxFnpSLFyz-ZPvol7gBjw1tdV-eUSekTxTqikR8TO6FLReuZgbnoijAJcG.jpg"},
]


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i+2], 16) for i in (0, 2, 4))


def clean_logo(path: Path, mono: str | None = None) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    px = source.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = px[x, y]
            bright = (r + g + b) / 3
            checker_or_white = bright > 185 and max(r, g, b) - min(r, g, b) < 18
            if a < 8 or checker_or_white:
                px[x, y] = (0, 0, 0, 0)
            elif mono == "white":
                px[x, y] = (245, 248, 240, a)
    bbox = source.getbbox()
    if not bbox:
        raise RuntimeError(f"No visible logo pixels in {path}")
    return source.crop(bbox)


def colorized_packet(template: Image.Image, main: str, dark: str) -> Image.Image:
    canvas = template.convert("RGB")
    gray = ImageOps.grayscale(canvas)
    tinted = ImageOps.colorize(gray, black=rgb(dark), white=rgb(main))
    # Preserve the approved neutral studio background; recolor only the packet silhouette.
    mask = Image.new("L", canvas.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(310,185),(870,208),(902,310),(869,356),(900,1088),(779,1190),(251,1103),(252,421),(281,337),(281,278)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    canvas.paste(tinted, mask=mask)
    return canvas


def build_reference(item: dict) -> Path:
    template = Image.open(TEMPLATE).convert("RGB")
    canvas = colorized_packet(template, item["color"], item["dark"])

    # Repaint the whole front face with the same bag material. No plaque, border or
    # floating label: the identity is printed directly into the packet surface.
    face = [(286,356),(873,374),(885,1042),(255,1008)]
    face_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(face_mask).polygon(face, fill=255)
    face_mask = face_mask.filter(ImageFilter.GaussianBlur(.7))
    gradient = Image.new("RGB", canvas.size)
    main_color, dark_color = rgb(item["color"]), rgb(item["dark"])
    gradient_pixels = gradient.load()
    for y in range(340, 1050):
        t = .28 + .42 * ((y - 340) / 710)
        row = tuple(round(main_color[c] * (1 - t) + dark_color[c] * t) for c in range(3))
        for x in range(245, 895):
            gradient_pixels[x, y] = row
    canvas.paste(gradient, mask=face_mask)
    surface = ImageDraw.Draw(canvas, "RGBA")
    surface.polygon([(286,356),(580,365),(450,640)],fill=(255,255,255,10))
    surface.polygon([(873,374),(580,365),(725,690)],fill=(0,0,0,12))
    surface.polygon([(255,1008),(450,640),(565,1030)],fill=(255,255,255,8))

    logo = clean_logo(DESKTOP / item["logo"], item.get("mono"))
    max_w, max_h = 370, 230
    scale = min(max_w / logo.width, max_h / logo.height)
    logo = logo.resize((max(1, round(logo.width * scale)), max(1, round(logo.height * scale))), Image.Resampling.LANCZOS)
    x = 565 - logo.width // 2
    y = 515 - logo.height // 2
    shadow = Image.new("RGBA", canvas.size, (0,0,0,0))
    shadow_logo = Image.new("RGBA", logo.size, (0,0,0,0))
    shadow_logo.putalpha(logo.getchannel("A").filter(ImageFilter.GaussianBlur(2)))
    shadow.paste(shadow_logo, (x+3,y+5), shadow_logo)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)
    canvas.paste(logo, (x, y), logo)

    draw = ImageDraw.Draw(canvas)
    ticker_font = ImageFont.truetype(str(FONT_BOLD), 88)
    small_font = ImageFont.truetype(str(FONT_BOLD), 24)
    seeds_font = ImageFont.truetype(str(FONT_BOLD), 68)
    ticker = item["ticker"]
    box = draw.textbbox((0, 0), ticker, font=ticker_font)
    draw.text((565 - (box[2] - box[0]) // 2, 675), ticker, font=ticker_font, fill=(245,248,240), stroke_width=2, stroke_fill=dark_color)
    label = "TOKENIZED STOCK"
    box = draw.textbbox((0, 0), label, font=small_font)
    draw.text((565 - (box[2] - box[0]) // 2, 800), label, font=small_font, fill=(235,242,229))
    box = draw.textbbox((0, 0), "SEEDS", font=seeds_font)
    draw.text((565 - (box[2] - box[0]) // 2, 840), "SEEDS", font=seeds_font, fill=(245,248,240), stroke_width=2, stroke_fill=dark_color)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{item['slug']}-seed-pack.png"
    canvas.convert("RGB").save(path, optimize=True)
    return path


def build_contact(paths: list[Path]) -> None:
    thumb_size = (296, 332)
    sheet = Image.new("RGB", (thumb_size[0] * 4, thumb_size[1] * 2), "#101510")
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGB")
        image.thumbnail((270, 300), Image.Resampling.LANCZOS)
        x = (index % 4) * thumb_size[0] + (thumb_size[0] - image.width) // 2
        y = (index // 4) * thumb_size[1] + 8
        sheet.paste(image, (x, y))
    CONTACT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT, optimize=True)


def main() -> None:
    paths = [build_reference(item) for item in ASSETS]
    build_contact(paths)
    manifest = [{**item, "logo": str(DESKTOP / item["logo"]), "reference": str(path)} for item, path in zip(ASSETS, paths)]
    (CONTACT.parent / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Built {len(paths)} references and {CONTACT}")


if __name__ == "__main__":
    main()
