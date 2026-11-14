# Byter neutrala graa hex-farger mot varma motsvarigheter (designsprak 2026-11c).
# Kor fran repots rot: python3 scripts/warm-greys.py
import re, glob, sys
A = [(0,(15,13,10)),(18,(29,26,22)),(42,(51,47,42)),(100,(108,102,94)),(154,(160,154,145)),(201,(205,198,187)),(255,(246,240,229))]
def warm(v):
    for (v0,c0),(v1,c1) in zip(A,A[1:]):
        if v0 <= v <= v1:
            t = (v-v0)/(v1-v0) if v1>v0 else 0
            return tuple(round(a+(b-a)*t) for a,b in zip(c0,c1))
def fix(m):
    h = m.group(1)
    if len(h)==3: h=''.join(c*2 for c in h)
    r,g,b = int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)
    if not (r==g==b): return m.group(0)
    c = warm(r)
    return '#%02X%02X%02X' % c
n=0
files = [f for f in glob.glob('src/**/*.css',recursive=True)+glob.glob('src/**/*.jsx',recursive=True) if 'Admin' not in f]
for f in files:
    s=open(f).read()
    t=re.sub(r'#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b(?![0-9A-Za-z])', fix, s)
    if t!=s:
        n+=1; open(f,'w').write(t)
print('filer', n)
