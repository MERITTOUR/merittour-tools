"""pptxgenjs 는 같은 그림을 쓸 때마다 media 에 또 넣는다. 같은 바이트의 그림을 하나로 합치고 rels 를 고쳐 파일을 줄인다. 사용: python3 shrink.py out/*.pptx"""
import sys, zipfile, hashlib, re, shutil, os, posixpath
for src in sys.argv[1:]:
    with zipfile.ZipFile(src) as z:
        names = z.namelist(); data = {n: z.read(n) for n in names}
    canon = {}; dup = {}
    for n in names:
        if n.startswith('ppt/media/') and not n.endswith('/'):
            h = hashlib.sha1(data[n]).hexdigest()
            if h in canon: dup[n] = canon[h]
            else: canon[h] = n
    for n in names:
        if n.endswith('.rels'):
            s = data[n].decode('utf-8'); base = posixpath.dirname(posixpath.dirname(n))  # e.g. ppt/slides
            def fix(m):
                target = m.group(1); full = posixpath.normpath(posixpath.join(base, target))
                if full in dup:
                    return 'Target="%s"' % posixpath.relpath(dup[full], base)
                return m.group(0)
            s2 = re.sub(r'Target="([^"]+)"', fix, s)
            data[n] = s2.encode('utf-8')
    tmp = src + '.tmp'; before = os.path.getsize(src)
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in dup: continue
            item.compress_type = zipfile.ZIP_DEFLATED; zout.writestr(item, data[item.filename])
    shutil.move(tmp, src); print(os.path.basename(src), before, '->', os.path.getsize(src), 'dups', len(dup))
