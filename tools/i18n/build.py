"""Builds www/i18n/<lang>.js from tools/i18n/<lang>.txt (lines 'n|text' for each English string, 'Pn|text' for each pattern).
English source: tools/i18n/source.json ({keys, pat}). Checks every line exists and placeholders ($1, $2...) match."""
import json, pathlib, re, sys
D = pathlib.Path(__file__).parent; OUT = D.parent.parent / 'www' / 'i18n'; OUT.mkdir(exist_ok=True)
src = json.loads((D / 'source.json').read_text(encoding='utf-8')); keys, pat = src['keys'], src['pat']; bad = 0
for f in sorted(D.glob('*.txt')):
    lang = f.stem; rows = {}
    for ln in f.read_text(encoding='utf-8').splitlines():
        if '|' in ln: n, t = ln.split('|', 1); rows[n.strip()] = t
    t = {}
    for i, k in enumerate(keys, 1):
        v = rows.get(str(i))
        if v is None: print(f'{lang}: missing line {i} ({k})'); bad += 1; continue
        t[k] = v
    p = []
    for i, (rx, en) in enumerate(pat, 1):
        v = rows.get(f'P{i}')
        if v is None: print(f'{lang}: missing pattern P{i}'); bad += 1; continue
        if sorted(re.findall(r'\$\d', v)) != sorted(re.findall(r'\$\d', en)): print(f'{lang}: P{i} placeholders differ'); bad += 1
        p.append([rx, v])
    (OUT / f'{lang}.js').write_text('window.GROUNDWORK_I18N=' + json.dumps({'lang': lang, 't': t, 'p': p}, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'{lang}: {len(t)} strings, {len(p)} patterns')
sys.exit(1 if bad else 0)
