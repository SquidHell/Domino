#!/usr/bin/env python3
"""Fabrique la build Y8 : le jeu tel quel + le SDK Y8 + l'adaptateur, en un seul
fichier prêt à zipper pour l'upload Y8 (y8/index.html)."""
import pathlib, re, sys

root    = pathlib.Path(__file__).resolve().parent.parent
game    = (root / "index.html").read_text()
adapter = (root / "y8" / "y8-adapter.js").read_text()
out     = root / "y8" / "index.html"

sdk = ('<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async></script>\n')

if 'cdn.y8.com' in game:
    sys.exit("index.html contient déjà le SDK Y8 : la build doit partir du jeu nu.")

html = game.replace('</head>', sdk + '</head>', 1)
html = html.replace('</body>', '<script>\n' + adapter + '</script>\n</body>', 1)

# marqueur de build, utile pour vérifier la version uploadée
html = html.replace('<title>Domino 2048</title>',
                    '<title>Domino 2048</title>\n<!-- build Y8 : jeu + minimal-sdk 2.0 -->', 1)

out.write_text(html)
print(f"{out.relative_to(root)} — {len(html)} octets")
