"""Inventory installed exact dependency versions; preserve available distribution notices."""
from importlib import metadata
from pathlib import Path
import json
import shutil
base = Path('THIRD_PARTY_NOTICES/python')
base.mkdir(parents=True, exist_ok=True)
rows = []
for dist in sorted(metadata.distributions(), key=lambda d: d.metadata['Name'].lower()):
    name = dist.metadata['Name']
    files = []
    for item in dist.files or []:
        text = str(item)
        if '.dist-info/' not in text:
            continue
        relative = text.split('.dist-info/', 1)[1]
        if not (relative.startswith('licenses/') or Path(relative).name.lower().startswith(('license', 'copying', 'notice'))):
            continue
        source = Path(dist.locate_file(item))
        if source.is_file():
            dest = base / name / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, dest)
            files.append(relative)
    rows.append({'name': name, 'version': dist.version, 'license': dist.metadata.get('License-Expression') or dist.metadata.get('License') or 'REVIEW REQUIRED', 'noticeFiles': files})
Path('THIRD_PARTY_NOTICES/python-inventory.json').write_text(json.dumps(rows, indent=2) + '\n')
