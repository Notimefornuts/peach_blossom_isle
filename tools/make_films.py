"""Generate the five original silent moving studies. Requires Pillow and ffmpeg."""
from pathlib import Path
from PIL import Image, ImageDraw
import math, random, subprocess
root=Path(__file__).resolve().parents[1]
W,H,FPS,SECONDS=640,360,15,9
random.seed(314)
petals=[(random.random(),random.random(),random.random()) for _ in range(20)]
for name in ['relations','healing','study','practice','sleep']:
    dst=root/'media'/f'{name}.mp4'
    cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-crf','25','-movflags','+faststart',str(dst)]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE) as ff:
        for frame in range(FPS*SECONDS):
            t=frame/FPS
            night=name=='sleep'
            im=Image.new('RGB',(W,H),(40,64,82) if night else (216,230,220));d=ImageDraw.Draw(im)
            for y in range(H):
                u=y/H
                a=(40,64,82) if night else (224,232,217);b=(48,88,106) if night else (153,193,190)
                d.line((0,y,W,y),fill=tuple(int(a[i]*(1-u)+b[i]*u) for i in range(3)))
            if name in ['healing','sleep']:
                if night:d.ellipse((485,43,535,93),fill=(228,230,210))
                for j in range(22):
                    y=170+j*8
                    x=30+((j*113+t*5)%530)
                    d.arc((x-34,y-2,x+45,y+4),0,160,fill=(190,211,205) if not night else (90,126,139),width=1)
            if name=='relations':
                d.rounded_rectangle((150,100,490,310),6,fill=(159,122,81),outline=(91,71,53),width=3)
                for i in range(19):
                    x=172+i*16.4;y=118+i*9.6
                    d.line((x,118,x,291),fill=(85,68,49),width=1);d.line((172,y,467,y),fill=(85,68,49),width=1)
                moves=[(3,3),(15,15),(15,3),(3,15),(9,9),(10,9),(9,10),(10,10),(11,9),(11,10)]
                for i,(x,y) in enumerate(moves[:min(10,6+int(t*.5))]):
                    px,py=172+x*16.4,118+y*9.6;d.ellipse((px-7,py-4,px+7,py+4),fill=(232,227,213) if i%2 else (43,53,50),outline=(95,92,75))
            if name=='study':
                d.polygon([(150,268),(149,127),(320,148),(486,125),(487,266),(320,288)],fill=(242,232,205),outline=(121,126,99))
                for side in [-1,1]:
                    for j in range(8):
                        x=320+side*(30+j*15);d.line((x,167,x,245-(j%3)*5),fill=(136,147,124),width=2)
                d.line((320,149,320,285),fill=(165,157,129),width=2)
            if name=='practice':
                for i in range(7):
                    x=80+i*74; sway=5*math.sin(t*.5+i)
                    d.line((x,360,x+sway,10),fill=(83+i%3*8,118+i%3*5,99),width=5)
                    for j in range(4):
                        y=50+j*65;xx=x+sway*(1-y/360);d.line((xx-4,y,xx+5,y),fill=(161,181,136),width=3)
                        for k in [-1,1]:d.polygon([(xx,y),(xx+k*54,y-18+math.sin(t+i)*3),(xx+k*29,y+4)],fill=(113,151,121))
                d.ellipse((253,289,387,322),fill=(167,171,141));d.ellipse((277,287,363,306),fill=(187,180,141))
            if name=='sleep':
                d.rounded_rectangle((125,76,346,306),4,fill=(47,59,66),outline=(116,128,124),width=5)
                for x in [180,237,292]:d.line((x,78,x,306),fill=(111,122,117),width=3)
                for y in [154,232]:d.line((126,y,345,y),fill=(111,122,117),width=3)
                glow=int(205+10*math.sin(t*.7));d.ellipse((397,198,453,279),fill=(glow,180,117));d.line((397,275,455,275),fill=(105,89,66),width=5)
            for i,(a,b,c) in enumerate(petals):
                x=(a*W+t*(8+c*7))%W;y=(b*H+t*(4+c*4))%H
                if night and i>5:continue
                d.ellipse((x-3,y-1,x+4,y+2),fill=(225,185,190) if not night else (161,142,158))
            ff.stdin.write(im.tobytes())
        ff.stdin.close()
        if ff.wait():raise RuntimeError(dst)
    print(dst.name,dst.stat().st_size)
