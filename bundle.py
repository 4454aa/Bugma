#!/usr/bin/env python3
"""
Bugma 单文件打包脚本

将游戏本体（index.html + js/ + css/ + assets/）打包为单个 HTML 文件，
所有图片资源内嵌为 Base64 Data URI，适合部署到 Netlify 等静态托管平台。

用法:
    python bundle.py                 # 输出 bugma.html
    python bundle.py -o dist/game.html  # 指定输出路径
"""

import os
import sys
import base64
import re
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUTPUT_DEFAULT = ROOT / "bugma.html"

# JS 文件加载顺序（与 index.html 中 <script> 标签顺序一致）
JS_ORDER = [
    "js/Constants.js",
    "js/LevelTokens.js",
    "js/levels.js",
    "js/custom_levels.js",
    "js/generated_levels.js",
    "js/GameState.js",
    "js/SaveSystem.js",
    "js/VisualLogic.js",
    "js/BattleLogic.js",
    "js/MovementLogic.js",
    "js/LevelLoader.js",
    "js/RenderConfig.js",
    "js/Render.js",
    "js/UIManager.js",
    "js/Game.js",
]

# 需要内嵌的图片资源
IMAGE_FILES = [
    "assets/chara_irohenka.png",
    "assets/chara_irokomono.png",
    "assets/chara_irokomono2.png",
    "assets/chara_set.png",
    "assets/chara_set2.png",
    "assets/chara_set_tsuika.png",
    "assets/chara_set_tsuika2.png",
    "assets/chara_set_tsuika3.png",
    "assets/chara_set_tsuika4.png",
    "assets/ella.png",
    "assets/shirley.png",
    "assets/sunlight.png",
    "assets/titlekurai.png",
    "assets/titlelogo.png",
    "assets/yuka.png",
    "assets/yuka1.png",
    "assets/yuka2.png",
    "assets/yuka3.png",
    "assets/yuka4.png",
    "assets/yuka5.png",
    "assets/yuka6.png",
]


def read_text(path):
    """读取文本文件，返回内容字符串"""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def read_bytes(path):
    """读取二进制文件，返回 bytes"""
    with open(path, "rb") as f:
        return f.read()


def image_to_data_uri(filepath):
    """将图片文件转换为 Base64 Data URI"""
    data = read_bytes(ROOT / filepath)
    ext = Path(filepath).suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
    }
    mime = mime_map.get(ext, "application/octet-stream")
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def build_image_map():
    """构建 原始路径 -> Data URI 的映射表"""
    img_map = {}
    for f in IMAGE_FILES:
        fpath = ROOT / f
        if fpath.exists():
            img_map[f] = image_to_data_uri(f)
            print(f"  [OK] {f} ({fpath.stat().st_size:,} bytes)")
        else:
            print(f"  [SKIP] {f} (not found)")
    return img_map


def inline_css(html, img_map):
    """将 <link rel='stylesheet'> 替换为内联 <style>"""
    css_content = read_text(ROOT / "css/style.css")

    # 替换 CSS 中的 url('../assets/xxx.png') -> url('data:...')
    def replace_css_url(match):
        relative = match.group(1)
        # '../assets/xxx.png' -> 'assets/xxx.png'
        normalized = relative.replace("../", "")
        if normalized in img_map:
            return f"url('{img_map[normalized]}')"
        return match.group(0)

    css_content = re.sub(r"url\(['\"]?([^)'\"]+)['\"]?\)", replace_css_url, css_content)

    html = re.sub(
        r'<link\s+rel="stylesheet"\s+href="[^"]*"\s*/?\s*>',
        f"<style>\n{css_content}\n</style>",
        html,
        count=1,
    )
    return html


