#!/usr/bin/env python3
"""Packs an unsigned, 4-byte-aligned APK without the Android SDK.

Writes a binary AndroidManifest.xml (AXML) and a one-entry resources.arsc
(the launcher icon) by hand, then zips them with classes.dex and assets/.

usage: mkapk.py <classes.dex> <icon.png> <assets_dir> <out.apk> [versionCode] [versionName]
"""
import os, struct, sys, zipfile

PKG = 'com.mochipop.game'
LABEL = 'Mochi Pop'
MIN_SDK, TARGET_SDK = 24, 34
ICON_ID = 0x7F010000  # package 0x7f, type 1 (drawable), entry 0

ATTR = {  # android.R.attr ids
    'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003, 'exported': 0x01010010,
    'screenOrientation': 0x0101001E, 'configChanges': 0x0101001F, 'minSdkVersion': 0x0101020C,
    'versionCode': 0x0101021B, 'versionName': 0x0101021C, 'targetSdkVersion': 0x01010270,
    'allowBackup': 0x01010280, 'hardwareAccelerated': 0x010102D3,
}
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
T_REF, T_STRING, T_INT_DEC, T_INT_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def pad4(b):
    return b + b'\0' * (-len(b) % 4)


def string_pool(strings, utf8):
    offs, data = [], b''
    for s in strings:
        offs.append(len(data))
        if utf8:
            e = s.encode('utf-8')
            assert len(s) < 128 and len(e) < 128
            data += bytes([len(s), len(e)]) + e + b'\0'
        else:
            data += struct.pack('<H', len(s)) + s.encode('utf-16-le') + b'\0\0'
    data = pad4(data)
    hdr = 28
    start = hdr + 4 * len(strings)
    body = b''.join(struct.pack('<I', o) for o in offs) + data
    return struct.pack('<HHIIIIII', 0x0001, hdr, hdr + len(body), len(strings), 0,
                       0x100 if utf8 else 0, start, 0) + body


# ---------- AXML ----------
def element(name, attrs=(), children=()):
    return (name, list(attrs), list(children))


def a(name, typ, val, ns=True):
    return (ns, name, typ, val)


MANIFEST = element('manifest', [
    a('versionCode', T_INT_DEC, None), a('versionName', T_STRING, None), a('package', T_STRING, PKG, ns=False),
], [
    element('uses-sdk', [a('minSdkVersion', T_INT_DEC, MIN_SDK), a('targetSdkVersion', T_INT_DEC, TARGET_SDK)]),
    element('uses-permission', [a('name', T_STRING, 'android.permission.VIBRATE')]),
    element('uses-permission', [a('name', T_STRING, 'android.permission.INTERNET')]),
    element('application', [
        a('label', T_STRING, LABEL), a('icon', T_REF, ICON_ID), a('allowBackup', T_BOOL, True),
        a('hardwareAccelerated', T_BOOL, True),
    ], [
        element('activity', [
            a('name', T_STRING, PKG + '.MainActivity'), a('exported', T_BOOL, True),
            a('screenOrientation', T_INT_DEC, 1),  # portrait
            a('configChanges', T_INT_HEX, 0x04B0),  # keyboardHidden|orientation|screenSize|keyboard... avoids reloads
        ], [
            element('intent-filter', [], [
                element('action', [a('name', T_STRING, 'android.intent.action.MAIN')]),
                element('category', [a('name', T_STRING, 'android.intent.category.LAUNCHER')]),
            ]),
        ]),
    ]),
])


