"""
Batch resize photos for the web before uploading them to Supabase Storage.

Your originals are 10 to 20 MB each, which is far too large to serve on a phone.
This shrinks each photo so its longest side is at most 2000 pixels and saves it as
a quality-optimized JPEG (usually 200 to 500 KB), and also writes a small square
thumbnail for the gallery grid.

Usage (from a terminal):
    python tools/resize-photos.py "C:/Users/ASUS/Downloads/chapter 24 studio"
    python tools/resize-photos.py "M:/MMS MODELING"

Output goes to a new "web-ready" folder inside the folder you point it at:
    <that folder>/web-ready/full/   the large web versions (upload these)
    <that folder>/web-ready/thumb/  the small thumbnails (upload these too)

Nothing is deleted or overwritten. Your originals are left untouched.
"""

import sys
import os
from PIL import Image, ImageOps

MAX_LONG_EDGE = 2000      # longest side of the full web image, in pixels
THUMB_EDGE = 700          # square thumbnail size, in pixels
JPEG_QUALITY = 82         # 80 to 85 looks clean and stays small
VALID = (".jpg", ".jpeg", ".png", ".webp")


def resize_full(img):
    img = ImageOps.exif_transpose(img)      # respect the camera rotation
    img = img.convert("RGB")
    w, h = img.size
    scale = min(MAX_LONG_EDGE / max(w, h), 1.0)   # never upscale
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    return img


def make_thumb(img):
    img = ImageOps.exif_transpose(img).convert("RGB")
    return ImageOps.fit(img, (THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)


def main():
    if len(sys.argv) < 2:
        print('Usage: python tools/resize-photos.py "path/to/photo/folder"')
        sys.exit(1)

    src = sys.argv[1]
    if not os.path.isdir(src):
        print("Folder not found:", src)
        sys.exit(1)

    out_full = os.path.join(src, "web-ready", "full")
    out_thumb = os.path.join(src, "web-ready", "thumb")
    os.makedirs(out_full, exist_ok=True)
    os.makedirs(out_thumb, exist_ok=True)

    files = [f for f in sorted(os.listdir(src)) if f.lower().endswith(VALID)]
    if not files:
        print("No images found in", src)
        sys.exit(0)

    print(f"Found {len(files)} images. Writing web-ready versions ...")
    done = 0
    for name in files:
        path = os.path.join(src, name)
        try:
            with Image.open(path) as img:
                base = os.path.splitext(name)[0]
                # keep names short and url-safe
                safe = "".join(c if c.isalnum() else "-" for c in base).strip("-")[:60]
                safe = safe or f"photo-{done+1}"

                resize_full(img.copy()).save(
                    os.path.join(out_full, safe + ".jpg"),
                    "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True,
                )
                make_thumb(img.copy()).save(
                    os.path.join(out_thumb, safe + ".jpg"),
                    "JPEG", quality=JPEG_QUALITY, optimize=True,
                )
            done += 1
            if done % 10 == 0:
                print(f"  {done}/{len(files)} ...")
        except Exception as e:
            print(f"  skipped {name}: {e}")

    print(f"Done. {done} images written to:")
    print("  " + out_full)
    print("  " + out_thumb)
    print("Upload both folders to your Supabase Storage bucket, then use their public URLs.")


if __name__ == "__main__":
    main()
