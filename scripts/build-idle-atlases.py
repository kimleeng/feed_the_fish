"""Register generated whole-pose strips without changing their PNG pixels.
Usage: python scripts/build-idle-atlases.py [birds.png adults.png kids.png]
With no arguments, rebuild metadata from the committed source PNGs.
Requires Pillow. Source drawings must be 4 columns by 6 rows, with rest first.
"""
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public' / 'art'
BIRDS = ['preen', 'dabble', 'wing-stretch', 'scratch', 'double-nod', 'foot-paddle']


def inspect(source):
    image = Image.open(source)
    assert image.size == (1024, 1536), ('Expected 4x6 slots', image.size)
    alpha = image.getchannel('A').point(lambda v: 255 if v >= 64 else 0)
    edges = [0]
    for row in range(1, 6):
        # Generated hands, shoes and wing tips can cross a nominal slot edge.
        # Split on actual empty rows in each gutter instead of clipping them.
        empty = [y for y in range(row*256-32, row*256+33) if alpha.crop((0,y,1024,y+1)).getbbox() is None]
        assert empty, f'No clear gutter near row {row}'
        edges.append(empty[len(empty)//2])
    edges.append(1536)
    boxes = []
    for row in range(6):
        columns = [0]
        for col in range(1,4):
            empty = [x for x in range(col*256-40,col*256+41) if alpha.crop((x,edges[row],x+1,edges[row+1])).getbbox() is None]
            assert empty, ('No clear column gutter', row, col)
            columns.append(empty[len(empty)//2])
        columns.append(1024)
        for col in range(4):
            left, top, right, bottom = columns[col], edges[row], columns[col+1], edges[row+1]
            local = alpha.crop((left,top,right,bottom)).getbbox()
            assert local, ('Missing pose', row, col)
            l,t,r,b = local
            box = (left+l,top+t,left+r,top+b)
            assert box[0] > left and box[2] < right, ('Pose touches column edge', row, col, box)
            # Whole-body registration ignores an outstretched arm or wing.
            band_top = box[1]+round((box[3]-box[1])*0.68)
            band_bottom = box[1]+round((box[3]-box[1])*0.9)
            points = []
            for y in range(band_top,band_bottom):
                points += [x for x in range(box[0],box[2]) if alpha.getpixel((x,y))]
            points.sort()
            axis = points[len(points)//2]
            feet = alpha.crop((box[0],box[3]-16,box[2],box[3])).getbbox()
            foot_x = box[0]+(feet[0]+feet[2])/2
            boxes.append(dict(box=box, axis=axis, foot_x=foot_x))
    return boxes


def frame(name, info, reference, bird=False):
    l,t,r,b = info['box']
    x,y,w,h = l-1,t-1,r-l+2,b-t+2
    size = 512
    anchor = info['axis'] if bird else info['foot_x']
    sx = round(size/2 + x-anchor)
    baseline = size/2+reference*.2 if bird else size-1
    sy = round(baseline+y-b)
    assert sx>=0 and sy>=0 and sx+w<=size and sy+h<=size, (name,sx,sy,w,h)
    result = dict(filename=name, frame=dict(x=x,y=y,w=w,h=h), rotated=False, trimmed=True,
                  spriteSourceSize=dict(x=sx,y=sy,w=w,h=h), sourceSize=dict(w=size,h=size), referenceHeight=reference,
                  bodyBounds=dict(x=sx+1,y=sy+1,w=r-l,h=b-t))
    if bird: result['waterline'] = dict(x=sx+anchor-x,y=sy+b-y)
    else: result['feet'] = [dict(x=sx+anchor-x,y=sy+b-y)]
    return result


def texture(source, name, frames):
    rects=[f['frame'] for f in frames]
    for i,a in enumerate(rects):
        for b in rects[i+1:]:
            assert not (min(a['x']+a['w'],b['x']+b['w'])>max(a['x'],b['x']) and
                        min(a['y']+a['h'],b['y']+b['h'])>max(a['y'],b['y'])), 'Overlapping frames'
    target=ART/name
    if Path(source).resolve()!=target.resolve(): shutil.copyfile(source,target)
    return dict(image=name,size=dict(w=1024,h=1536),frames=frames)


def build(birds, adults, kids):
    boxes=inspect(birds);frames=[]
    for row,habit in enumerate(BIRDS):
        b=boxes[row*4]['box'];reference=(b[3]-b[1])/[.53,.51,.46][row//2]
        for col in range(4): frames.append(frame(f'{habit}-{col}',boxes[row*4+col],reference,True))
    (ART/'animal-idles.json').write_text(json.dumps(dict(textures=[texture(birds,'bird-idles.png',frames)]),indent=2)+'\n')
    textures=[]
    for age,source in [('adult',adults),('kid',kids)]:
        boxes=inspect(source);frames=[]
        for row in range(6):
            b=boxes[row*4]['box'];reference=b[3]-b[1]
            for col in range(4): frames.append(frame(f'observer-{age}-{row}-idle-{col}',boxes[row*4+col],reference))
        textures.append(texture(source,f'observer-{age}-idles.png',frames))
    (ART/'observer-idles.json').write_text(json.dumps(dict(textures=textures),indent=2)+'\n')
    print('Registered 24 bird and 48 visitor poses with shared scales and waterline/foot anchors.')

if __name__=='__main__':
    sources = sys.argv[1:] or [ART/'bird-idles.png', ART/'observer-adult-idles.png', ART/'observer-kid-idles.png']
    if len(sources) != 3: raise SystemExit(__doc__)
    build(*sources)
