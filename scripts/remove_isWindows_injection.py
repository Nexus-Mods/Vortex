#!/usr/bin/env python3
"""
Remove injected lines `const { isWindows } = require('vortex-api');` from node_modules.

Targets:
- root `node_modules/`
- `extensions/*/node_modules/`

Safely edits files by removing exact matching lines (single or double quotes).
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

TARGET_DIRS = []

# Root node_modules
root_nm = os.path.join(ROOT, 'node_modules')
if os.path.isdir(root_nm):
    TARGET_DIRS.append(root_nm)

# Extensions node_modules
ext_root = os.path.join(ROOT, 'extensions')
if os.path.isdir(ext_root):
    for name in os.listdir(ext_root):
        nm = os.path.join(ext_root, name, 'node_modules')
        if os.path.isdir(nm):
            TARGET_DIRS.append(nm)

PATTERNS = {
    "const { isWindows } = require('vortex-api');",
    'const { isWindows } = require("vortex-api");',
}

def process_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except (UnicodeDecodeError, OSError):
        return False

    # Fast check
    if not any(any(p in line for p in PATTERNS) for line in lines):
        return False

    new_lines = []
    removed = 0
    for line in lines:
        if line.strip() in PATTERNS:
            removed += 1
            continue
        new_lines.append(line)

    if removed:
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"[cleaned] {path} (-{removed} lines)")
            return True
        except OSError:
            print(f"[error] failed to write: {path}")
    return False

def walk_dir(dir_path):
    cleaned = 0
    for root, dirs, files in os.walk(dir_path):
        # Skip nested node_modules inside node_modules to reduce work
        dirs[:] = [d for d in dirs if d != 'node_modules']
        for fn in files:
            # Only process typical source files
            if not (fn.endswith('.js') or fn.endswith('.cjs') or fn.endswith('.mjs') or fn.endswith('.ts') or fn.endswith('.tsx')):
                # But allow no-extension files (like bin scripts)
                if '.' in fn:
                    continue
            path = os.path.join(root, fn)
            if process_file(path):
                cleaned += 1
    return cleaned

def main():
    total = 0
    for d in TARGET_DIRS:
        print(f"Scanning: {d}")
        total += walk_dir(d)
    print(f"Total files cleaned: {total}")
    return 0

if __name__ == '__main__':
    sys.exit(main())