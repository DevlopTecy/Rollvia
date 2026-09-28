import os
import io
import shutil
from PIL import Image

def generate_ico_bytes(im, sizes):
    ico_bytes_io = io.BytesIO()
    im.save(ico_bytes_io, format="ICO", sizes=sizes, bitmap_format="bmp")
    return ico_bytes_io.getvalue()

def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # Source assets in src/assets
    dark_icon_asset = os.path.join(project_root, "src", "assets", "attendly-icon-dark.png")
    light_icon_asset = os.path.join(project_root, "src", "assets", "attendly-icon-light.png")
    legacy_logo_asset = os.path.join(project_root, "src", "assets", "attendly-logo.png")
    
    if os.path.exists(dark_icon_asset) and not os.path.exists(legacy_logo_asset):
        shutil.copyfile(dark_icon_asset, legacy_logo_asset)

    im_dark = Image.open(dark_icon_asset).convert("RGBA")
    im_light = Image.open(light_icon_asset).convert("RGBA")
    print(f"Loaded dark icon: {im_dark.size}, light icon: {im_light.size}")

    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

    dark_ico_data = generate_ico_bytes(im_dark, sizes)
    light_ico_data = generate_ico_bytes(im_light, sizes)
    print(f"Generated Dark ICO: {len(dark_ico_data)} bytes, Light ICO: {len(light_ico_data)} bytes")

    destinations = [
        os.path.join(project_root, "build"),
        os.path.join(project_root, "electron", "assets"),
        os.path.join(project_root, "public"),
    ]

    for d in destinations:
        os.makedirs(d, exist_ok=True)
        # Default / Dark icons
        with open(os.path.join(d, "icon.ico"), "wb") as f:
            f.write(dark_ico_data)
        with open(os.path.join(d, "icon-dark.ico"), "wb") as f:
            f.write(dark_ico_data)
        im_dark.save(os.path.join(d, "icon.png"), format="PNG")
        im_dark.save(os.path.join(d, "icon-dark.png"), format="PNG")

        # Light icons
        with open(os.path.join(d, "icon-light.ico"), "wb") as f:
            f.write(light_ico_data)
        im_light.save(os.path.join(d, "icon-light.png"), format="PNG")

    # Favicon default and dark/light
    fav_path = os.path.join(project_root, "public", "favicon.ico")
    with open(fav_path, "wb") as f:
        f.write(dark_ico_data)

    print("All light and dark mode icons generated successfully!")

if __name__ == "__main__":
    main()
