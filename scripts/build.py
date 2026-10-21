#!/usr/bin/env python3
"""Build the single-file index.html from src/ and media/favicon.svg.

Uses only the Python standard library. Run it after editing anything in src/ or media/.
"""
import base64
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'


def build():
    scripts = [path.read_text(encoding='utf-8') for path in sorted((SRC / 'js').glob('*.js'))]
    favicon = 'data:image/svg+xml;base64,' + base64.b64encode((ROOT / 'media' / 'favicon.svg').read_bytes()).decode()
    html = (SRC / 'index.html').read_text(encoding='utf-8')
    html = html.replace('@build:favicon', favicon)
    html = html.replace('/* @build:css */', (SRC / 'styles.css').read_text(encoding='utf-8').strip())
    html = html.replace('/* @build:js */', '\n'.join(script.strip() + '\n' for script in scripts))
    # The output must not load anything: no remote scripts, stylesheets, images, or fonts.
    remote = re.findall(r'''(?:src|href)\s*=\s*["']?(?:https?:)?//''', html) + re.findall(r'@import|url\(\s*["\']?https?:', html)
    if remote:
        raise SystemExit(f'Refusing to build: the page references remote resources {remote}.')
    (ROOT / 'index.html').write_text(html, encoding='utf-8')
    print(f'Built index.html: {len(scripts)} scripts, {len(html) // 1024} KB.')


if __name__ == '__main__':
    build()
