"""Draw the measured courtyard plan; input comes from export_layout.mjs."""
import json, math, random, sys
from pathlib import Path
import cairosvg
ROOT=Path(__file__).resolve().parents[1]
data=json.loads(Path(sys.argv[1]).read_text())
OUT=ROOT/'docs';OUT.mkdir(exist_ok=True)
S=75;CX=615;CZ=539
svg=['''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100"><defs><linearGradient id="lake" x2="0" y2="1"><stop stop-color="#f1f1e7"/><stop offset="1" stop-color="#d5e6e2"/></linearGradient><linearGradient id="turf" x2=".6" y2="1"><stop stop-color="#d9dfc3"/><stop offset="1" stop-color="#c2cdaa"/></linearGradient><filter id="shadow" x="-.3" y="-.3" width="1.6" height="1.6"><feDropShadow dx="0" dy="9" stdDeviation="12" flood-color="#486960" flood-opacity=".16"/></filter><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#ad7453" stroke-width="1.4"/></marker></defs><rect width="1600" height="1100" fill="url(#lake)"/><g font-family="Noto Sans CJK SC, sans-serif">''']
def xy(p):return(CX+p[0]*S,CZ+p[1]*S)
def poly(points,fill,stroke='none',sw=1,extra=''):
 svg.append(f'<polygon points="'+ ' '.join(f'{x:.2f},{y:.2f}'for x,y in points)+f'" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def line(points,color,width=2,extra=''):
 svg.append('<polyline points="'+' '.join(f'{x:.2f},{y:.2f}'for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')
def circ(x,y,r,fill,stroke='none',sw=1,extra=''):
 svg.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def rect(x,y,w,h,fill,stroke='none',r=0,extra=''):
 svg.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r}" fill="{fill}" stroke="{stroke}" {extra}/>')
def txt(x,y,s,size=20,fill='#3b564b',weight='400',anchor='start',extra=''):
 svg.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>')
def world_rect(x,z,w,d,fill,stroke='none',r=0):
 px,py=xy([x-w/2,z-d/2]);rect(px,py,w*S,d*S,fill,stroke,r)
# Header and restrained editorial framing.
txt(58,70,'桃花岛 · 双桥与曲水布局',38,weight='600')
txt(60,108,'水从竹林流向棋席 · 木桥与石板桥各自连接两岸',20,fill='#6b8076')
line([(60,133),(1540,133)],'#afc4ba',1)
# Exact island outline, softened water rings and planted earth.
for k in [1.10,1.055]:line([xy([p[0]*k,p[1]*k])for p in data['island']+[data['island'][0]]],'#bfd8d3',2,extra='opacity=".65"')
poly([xy(p)for p in data['island']],'url(#turf)','#99a58c',14,'filter="url(#shadow)"')
random.seed(41)
for i in range(62):
 j=int(i/62*len(data['island']));p=data['island'][j];q=xy([p[0]*.96,p[1]*.96]);circ(*q,random.uniform(5,12),random.choice(['#a4b594','#acba98','#b8c59f']),extra='opacity=".65"')
# Tree canopy is transparent so the occupied ground remains readable.
tx,tz=-2.85,-1.40
for dx,dz,r in [(-1,-.35,1.20),(-.8,-1.2,1.1),(.4,-1.2,1.2),(1.1,-.2,1.05),(.7,.8,1.1),(-.45,.6,1.25)]:
 circ(*xy([tx+dx,tz+dz]),r*S,'#e2b4b4','#d9a5ab',1,extra='opacity=".38"')
for dx,dz in[[-1.5,-1],[.7,-1.5],[1.7,-.1],[.9,1.3],[-1.4,1.1]]:line([xy([tx,tz]),xy([tx+dx*.55,tz+dz*.55]),xy([tx+dx,tz+dz])],'#997f69',5,extra='opacity=".70"')
circ(*xy([tx,tz]),.21*S,'#8e7462')
txt(*xy([-3.15,-.3]),'桃花树 · 原位',21,anchor='middle')
# Existing bamboo remains behind the new meditation position.
for i in range(27):
 a=random.uniform(-1.95,1.55);x=4.12+math.cos(a)*random.uniform(.91,1.30);z=-.36+math.sin(a)*random.uniform(.68,1)
 if math.hypot(x-4.12,z-.64)<.83:continue
 p=xy([x,z]);line([(p[0],p[1]+12),(p[0]-2,p[1]-28)],'#77967c',4)
 for h,sign in[(3,1),(-8,-1),(-18,1)]:line([(p[0],p[1]+h),(p[0]+sign*14,p[1]+h-12)],'#8aa58b',3)
txt(*xy([5.05,-1.48]),'竹林 · 原位',18,anchor='middle')
# Winding channel is one continuous, varying-width body of water.
poly([xy(p)for p in data['streamOutline']],'#83b8b8','#97aaa0',8)
for i in range(9,121,16):
 p=data['streamLine'][i];q=xy(p);line([(q[0]-10,q[1]-2),(q[0],q[1]+1),(q[0]+10,q[1]-3)],'#cae2d8',2)
for i in[23,53,74,98]:
 q=xy(data['streamLine'][i]);svg.append(f'<ellipse cx="{q[0]}" cy="{q[1]}" rx="4" ry="2" fill="#e7b7be" transform="rotate(-25 {q[0]} {q[1]})"/>')
# Contiguous paths: pale bedding ribbon, naturally varied stone courses.
for path in data['paths']:
 pts=[xy(p)for p in path['samples']];line(pts,'#b4b9a2',path['width']*S+5);line(pts,'#dedac4',path['width']*S)
 n=max(2,int(sum(math.dist(a,b)for a,b in zip(path['samples'],path['samples'][1:]))/.32))
 for j in range(n+1):
  k=min(99,round(j/n*100));p=path['samples'][k];a=path['samples'][max(0,k-1)];b=path['samples'][min(100,k+1)];dx,dz=b[0]-a[0],b[1]-a[1];norm=math.hypot(dx,dz);nx,nz=-dz/norm,dx/norm
  for side in[-1,1]:
   x=p[0]+nx*side*path['width']*.22;z=p[1]+nz*side*path['width']*.22
   pts=[]
   for m in range(6):
    angle=m*math.pi/3+.2;rr=random.uniform(.86,1.08);across=math.cos(angle)*path['width']*.30*rr;along=math.sin(angle)*.18*rr
    pts.append(xy([x+nx*across+dx/norm*along,z+nz*across+dz/norm*along]))
   poly(pts,random.choice(['#e6e1cd','#d9d7c3','#e0dcc8']),'#b7b8a4',1)
f=data['forecourt'];world_rect((f['minX']+f['maxX'])/2,(f['minZ']+f['maxZ'])/2,f['maxX']-f['minX'],f['maxZ']-f['minZ'],'#e4dfcc','#aeb5a1',7)
for x in[.45,.99,1.54]:line([xy([x,.97]),xy([x,1.61])],'#bcc0ac',1)
line([xy([-.07,1.30]),xy([2.07,1.30])],'#bcc0ac',1)
for i in range(5):
 a=1.24;axis=(math.cos(a),math.sin(a));side=(-axis[1],axis[0]);p=data['lakeStep'];x=p[0]+axis[0]*i*.28;z=p[1]+axis[1]*i*.28
 poly([xy([x+axis[0]*v+side[0]*u,z+axis[1]*v+side[1]*u])for u,v in[[-.55,-.12],[.55,-.12],[.55,.12],[-.55,.12]]],'#d5d5c0','#a9b4a1',1,extra=f'opacity="{1-i*.11}"')
# House uses the existing floor and both roof footprints.
world_rect(1.10,-1.1668,5.796,3.5568,'#b79d7b','#8e8068',3)
world_rect(-.88,-1.3436,2.076,3.38,'#748982','#627770',4)
world_rect(1.88,-1.3748,4.944,3.5672,'#71857f','#576f68',5)
for x in[.0,.3,.6,.9,1.2,1.5,1.8,2.1,2.4,2.7,3,3.3,3.6,3.9]:line([xy([x,-3.08]),xy([x,.32])],'#8b9c94',1)
line([xy([-.45,-1.375]),xy([4.22,-1.375])],'#bac3b0',7)
for a,b in[[[-.55,-3.08],[.25,-1.375]],[[-.55,.32],[.25,-1.375]],[[4.25,-3.08],[3.4,-1.375]],[[4.25,.32],[3.4,-1.375]]]:line([xy(a),xy(b)],'#9dafa3',4)
txt(*xy([1.90,-1.92]),'两层主屋 · 原位保留',25,'#f5f0df','500','middle')
world_rect(.944,.78,1.28,.30,'#b8bba9','#939e90',2)
# Existing chess table and opposing floor cushions.
world_rect(-2.75,1.70,1.92,1.30,'#a38561','#806c52',4)
world_rect(-2.84,1.72,.98,.98,'#d5bb87','#8c7b59',1)
for i in range(19):
 x=-3.2745+i*.869/18;z=1.2855+i*.869/18
 line([xy([x,1.2855]),xy([x,2.1545])],'#887652',.5)
 line([xy([-3.2745,z]),xy([-2.4055,z])],'#887652',.5)
for i in range(12):
 p=xy([-3.15+((i*7)%17)*.043,1.36+((i*11)%17)*.043]);circ(*p,2,'#eae5d4'if i%2 else'#33423b')
for z in[.71,2.69]:circ(*xy([-2.75,z]),.25*S,'#bead81','#948763',1)
# New stone seat, centered woven cushion and lantern behind/right.
m=data['meditation'];mp=xy([m['x'],m['z']]);circ(*mp,m['radius']*S,'#d5d4bf','#a8b19c',2)
for i in range(10):
 a=i/10*math.tau;line([(mp[0]+math.cos(a)*.43*S,mp[1]+math.sin(a)*.43*S),(mp[0]+math.cos(a)*.72*S,mp[1]+math.sin(a)*.72*S)],'#b5bba7',1)
circ(*mp,.35*S,'#d7bd8a','#bca06c',2)
for r in[5,9,13,17,21]:circ(*mp,r,'none','#c1a775',.8)
l=data['lantern'];lp=xy([l['x'],l['z']]);poly([(lp[0]-21,lp[1]),(lp[0],lp[1]-21),(lp[0]+21,lp[1]),(lp[0],lp[1]+21)],'#a5b09f','#798d7c',2);rect(lp[0]-7,lp[1]-7,14,14,'#ead1a0','#8c947d',2)
# Bridge footprint and timber courses, matched to the retained GLB.
b=data['bridge'];bp=xy([b['x'],b['z']]);angle=math.degrees(math.atan2(b['axis'][1],b['axis'][0]));svg.append(f'<g transform="translate({bp[0]} {bp[1]}) rotate({angle})">')
rect(-b['length']*S/2,-.39*S,b['length']*S,.78*S,'#b99262','#8e704d',5)
for i in range(18):x=(i/17-.5)*b['length']*S*.92;line([(x,-.34*S),(x,.34*S)],'#896b49',1)
for side in[-1,1]:
 line([(-b['length']*S/2,side*.52*S),(b['length']*S/2,side*.52*S)],'#99764f',6)
 for x in[-b['length']*S/2,b['length']*S/2]:circ(x,side*.52*S,5,'#c7a777','#8f724f')
svg.append('</g>')
# Low stone bridge: one real crossing from the house side to the seat side.
s=data['stoneBridge'];sp=xy([s['x'],s['z']]);angle=math.degrees(math.atan2(s['axis'][1],s['axis'][0]));svg.append(f'<g transform="translate({sp[0]} {sp[1]}) rotate({angle})">')
rect(-s['length']*S/2,-s['width']*S/2,s['length']*S,s['width']*S,'#c7c8b5','#969f90',3)
line([(-s['length']*S/2+4,0),(s['length']*S/2-4,0)],'#a9af9f',1.5)
svg.append('</g>')
# Direction of the primary journey, with a separate crossing by the house.
for path in data['paths'][:3]:
 pts=[xy(p)for p in path['samples']];line(pts,'#ad7453',2.6,extra='stroke-dasharray="3 8" opacity=".85"');k=55;line([pts[k],pts[k+5]],'#ad7453',2.6,extra='marker-end="url(#arrow)"')
for path in data['paths'][3:5]:
 pts=[xy(p)for p in path['samples']];line(pts,'#ad7453',2.1,extra='stroke-dasharray="3 8" opacity=".7"')
# Small blue arrows indicate the actual animation direction, bamboo to Go.
for i in[12,45,78,110]:
 a=xy(data['streamLine'][i]);b_=xy(data['streamLine'][i+4]);dx=b_[0]-a[0];dy=b_[1]-a[1];d=math.hypot(dx,dy);nx,ny=dx/d,dy/d
 line([(a[0]-nx*7,a[1]-ny*7),(a[0]+nx*7,a[1]+ny*7)],'#417f80',2)
 line([(a[0]+nx*7-ny*4-nx*5,a[1]+ny*7+nx*4-ny*5),(a[0]+nx*7,a[1]+ny*7),(a[0]+nx*7+ny*4-nx*5,a[1]+ny*7-nx*4-ny*5)],'#417f80',2)
# Discrete numbered landmarks.
for n,p in[(1,[.96,1.15]),(2,[-1.47,1.52]),(3,[-2.1,3.85]),(4,[1.44,4.48]),(5,[4.4,2.9])]:
 x,y=xy(p);circ(x,y,16,'#fff7e8','#ad8460',1.5);txt(x,y+7,str(n),19,'#8b6548','500','middle')
txt(*xy([.96,1.98]),'完整干燥入口平台',16,anchor='middle')
txt(*xy([-.60,3.10]),'曲水',18,'#407f81','500','middle')
txt(*xy([3.62,3.53]),'打坐石台',19,anchor='middle')
txt(*xy([4.90,2.14]),'石灯',16,anchor='middle')
txt(*xy([2.22,1.15]),'石板桥',16,anchor='middle')
txt(108,208,'后方 / 主屋',17,'#648375')
line([(118,235),(118,210)],'#648375',2,extra='marker-end="url(#arrow)"')
txt(108,1000,'前方 / 湖面',17,'#648375')
# Side notes explain the system rather than isolated model placements.
rect(1210,174,334,792,'#faf7ee','#c5d0bf',18)
txt(1240,221,'曲水与两条过水路',23,weight='600')
rows=[('01','水流','竹林前起水，向左蜿蜒','在棋桌附近收束'),('02','木桥','棋桌旁斜跨水道','两端接入前后岸小径'),('03','石桥','主屋与打坐台之间','低矮石板横跨连续水面'),('04','游线','出屋、对弈、过木桥','沿前岸至竹林静修'),('05','回游','从打坐台过石板桥','可返回主屋入口平台')]
for i,(n,title,a,b_)in enumerate(rows):
 y=275+i*122;txt(1240,y,n,20,'#a4825f','500');txt(1283,y,title,23,weight='500');txt(1240,y+33,a,18,'#63796b');txt(1240,y+61,b_,18,'#63796b')
txt(1240,931,'水流方向与实际动画一致',17,'#7a8c7b')
# Legend and footer.
line([(60,1022),(1540,1022)],'#afc4ba',1)
rect(66,1047,28,13,'#83b8b8',r=4);txt(105,1061,'浅曲水',17)
rect(234,1047,28,13,'#dfdbc5','#b5b8a2',4);txt(273,1061,'连续石径',17)
line([(425,1053),(470,1053)],'#ad7453',3,extra='stroke-dasharray="3 7"');txt(483,1061,'主游线',17)
line([(623,1053),(665,1053)],'#417f80',2);txt(678,1061,'水流方向',17)
txt(1540,1061,'同一套坐标用于俯视预览与三维场景',17,'#6b8076',anchor='end')
svg.append('</g></svg>')
p=OUT/'courtyard-layout.svg';p.write_text('\n'.join(svg))
cairosvg.svg2png(url=str(p),write_to=str(OUT/'courtyard-layout.png'),output_width=2000,output_height=1375)
print(OUT/'courtyard-layout.png')
