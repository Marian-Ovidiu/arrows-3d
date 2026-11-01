"""Svela bespoke margin sculptures. Run with Blender --background --python this_file.
All meshes authored procedurally here; no textures, external assets, or animation.
Blender coordinates X horizontal / Z up / -Y toward viewer; glTF exports Y up.
"""
import bpy, math, json, os, struct
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models/environments'; ART=ROOT/'art/environments'
OUT.mkdir(parents=True,exist_ok=True); ART.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
def mat(name,color,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*[((int(color[i:i+2],16)/255 + .055)/1.055)**2.4 for i in (0,2,4)],1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=m.diffuse_color; p.inputs['Roughness'].default_value=.72; p.inputs['Metallic'].default_value=metal; M[name]=m; return m
for n,c in [('fern','668974'),('sage','90a087'),('wood','9a7357'),('cut','c6a37a'),('bark','70533e'),('copper','b97658'),('ivory','dfdbc6'),('stone','8b9b87'),('blue','879eaa'),('pearl','d6d2bc'),('gold','b49b60'),('jade','618d86'),('teal','476e69'),('paper','d1ccbd'),('brass','ae935b')]: mat(n,c,.25 if n in ('gold','brass') else 0)
side=None
def finish(o,m,smooth=False):
    o.data.materials.append(M[m]); o.parent=side
    if smooth:
        for p in o.data.polygons:p.use_smooth=True
    return o
def bevel(o,w=.025):
    b=o.modifiers.new('Soft hand-cut edges','BEVEL'); b.width=w;b.segments=2
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    return o
def box(name,loc,scale,m,rot=(0,0,0),w=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bevel(o,w);return finish(o,m)
def orb(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;return finish(o,m,True)
def ico(name,loc,scale,m):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bevel(o,.03);return finish(o,m)
def rod(name,a,b,r,m,r2=None,verts=12):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bevel(o,min(r*.2,.015));return finish(o,m,True)
def tube(name,pts,r,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for p,co in zip(s.bezier_points,pts): p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=side;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o
def ring(name,loc,r,thick,m,rot=(math.pi/2,0,0),arc=2*math.pi):
    pts=[]
    from mathutils import Euler
    E=Euler(rot).to_matrix()
    for i in range(25):pts.append(Vector(loc)+E@Vector((r*math.cos(arc*i/24),r*math.sin(arc*i/24),0)))
    return tube(name,pts,thick,m)
def leaf(name,start,end,width,m='fern',curl=.07):
    a=Vector(start);d=Vector(end)-a;cross=Vector((d.z,0,-d.x)).normalized();vs=[]
    for i in range(9):
        t=i/8;center=a+d*t+Vector((0,-curl*math.sin(math.pi*t),0));w=width*math.sin(math.pi*t)**.8
        for k in [-1,0,1]:vs.append(center+cross*w*k+Vector((0,abs(k)*.035*math.sin(math.pi*t),0)))
    fs=[]
    for i in range(8):
        for j in range(2):q=i*3+j;fs.append((q,q+1,q+4,q+3))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,m,True)
    s=o.modifiers.new('Leaf thickness','SOLIDIFY');s.thickness=.012;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=s.name)
    tube('Raised leaf vein',[a,a+d*.5+Vector((0,-curl,0)),a+d],.007,'sage')
def fern(x,z,flip=1):
    tube('Curved fern stem',[(x,0,z),(x+.07*flip,0,z+.28),(x+.2*flip,.02,z+.54)],.013,'fern')
    for i in range(5):
        t=i/5;cx=x+.15*flip*t;cz=z+.1+t*.37
        for sign in [-1,1]:leaf('Fern leaflet',(cx,0,cz),(cx+sign*(.16-.075*t),-.01,cz+.08),.036,'fern',.025)
def mush(x,y,z,s=1):
    rod('Ivory tapered mushroom stalk',(x,y,z),(x+.025*s,y,z+.22*s),.045*s,'ivory',.027*s)
    orb('Copper umbrella cap',(x+.025*s,y,z+.225*s),(.16*s,.13*s,.07*s),'copper')
    for dx,dy in [(-.065,-.04),(.04,-.065),(.08,.025)]:orb('Ivory cap fleck',(x+(dx+.025)*s,y+dy*s,z+.28*s),(.022*s,.017*s,.008*s),'ivory')
def group(name):
    global side
    side=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(side);return side
chapters={}
# Forest: a cut log and fern bank; a separate engraved forest sentinel.
L=group('left');rod('Fallen tapered log',(-.35,.055,.2),(.24,.08,.34),.19,'wood',.145,16)
# Endgrain face oriented to viewer for legibility.
orb('Oval exposed cut end',(-.32,-.078,.23),(.16,.018,.145),'cut')
for r in [.047,.095,.133]:
    o=ring('Concentric carved growth ring',(-.32,-.099,.23),r,.007,'bark');o.scale.z=.9
for zz in [.19,.28,.36]:tube('Long bark crease',[(-.19,-.08,zz),(.0,-.07,zz+.035),(.22,-.055,zz+.07)],.007,'bark')
fern(-.2,.28,-1);fern(.13,.25,1)
leaf('Broad cupped leaf',(-.15,-.1,.05),(-.46,-.11,.42),.11,'sage');leaf('Broad cupped leaf',(.12,-.12,.05),(.43,-.11,.31),.105)
for x,y,z,s in [(-.08,-.2,.04,.8),(.14,-.19,.03,1.1),(.34,-.02,.05,.6)]:mush(x,y,z,s)
for x in [-.35,-.1,.2]:orb('Soft moss cushion',(x,.04,.04),(.17,.13,.05),'fern')
R=group('right');box('Leaning rounded waystone',(0,.05,.43),(.37,.25,.79),'stone',rot=(0,-.13,-.07),w=.07)
box('Broken stone shoulder',(.17,.055,.29),(.16,.23,.43),'stone',rot=(0,.27,.1),w=.05)
ring('Inset crescent glyph',(-.02,-.097,.59),.104,.013,'bark',arc=math.pi*1.45)
for x in [-.2,.04,.2]:orb('Moss resting on sentinel',(x,-.02,.09),(.16,.14,.075),'fern')
leaf('Sentinel curved leaf',(-.2,0,.08),(-.42,.01,.52),.09,'sage');leaf('Sentinel curved leaf',(.15,0,.07),(.4,.01,.4),.085)
mush(-.25,-.16,.04,.65);chapters['bosco']=[L,R]
# Observatory: fragmented segmented arch, and a copper armillary.
L=group('left')
for x in [-.29,.29]:box('Rounded arch foundation',(x,.03,.075),(.26,.32,.15),'blue',w=.045)
for x in [-.28,.28]:
    for z in [.23,.43]:box('Ivory column drum',(x,.025,z),(.17,.21,.18),'pearl',rot=(0,.03 if x<0 else -.04,0),w=.025)
for i in range(7):
    a=.12+i*math.pi/8;x=.28*math.cos(a);z=.53+.28*math.sin(a)
    if i==2:continue
    box('Individual arch voussoir',(x,.025,z),(.17,.22,.14),'pearl',rot=(0,-a,0),w=.02)
for x,z in [(-.28,.24),(.28,.44)]:ring('Celestial inlaid circle',(x,-.089,z),.036,.006,'gold')
box('Loose arch fragment',(-.03,-.03,.07),(.2,.23,.1),'pearl',rot=(0,.12,.25),w=.025)
rod('Celestial incised stroke',(-.045,-.154,.07),(.04,-.154,.09),.009,'gold')
R=group('right');box('Weathered armillary foot',(0,.035,.07),(.46,.32,.14),'blue',w=.05)
rod('Broken column',(0,.025,.12),(0,.025,.37),.135,'pearl',.115,10)
box('Broken column capital',(0,.02,.37),(.31,.28,.085),'pearl',rot=(0,-.07,0),w=.025)
rod('Armillary axial pin',(0,0,.37),(0,0,.92),.018,'gold')
for rot in [(math.pi/2,.15,.15),(.6,.7,.45),(1.1,-.7,-.5)]:ring('Tilted brass celestial orbit',(0,0,.67),.26,.016,'gold',rot=rot)
ico('Central blue star gem',(0,-.01,.67),(.095,.075,.12),'blue')
orb('Axis finial',(0,0,.95),(.035,.035,.035),'gold');box('Loose column fragment',(.26,.02,.11),(.15,.2,.18),'pearl',rot=(0,.3,.2),w=.03)
chapters['osservatorio']=[L,R]
# Archive: fractured angular portal, and a stack of ancient folios on a flying shelf.
L=group('left')
box('Portal left broken upright',(-.25,.03,.36),(.19,.22,.65),'teal',rot=(0,-.09,0),w=.035)
box('Portal right short upright',(.25,.04,.26),(.18,.22,.46),'jade',rot=(0,.12,0),w=.035)
box('Detached portal lintel',(-.04,.03,.76),(.56,.23,.19),'jade',rot=(0,-.15,0),w=.035)
box('Upright thin brass inlay',(-.235,-.091,.37),(.022,.014,.5),'brass',rot=(0,-.09,0),w=.004)
box('Lintel thin brass inlay',(-.04,-.093,.76),(.42,.014,.02),'brass',rot=(0,-.15,0),w=.004)
box('Right thin brass inlay',(.245,-.082,.26),(.018,.014,.32),'brass',rot=(0,.12,0),w=.004)
for x,y,z in [(-.39,-.02,.07),(.08,-.03,.13),(.3,.02,.67)]:ico('Detached pearly portal chip',(x,y,z),(.085,.09,.11),'paper')
R=group('right');ico('Floating archive shelf',(0,.03,.23),(.45,.27,.17),'teal')
box('Lower ancient book cover',(0,-.01,.38),(.61,.34,.055),'jade',rot=(0,0,-.08),w=.023)
box('Lower book page block',(0,-.01,.43),(.54,.3,.065),'paper',rot=(0,0,-.08),w=.014)
box('Lower book top cover',(0,-.01,.48),(.61,.34,.04),'jade',rot=(0,0,-.08),w=.018)
# Upright tablet/book gives a clear archive silhouette, angled lightly.
box('Upright bound folio',(.07,.05,.72),(.36,.15,.42),'teal',rot=(0,-.17,0),w=.035)
box('Upright folio inset',(.07,-.033,.72),(.27,.015,.31),'jade',rot=(0,-.17,0),w=.018)
for x in [-.075,.215]:
    for z in [.565,.875]:box('Brass folio corner',(x,-.048,z),(.064,.02,.052),'brass',rot=(0,-.17,0),w=.008)
for z in [.67,.73,.79]:box('Archive inscription bar',(.07,-.048,z),(.13,.012,.012),'brass',rot=(0,-.17,0),w=.003)
for x,z in [(-.35,.72),(.38,.6)]:ico('Floating gemstone sliver',(x,-.01,z),(.046,.05,.14),'jade')
chapters['archivio']=[L,R]
# Bake transformations, normalize each sculpture uniformly, and merge by material.
manifest={}
for chapter,groups in chapters.items():
    for j,g in enumerate(groups):g.name=f'{chapter}_{j}'
for chapter,groups in chapters.items():
    manifest[chapter]={}
    for j,g in enumerate(groups):
        g.name=['left','right'][j]
        objs=[o for o in g.children if o.type=='MESH']; coords=[o.matrix_world@Vector(c) for o in objs for c in o.bound_box]
        lo=Vector([min(v[i] for v in coords) for i in range(3)]);hi=Vector([max(v[i] for v in coords) for i in range(3)])
        scale=min(1/(hi.z-lo.z),1.15/(hi.x-lo.x),.55/(hi.y-lo.y));offset=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
        for o in objs:
            for v in o.data.vertices:v.co=(o.matrix_world@v.co-offset)*scale
            o.matrix_world.identity()
        for material in set(o.data.materials[0] for o in objs):
            same=[o for o in g.children if o.data.materials[0]==material];bpy.ops.object.select_all(action='DESELECT')
            for o in same:o.select_set(True)
            bpy.context.view_layer.objects.active=same[0];bpy.ops.object.join();same[0].name=f'{g.name}_{material.name}'
        points=[v.co for o in g.children for v in o.data.vertices];low=[min(v[i] for v in points) for i in range(3)];high=[max(v[i] for v in points) for i in range(3)]
        manifest[chapter][g.name]={'gltf_bounds':{'min':[low[0],low[2],-high[1]],'max':[high[0],high[2],-low[1]]},'vertices':sum(len(o.data.vertices) for o in g.children),'primitives':len(g.children)}
    bpy.ops.object.select_all(action='DESELECT')
    for g in groups:
        g.select_set(True)
        for o in g.children:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{chapter}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=False,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
    raw=(OUT/f'{chapter}.glb').read_bytes(); gltf=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    manifest[chapter]['bytes']=len(raw)
    manifest[chapter]['exported_vertices']=sum(gltf['accessors'][p['attributes']['POSITION']]['count'] for mesh in gltf['meshes'] for p in mesh['primitives'])
    manifest[chapter]['exported_primitives']=sum(len(mesh['primitives']) for mesh in gltf['meshes'])
    manifest[chapter]['root_groups']=[gltf['nodes'][n]['name'] for n in gltf['scenes'][0]['nodes']]
    for j,g in enumerate(groups):g.name=f'{chapter}_{j}'
# Scene presentation for reproducible overview / saved editable source.
for i,(chapter,groups) in enumerate(chapters.items()):
    for j,g in enumerate(groups):g.location=(j*1.35-0.675,0,(2-i)*1.25)
world=bpy.context.scene.world;world.color=(.5,.5,.5)
bpy.ops.object.camera_add(location=(0,-10,3.1));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.7))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.2;bpy.context.scene.camera=cam
for loc,energy,size in [((-3,-4,6),650,5),((3,-2,4),350,4)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.render.resolution_x=1000;s.render.resolution_y=1200;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=str(ART/'contact-sheet.png');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.21,.19,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
bpy.context.preferences.filepaths.save_version=0
s.view_settings.view_transform='AgX';bpy.ops.wm.save_as_mainfile(filepath=str(ART/'svela-environments.blend'));bpy.ops.render.render(write_still=True)
(ART/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