def build_axml(root, version_code, version_name):
    # fill version placeholders
    root[1][0] = a('versionCode', T_INT_DEC, version_code)
    root[1][1] = a('versionName', T_STRING, version_name)
    # collect strings: resource-mapped attribute names first, in id order
    attr_names, others = set(), []

    def walk(el):
        name, attrs, kids = el
        for ns, an, typ, val in attrs:
            if ns: attr_names.add(an)
            else: others.append(an)
            if typ == T_STRING: others.append(val)
        others.append(name)
        for k in kids: walk(k)
    walk(root)
    mapped = sorted(attr_names, key=lambda n: ATTR[n])
    strings = list(mapped)
    for s in ['android', ANDROID_NS] + others:
        if s not in strings: strings.append(s)
    idx = {s: i for i, s in enumerate(strings)}

    chunks = [string_pool(strings, utf8=False)]
    rm = b''.join(struct.pack('<I', ATTR[n]) for n in mapped)
    chunks.append(struct.pack('<HHI', 0x0180, 8, 8 + len(rm)) + rm)
    chunks.append(struct.pack('<HHIIiII', 0x0100, 16, 24, 1, -1, idx['android'], idx[ANDROID_NS]))
    line = [1]

    def emit(el):
        name, attrs, kids = el
        line[0] += 1
        def key(at):
            return ATTR.get(at[1], 0xFFFFFFFF) if at[0] else 0
        body = b''
        attrs = sorted(attrs, key=key)
        for ns, an, typ, val in attrs:
            if typ == T_STRING:
                raw, data = idx[val], idx[val]
            elif typ == T_BOOL:
                raw, data = 0xFFFFFFFF, 0xFFFFFFFF if val else 0
            else:
                raw, data = 0xFFFFFFFF, val
            body += struct.pack('<iiIHBBI', idx[ANDROID_NS] if ns else -1, idx[an], raw, 8, 0, typ, data)
        ext = struct.pack('<iiHHHHHH', -1, idx[name], 20, 20, len(attrs), 0, 0, 0)
        chunks.append(struct.pack('<HHIIi', 0x0102, 16, 16 + len(ext) + len(body), line[0], -1) + ext + body)
        for k in kids: emit(k)
        line[0] += 1
        chunks.append(struct.pack('<HHIIiii', 0x0103, 16, 24, line[0], -1, -1, idx[name]))
    emit(root)
    chunks.append(struct.pack('<HHIIiII', 0x0101, 16, 24, line[0] + 1, -1, idx['android'], idx[ANDROID_NS]))
    body = b''.join(chunks)
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body


# ---------- resources.arsc ----------
def build_arsc(icon_path):
    values = string_pool([icon_path], utf8=True)
    types = string_pool(['drawable'], utf8=True)
    keys = string_pool(['icon'], utf8=True)
    spec = struct.pack('<HHIBBHII', 0x0202, 16, 20, 1, 0, 0, 1, 0)
    config = struct.pack('<I', 64) + b'\0' * 60
    hdr = 20 + len(config)
    entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STRING, 0)
    tbody = struct.pack('<I', 0) + entry
    typ = struct.pack('<HHIBBHII', 0x0201, hdr, hdr + len(tbody), 1, 0, 0, 1, hdr + 4) + config + tbody
    name = PKG.encode('utf-16-le').ljust(256, b'\0')
    phdr = 288
    pbody = types + keys + spec + typ
    pkg = struct.pack('<HHII', 0x0200, phdr, phdr + len(pbody), 0x7F) + name + struct.pack(
        '<IIIII', phdr, 1, phdr + len(types), 1, 0) + pbody
    body = values + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(body), 1) + body


# ---------- zip ----------
def add(zf, name, data, compress):
    zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    zi.external_attr = 0o644 << 16
    if not compress:  # align stored data to 4 bytes (zipalign equivalent)
        off = zf.fp.tell() + 30 + len(name.encode())
        zi.extra = b'\0' * (-off % 4)
    zf.writestr(zi, data)


def main():
    dex, icon, assets, out = sys.argv[1:5]
    vcode = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    vname = sys.argv[6] if len(sys.argv) > 6 else '1.0'
    icon_path = 'res/drawable/icon.png'
    with zipfile.ZipFile(out, 'w') as zf:
        add(zf, 'AndroidManifest.xml', build_axml(MANIFEST, vcode, vname), True)
        add(zf, 'resources.arsc', build_arsc(icon_path), False)
        add(zf, 'classes.dex', open(dex, 'rb').read(), True)
        add(zf, icon_path, open(icon, 'rb').read(), False)
        for root, _, files in os.walk(assets):
            for f in sorted(files):
                p = os.path.join(root, f)
                add(zf, 'assets/' + os.path.relpath(p, assets).replace(os.sep, '/'), open(p, 'rb').read(), True)
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