def inline_js(html):
    """将 <script src='...'> 替换为内联 <script>"""
    for js_file in JS_ORDER:
        js_content = read_text(ROOT / js_file)
        # 移除 JS 文件中的版本号查询参数
        pattern = rf'<script\s+src="{re.escape(js_file)}(?:\?[^"]*)?"\s*>\s*</script>'
        replacement = f"<script>\n{js_content}\n</script>"
        if not re.search(pattern, html):
            # 尝试不带查询参数的匹配
            pattern = rf'<script\s+src="{re.escape(js_file)}[^"]*"\s*>\s*</script>'
        html = re.sub(pattern, replacement, html, count=1)
    return html


def inline_images_in_js(html, img_map):
    """替换 HTML 中内联 JS 代码里的图片路径引用为 Data URI"""

    # 先处理模板字符串中的动态路径，避免被后续替换影响
    yuka_uris = []
    for i in range(0, 7):
        key = f"assets/yuka{i}.png" if i > 0 else "assets/yuka.png"
        if key in img_map:
            yuka_uris.append(f"'{img_map[key]}'")
        else:
            yuka_uris.append("''")
    yuka_lookup = f"[{','.join(yuka_uris)}]"
    html = html.replace(
        "const bgKey = color === 0 ? 'assets/yuka.png' : `assets/yuka${color}.png`;",
        f"const bgKey = ({yuka_lookup})[color] || '{img_map.get('assets/yuka.png', '')}';"
    )

    # 再替换简单的字符串引用
    for orig_path, data_uri in img_map.items():
        html = html.replace(f"'{orig_path}'", f"'{data_uri}'")
        html = html.replace(f'"{orig_path}"', f'"{data_uri}"')

    return html


def inline_favicon_and_meta(html, img_map):
    """替换 favicon 和 meta 中的图片引用"""
    for key, data_uri in img_map.items():
        html = html.replace(f'href="{key}"', f'href="{data_uri}"')
        html = html.replace(f'content="{key}"', f'content="{data_uri}"')
    return html


def remove_cache_meta(html):
    """移除开发用的缓存控制 meta 标签"""
    html = re.sub(
        r'<meta\s+http-equiv="Cache-Control"[^>]*>\s*',
        "",
        html,
    )
    html = re.sub(
        r'<meta\s+http-equiv="Pragma"[^>]*>\s*',
        "",
        html,
    )
    html = re.sub(
        r'<meta\s+http-equiv="Expires"[^>]*>\s*',
        "",
        html,
    )
    return html


def main():
    parser = argparse.ArgumentParser(description="Bugma 单文件打包工具")
    parser.add_argument(
        "-o", "--output", default=str(OUTPUT_DEFAULT), help=f"输出文件路径（默认: {OUTPUT_DEFAULT}）"
    )
    args = parser.parse_args()

    print("=" * 50)
    print("Bugma 单文件打包工具")
    print("=" * 50)

    # 1. 构建图片 Data URI 映射
    print("\n[1/5] 编码图片资源...")
    img_map = build_image_map()
    total_bytes = sum(
        (ROOT / f).stat().st_size for f in IMAGE_FILES if (ROOT / f).exists()
    )
    print(f"  总计: {len(img_map)} 张图片, {total_bytes:,} bytes")

    # 2. 读取 HTML
    print("\n[2/5] 读取 index.html...")
    html = read_text(ROOT / "index.html")

    # 3. 内联 CSS
    print("\n[3/5] 内联 CSS...")
    html = inline_css(html, img_map)

    # 4. 内联 JS
    print("\n[4/5] 内联 JavaScript...")
    html = inline_js(html)
    html = inline_images_in_js(html, img_map)

    # 5. 替换 HTML 中的图片引用
    print("\n[5/5] 替换 HTML 图片引用...")
    html = inline_favicon_and_meta(html, img_map)
    html = remove_cache_meta(html)

    # 清理可能残留的空白行
    html = re.sub(r"\n\s*\n\s*\n+", "\n\n", html)

    # 写入输出文件
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    output_size = output_path.stat().st_size
    print(f"\n{'=' * 50}")
    print(f"打包完成: {output_path}")
    print(f"文件大小: {output_size:,} bytes ({output_size / 1024:.1f} KB)")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()