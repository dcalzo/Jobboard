from pathlib import Path

for p in Path('.').rglob('*.js'):
    if 'node_modules' in p.parts:
        continue
    if 'venv' in p.parts or '.venv' in p.parts:
        continue
    txt = p.read_text('utf-8').splitlines()
    out = [line for line in txt if 'console.log(' not in line]
    if len(out) != len(txt):
        p.write_text('\n'.join(out) + '\n', encoding='utf-8')
        print(f'cleaned {p}')
print('done')
