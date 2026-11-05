"""pptxgenjs 가 쓴 테마에 메리트투어 색 12개와 글꼴(라틴 + 동아시아)을 써 넣는다. 사용: python3 theme.py out/*.pptx"""
import sys, zipfile, re, shutil, os
COLORS = {'dk1':'1E2618','lt1':'FFFFFF','dk2':'373F4A','lt2':'F6F2E8','accent1':'7F6019','accent2':'C9A876','accent3':'4C573F','accent4':'5F6B47','accent5':'EDE7D6','accent6':'D7263D','hlink':'7F6019','folHlink':'4C573F'}
HEAD, BODY = 'Noto Serif KR', 'Noto Sans KR'
def fix_theme(s):
    for k, v in COLORS.items():
        s, n = re.subn(r'<a:%s>.*?</a:%s>' % (k, k), '<a:%s><a:srgbClr val="%s"/></a:%s>' % (k, v, k), s, flags=re.S)
        assert n == 1, k
    s = re.sub(r'<a:clrScheme name="[^"]*"', '<a:clrScheme name="MERITTOUR"', s)
    def fonts(block, face):
        block = re.sub(r'<a:latin typeface="[^"]*"', '<a:latin typeface="%s"' % face, block)
        return re.sub(r'<a:ea typeface="[^"]*"/>', '<a:ea typeface="%s"/>' % face, block)
    s = re.sub(r'<a:majorFont>.*?</a:majorFont>', lambda m: fonts(m.group(0), HEAD), s, flags=re.S)
    s = re.sub(r'<a:minorFont>.*?</a:minorFont>', lambda m: fonts(m.group(0), BODY), s, flags=re.S)
    return s
for src in sys.argv[1:]:
    tmp = src + '.tmp'
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.startswith('ppt/theme/') and item.filename.endswith('.xml'):
                data = fix_theme(data.decode('utf-8')).encode('utf-8')
            item.compress_type = zipfile.ZIP_DEFLATED; zout.writestr(item, data)
    shutil.move(tmp, src); print('theme applied', os.path.basename(src))
