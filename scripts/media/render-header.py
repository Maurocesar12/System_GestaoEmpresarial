"""Render deterministic interface motion. Requires Pillow, numpy, imageio-ffmpeg.

python scripts/media/render-header.py [--poster-only]
All numbers and notifications are illustrative. No customer data is used.
"""
from pathlib import Path
import math
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.video-tools'))
OUT = ROOT / 'apps/web/public/media/header'
OUT.mkdir(parents=True, exist_ok=True)
W, H, SCALE, FPS, DURATION = 1920, 1080, 2, 30, 12
INK = '#302c28'
MUTED = '#81786f'
LINE = '#eee9e2'
ACCENT = '#b99272'
GREEN = '#57806c'
FONTS = {}

def px(v): return round(v * SCALE)
def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf', px(size))
    return FONTS[key]

def rect(im, box, fill, radius=0, outline=None, width=1):
    ImageDraw.Draw(im).rounded_rectangle(tuple(px(v) for v in box), px(radius), fill, outline, px(width))

def text(im, x, y, value, size=18, color=INK, bold=False):
    ImageDraw.Draw(im).text((px(x), px(y)), value, font=font(size,bold), fill=color, anchor='lt')

def line(im, points, color=LINE, width=1):
    ImageDraw.Draw(im).line([(px(x),px(y)) for x,y in points], fill=color, width=px(width), joint='curve')

def circle(im, x,y,r,fill):
    ImageDraw.Draw(im).ellipse((px(x-r),px(y-r),px(x+r),px(y+r)),fill=fill)

def card(im,box,radius=18):
    shadow=Image.new('RGBA',im.size)
    rect(shadow,(box[0],box[1]+12,box[2],box[3]+12),(57,43,30,20),radius)
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(px(22))))
    rect(im,box,'#fffefd',radius,'#e8e2d9')

def check(im,x,y):
    circle(im,x,y,19,'#ecf3ed')
    line(im,[(x-7,y),(x-2,y+5),(x+8,y-6)],GREEN,2)

def smooth(points):
    p=[points[0]]+points+[points[-1]]
    result=[]
    for i in range(1,len(p)-2):
        for j in range(18):
            t=j/18
            result.append(tuple(.5*((2*p[i][k])+(-p[i-1][k]+p[i+1][k])*t+(2*p[i-1][k]-5*p[i][k]+4*p[i+1][k]-p[i+2][k])*t*t+(-p[i-1][k]+3*p[i][k]-3*p[i+1][k]+p[i+2][k])*t*t*t) for k in (0,1)))
    return result+[points[-1]]

yy,xx=np.mgrid[0:px(H),0:px(W)]
glow=np.exp(-(((xx/px(W)-.76)/.45)**2+((yy/px(H)-.52)/.62)**2)*3)
arr=np.zeros((px(H),px(W),4),dtype=np.uint8)
for ch,(a,b) in enumerate([(250,241),(249,235),(246,227)]): arr[:,:,ch]=a+(b-a)*glow
arr[:,:,3]=255
BASE=Image.fromarray(arr)
del arr,xx,yy,glow

# Main application window; left third deliberately stays open for live HTML copy.
card(BASE,(730,212,1770,868),22)
rect(BASE,(752,232,1748,282),'#faf8f5',10)
for i,c in enumerate(['#d4cdc4','#ded7ce','#e8e2da']): circle(BASE,774+i*18,257,4,c)
rect(BASE,(1120,243,1410,271),'#f0ece6',7)
text(BASE,1192,249,'Visão do negócio',13,MUTED)
circle(BASE,1719,257,12,'#e8ded2')
text(BASE,1711,251,'GE',10,INK,True)
line(BASE,[(940,300),(940,843)],LINE)
rect(BASE,(759,313,793,347),'#c5a589',9)
for i,h in enumerate([8,14,21]): line(BASE,[(768+8*i,338),(768+8*i,338-h)],INK,3)
text(BASE,805,318,'Gestão',22,INK,True)
for i,label in enumerate(['Visão geral','Clientes','Orçamentos','Agenda','Financeiro']):
    y=390+i*56
    if i==0: rect(BASE,(750,y-12,922,y+30),'#f0e7dc',9)
    rect(BASE,(768,y,782,y+14),None,3,ACCENT if i==0 else '#aaa198',1)
    text(BASE,798,y-1,label,16,INK if i==0 else MUTED,i==0)
text(BASE,767,798,'GESTÃO EMPRESARIAL',10,MUTED,True)
text(BASE,972,315,'Seu negócio, em dia.',30,INK,True)
text(BASE,973,359,'Tudo o que importa, em uma visão.',16,MUTED)
rect(BASE,(1584,317,1736,353),'#f7f4ef',7,LINE)
text(BASE,1601,327,'Este mês',14,MUTED)
line(BASE,[(1705,332),(1709,336),(1713,332)],MUTED,1)

for x,title,val,detail in [(972,'Receita do mês','R$ 48.250','+12,8% no mês'),(1233,'Orçamentos','24','8 aprovados'),(1494,'Clientes ativos','128','+6 neste mês')]:
    rect(BASE,(x,405,x+242,531),'#fffefd',12,LINE)
    text(BASE,x+20,424,title,14,MUTED)
    text(BASE,x+20,452,val,30,INK,True)
    text(BASE,x+20,498,detail,12,GREEN)

