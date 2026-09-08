"""Build a clean low-poly QQQ seed bag with a continuous front UV.

The GLB is deterministic and self-contained. Its QQQ artwork is baked into
one front material; no runtime decals, text meshes, or provider assets exist.
"""
from __future__ import annotations

import io
import json
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "models-v29" / "items" / "stock-seed-packs" / "qqq-seed-pack.glb"
PREVIEW = ROOT / "review" / "qqq-clean-uv-v5" / "qqq-front.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
PURPLE_DARK = (31, 6, 58)
PURPLE = (92, 28, 150)
PURPLE_LIGHT = (139, 69, 204)
WHITE = (249, 247, 255)


def centered(draw, text, y, font, fill, stroke_width=0, stroke_fill=None):
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    draw.text(((900-(box[2]-box[0]))//2, y), text, font=font, fill=fill,
              stroke_width=stroke_width, stroke_fill=stroke_fill)


def front_texture():
    image = Image.new("RGB", (900, 1260), PURPLE)
    px = image.load()
    for y in range(image.height):
        t = y/(image.height-1)
        for x in range(image.width):
            edge = abs(x/image.width-.5)*.22
            wave = .025*math.sin(t*math.pi*4)
            k=max(0,min(1,.1+t*.42+edge+wave))
            px[x,y]=tuple(round(PURPLE_LIGHT[c]*(1-k)+PURPLE_DARK[c]*k) for c in range(3))
    draw=ImageDraw.Draw(image,"RGBA")
    draw.polygon([(0,0),(450,0),(305,735),(0,900)],fill=(255,255,255,12))
    draw.polygon([(450,0),(900,0),(900,870),(610,660)],fill=(0,0,0,15))
    draw.polygon([(0,900),(305,735),(450,1260),(0,1260)],fill=(0,0,0,11))
    draw.polygon([(900,870),(610,660),(450,1260),(900,1260)],fill=(255,255,255,8))
    draw.ellipse((205,115,695,605),fill=(48,9,82,180),outline=WHITE,width=27)
    centered(draw,"QQQ",260,ImageFont.truetype(str(FONT_BOLD),205),WHITE,4,PURPLE_DARK)
    centered(draw,"TOKENIZED STOCK",685,ImageFont.truetype(str(FONT_BOLD),45),(232,218,247))
    draw.rounded_rectangle((175,770,725,1060),radius=26,fill=(25,4,48,135),outline=(232,218,247,200),width=5)
    centered(draw,"SEEDS",825,ImageFont.truetype(str(FONT_BOLD),142),WHITE,4,PURPLE_DARK)
    PREVIEW.parent.mkdir(parents=True,exist_ok=True)
    image.save(PREVIEW,optimize=True)
    stream=io.BytesIO(); image.save(stream,format="PNG",optimize=True)
    return stream.getvalue()


def face(vertices, normal):
    return [(p,normal) for p in vertices]


def build():
    # The body is a tapered sealed pouch; the closure is a folded trapezoidal prism.
    bl=(-.24,-.45,.105); br=(.24,-.45,.105); tl=(-.285,.32,.105); tr=(.285,.32,.105)
    bbl=(-.22,-.45,-.095); bbr=(.22,-.45,-.095); btl=(-.265,.32,-.095); btr=(.265,.32,-.095)
    front_positions=[bl,br,tr,tl]
    front_normals=[(0,0,1)]*4
    front_uv=[(0,1),(1,1),(1,0),(0,0)]
    front_indices=[0,1,2,0,2,3]

    quads=[]
    def add_quad(a,b,c,d,n): quads.append(face([a,b,c,d],n))
    add_quad(bbr,bbl,btl,btr,(0,0,-1))
    add_quad(bl,tl,btl,bbl,(-1,0,0))
    add_quad(br,bbr,btr,tr,(1,0,0))
    add_quad(bl,bbl,bbr,br,(0,-1,0))
    # Narrow shoulder below the fold.
    add_quad(tl,tr,btr,btl,(0,1,0))

    # Folded closure, wider at the lower edge and faceted on top.
    cbl=(-.315,.31,.125); cbr=(.315,.31,.125); ctl=(-.27,.49,.105); ctr=(.27,.49,.105)
    cbbl=(-.295,.31,-.115); cbbr=(.295,.31,-.115); cbtl=(-.25,.49,-.095); cbtr=(.25,.49,-.095)
    add_quad(cbl,cbr,ctr,ctl,(0,0,1))
    add_quad(cbbr,cbbl,cbtl,cbtr,(0,0,-1))
    add_quad(cbl,ctl,cbtl,cbbl,(-1,0,0))
    add_quad(cbr,cbbr,cbtr,ctr,(1,0,0))
    add_quad(ctl,ctr,cbtr,cbtl,(0,1,0))
    add_quad(cbl,cbbl,cbbr,cbr,(0,-1,0))

    other_positions=[]; other_normals=[]; other_indices=[]
    for quad in quads:
        base=len(other_positions)
        for p,n in quad: other_positions.append(p); other_normals.append(n)
        other_indices += [base,base+1,base+2,base,base+2,base+3]

    blob=bytearray(); views=[]; accessors=[]
    def align():
        while len(blob)%4: blob.append(0)
    def add_view(raw,target=None):
        align(); offset=len(blob); blob.extend(raw); item={"buffer":0,"byteOffset":offset,"byteLength":len(raw)}
        if target:item["target"]=target
        views.append(item); return len(views)-1
    def add_accessor(raw,component,count,kind,target,minimum=None,maximum=None):
        view=add_view(raw,target); item={"bufferView":view,"componentType":component,"count":count,"type":kind}
        if minimum is not None:item["min"]=minimum
        if maximum is not None:item["max"]=maximum
        accessors.append(item); return len(accessors)-1
    def f32(rows): return b''.join(struct.pack('<'+'f'*len(row),*row) for row in rows)
    def u16(values): return struct.pack('<'+'H'*len(values),*values)

    mins=[min(p[i] for p in front_positions) for i in range(3)]; maxs=[max(p[i] for p in front_positions) for i in range(3)]
    fp=add_accessor(f32(front_positions),5126,4,"VEC3",34962,mins,maxs)
    fn=add_accessor(f32(front_normals),5126,4,"VEC3",34962)
    fu=add_accessor(f32(front_uv),5126,4,"VEC2",34962)
    fi=add_accessor(u16(front_indices),5123,6,"SCALAR",34963,[0],[3])
    mins=[min(p[i] for p in other_positions) for i in range(3)]; maxs=[max(p[i] for p in other_positions) for i in range(3)]
    op=add_accessor(f32(other_positions),5126,len(other_positions),"VEC3",34962,mins,maxs)
    on=add_accessor(f32(other_normals),5126,len(other_normals),"VEC3",34962)
    oi=add_accessor(u16(other_indices),5123,len(other_indices),"SCALAR",34963,[0],[len(other_positions)-1])
    image_view=add_view(front_texture())

    gltf={"asset":{"version":"2.0","generator":"Robinweed deterministic clean-UV bag builder"},
          "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":"QQQ_Seed_Pack","mesh":0}],
          "meshes":[{"name":"QQQ_Seed_Pack_Mesh","primitives":[
              {"attributes":{"POSITION":fp,"NORMAL":fn,"TEXCOORD_0":fu},"indices":fi,"material":0},
              {"attributes":{"POSITION":op,"NORMAL":on},"indices":oi,"material":1}]}],
          "materials":[
              {"name":"QQQ_Print","pbrMetallicRoughness":{"baseColorTexture":{"index":0},"metallicFactor":0,"roughnessFactor":.82}},
              {"name":"Purple_Bag","pbrMetallicRoughness":{"baseColorFactor":[.24,.035,.42,1],"metallicFactor":0,"roughnessFactor":.9}}],
          "textures":[{"source":0}],"images":[{"bufferView":image_view,"mimeType":"image/png","name":"QQQ_Front_Print"}],
          "samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":33071,"wrapT":33071}],
          "accessors":accessors,"bufferViews":views,"buffers":[{"byteLength":len(blob)}]}
    gltf["textures"][0]["sampler"]=0
    json_bytes=json.dumps(gltf,separators=(',',':')).encode(); json_bytes+=b' ' *((4-len(json_bytes)%4)%4)
    align(); bin_bytes=bytes(blob); bin_bytes+=b'\0' *((4-len(bin_bytes)%4)%4)
    total=12+8+len(json_bytes)+8+len(bin_bytes)
    out=bytearray(struct.pack('<4sII',b'glTF',2,total)); out+=struct.pack('<I4s',len(json_bytes),b'JSON')+json_bytes
    out+=struct.pack('<I4s',len(bin_bytes),b'BIN\0')+bin_bytes
    OUTPUT.parent.mkdir(parents=True,exist_ok=True); OUTPUT.write_bytes(out)
    print(f"Built {OUTPUT} ({len(out)} bytes, continuous front UV)")


if __name__ == '__main__': build()
