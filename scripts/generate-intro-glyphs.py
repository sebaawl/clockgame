"""Extract exact Poppins outlines for the existing wordmark; runtime needs no parser."""
from pathlib import Path
import json
import re
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.qu2cuPen import Qu2CuPen

root = Path(__file__).resolve().parent.parent
font_path = root / 'node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff'
font = TTFont(font_path)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
word = re.search(r'<h1 id="start-title">([^<]+)</h1>', (root / 'src/main.js').read_text())[1]
result = {}
for char in dict.fromkeys(word):
    name = cmap[ord(char)]
    pen = RecordingPen()
    glyphs[name].draw(Qu2CuPen(pen, max_err=.00001, all_cubic=True))
    commands = []
    for op, points in pen.value:
        command = {'moveTo': 'M', 'lineTo': 'L', 'curveTo': 'C', 'closePath': 'Z'}[op]
        commands.append([command, *[round(n, 6) for point in points for n in point]])
    result[char] = commands
output = '// Generated from the bundled Poppins Bold 700 font; see scripts/generate-intro-glyphs.py.\n'
output += 'export const LOGO_UNITS = ' + str(font['head'].unitsPerEm) + ';\n'
output += 'export const LOGO_GLYPHS = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n'
(root / 'src/intro-glyphs.js').write_text(output)