rect(BASE,(972,554,1455,825),'#fffefd',12,LINE)
text(BASE,993,576,'Fluxo de caixa',18,INK,True)
circle(BASE,1311,585,4,ACCENT)
text(BASE,1323,578,'Receitas',12,MUTED)
for y,label in [(632,'50 mil'),(688,'25 mil'),(744,'0')]:
    text(BASE,995,y-5,label,11,MUTED)
    line(BASE,[(1044,y),(1429,y)],LINE)
for i,label in enumerate(['01','05','10','15','20','25','30']): text(BASE,1044+i*62,786,label,11,MUTED)

rect(BASE,(1473,554,1736,825),'#fffefd',12,LINE)
text(BASE,1494,576,'Orçamentos',18,INK,True)
text(BASE,1494,605,'Conversão por semana',12,MUTED)
for y in [649,700,750]: line(BASE,[(1495,y),(1715,y)],LINE)
for i in range(4): text(BASE,1504+i*55,786,f'S0{i+1}',11,MUTED)

# A restrained secondary card in front of the window.
card(BASE,(637,647,904,795),16)
text(BASE,659,668,'Saldo disponível',14,MUTED)
text(BASE,659,698,'R$ 32.480',29,INK,True)
circle(BASE,665,759,4,GREEN)
text(BASE,677,752,'Atualizado agora',12,MUTED)

def notification(title,subtitle):
    im=Image.new('RGBA',(px(505),px(140)))
    shadow=Image.new('RGBA',im.size)
    rect(shadow,(22,25,483,112),(57,43,30,26),15)
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(px(10))))
    rect(im,(22,15,483,102),'#fffefd',15,'#e8e2d9')
    check(im,57,57)
    text(im,88,34,title,17,INK,True)
    text(im,88,64,subtitle,13,MUTED)
    text(im,426,36,'agora',11,MUTED)
    return im

NOTICES=[notification('Pagamento recebido','R$ 2.450,00 • Saldo atualizado'),notification('Orçamento aprovado','Novo serviço pronto para agendar'),notification('Agenda organizada','Tudo certo para o próximo atendimento')]

def ease(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)

def frame(t):
    im=BASE.copy()
    phase=2*math.pi*t/DURATION
    pts=[]
    values=[737,715,724,686,698,665,676,639,650,620]
    for i,y in enumerate(values):
        pts.append((1048+i*41.8,y+math.sin(phase+i*.65)*5))
    pts=smooth(pts)
    poly=[(pts[0][0],765)]+pts+[(pts[-1][0],765)]
    fill=Image.new('RGBA',im.size)
    ImageDraw.Draw(fill).polygon([(px(x),px(y)) for x,y in poly],fill=(185,146,114,19))
    im.alpha_composite(fill)
    line(im,pts,ACCENT,3)
    # A subtle moving dot, without any abrupt graph reset.
    idx=round((.5-.5*math.cos(phase))* (len(pts)-1))
    dx,dy=pts[idx]
    circle(im,dx,dy,8,'#efe3d8')
    circle(im,dx,dy,4,ACCENT)
    for i,h in enumerate([58,84,71,108]):
        bh=h+math.sin(phase+i*.8)*9
        x=1500+i*55
        rect(im,(x,756-bh,x+24,756),'#b99272' if i==3 else '#ddd0c1',5)
        rect(im,(x+27,756-bh*.64,x+37,756),'#eee7de',4)
    # Periodic notification fades leave identical visual state at loop boundaries.
    for i,start in enumerate([.7,4.7,8.7]):
        local=t-start
        opacity=ease(local/.65)*ease((3.35-local)/.65)
        if opacity>0:
            n=NOTICES[i].copy()
            n.putalpha(n.getchannel('A').point(lambda a:round(a*opacity)))
            im.alpha_composite(n,(px(1243),px(130+12*(1-opacity))))
    return im.convert('RGB').resize((W,H),Image.Resampling.LANCZOS)

if __name__=='__main__':
    frame(2.5).save(OUT/'header-gestao-poster.jpg',quality=95,subsampling=0)
    previews=[frame(t).resize((640,360),Image.Resampling.LANCZOS) for t in [0,2.5,6.5,10.5]]
    contact=Image.new('RGB',(1280,720))
    for i,p in enumerate(previews): contact.paste(p,((i%2)*640,(i//2)*360))
    contact.save(OUT/'storyboard.jpg',quality=92)
    if '--poster-only' in sys.argv: sys.exit(0)
    import imageio_ffmpeg
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ffmpeg,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'header-gestao-fullhd-hq.mp4')]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for f in range(FPS*DURATION):
            proc.stdin.write(frame(f/FPS).tobytes())
            if f%30==0: print(f'Render {f//30}/{DURATION}s',flush=True)
    finally:
        proc.stdin.close()
    if proc.wait()!=0: raise RuntimeError('FFmpeg failed')
    print(f'Created: {OUT / "header-gestao-fullhd-hq.mp4"}',flush=True)
