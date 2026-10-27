"""Helpers for building props in headless Blender and exporting them as GLB for the Three.js lane.

Conventions every prop follows, so `prop-3d` can place, light and animate it without knowing what it is:
  - the front of the prop faces Blender's front view (-Y); glTF turns that into +Z, which faces the Three.js camera
  - Z is up in Blender (+Y in glTF); the prop is centred on its bounding box and scaled so its largest side is 1 unit
  - parts that move are separate objects with fixed names: hand_hour / hand_minute (turn about the front axis),
    screen (a plane with 0..1 UVs that gets the creator's screenshot), spin (turns about the up axis)
  - PBR materials only (Principled BSDF: base colour, metallic, roughness, emission, coat), which glTF carries 1:1
Works in Blender 3.6 to 5.x, and in the `bpy` module from PyPI (Python 3.11).
"""
import math
import os
import sys

import bpy  # first: with the PyPI module, bmesh and mathutils only exist once bpy is loaded
import bmesh
from mathutils import Matrix, Vector

ORANGE = '#D97757'   # the one accent colour: the win
GOLD = '#E8B64C'
INK = '#141418'
PAPER = '#F4EFE6'


def args():
    """Arguments after `--` (blender -b -P script.py -- a b), or after the script name when run with the bpy module."""
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]


def reset():
    """An empty scene in metres, with nothing left over from the startup file."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'


def hex_rgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb] + [1.0]


def _set(node, names, value):
    for n in names:                      # input names moved between Blender versions
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


def material(name, color, metallic=0.0, roughness=0.45, emission=0.0, coat=0.0):
    """A Principled BSDF material (glTF exports it as metallic-roughness PBR)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if hasattr(m, 'use_nodes') and not m.use_nodes:
        m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    rgb = hex_rgb(color)
    _set(p, ['Base Color'], rgb)
    _set(p, ['Metallic'], metallic)
    _set(p, ['Roughness'], roughness)
    if emission:
        _set(p, ['Emission Color', 'Emission'], rgb)
        _set(p, ['Emission Strength'], emission)
    if coat:
        _set(p, ['Coat Weight', 'Clearcoat'], coat)
    m.diffuse_color = rgb
    return m


def _obj(name, mesh):
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def _finish(bm, name, mat, smooth):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    o = _obj(name, mesh)
    if mat:
        o.data.materials.append(mat)
    return o


def lathe(name, profile, mat=None, segments=64):
    """Spin a profile [(radius, z), ...] around Z: cups, bases, knobs, bottles. Start and end on the axis to close it."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    for a, b in zip(vs, vs[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=segments, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _finish(bm, name, mat, True)


def box(name, size, mat=None, loc=(0, 0, 0), bevel=0.0, segments=4):
    """A box of size (x, y, z) at loc; bevel (in metres) rounds its edges."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts[:])
    o = _finish(bm, name, mat, False)
    o.location = loc
    if bevel:
        bev(o, bevel, segments)
    return o


def cylinder(name, radius, depth, mat=None, loc=(0, 0, 0), facing='up', segments=64, bevel=0.0):
    """A cylinder; facing 'front' turns its caps toward the camera (coins, clock faces, dials)."""
    bm = bmesh.new()
    kw = dict(cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=depth)
    try:
        bmesh.ops.create_cone(bm, **kw)
    except TypeError:                     # older Blender spells the radii diameter1 / diameter2
        kw['diameter1'] = kw.pop('radius1'); kw['diameter2'] = kw.pop('radius2')
        bmesh.ops.create_cone(bm, **kw)
    o = _finish(bm, name, mat, True)
    if facing == 'front':
        o.rotation_euler = (math.pi / 2, 0, 0)
    o.location = loc
    if bevel:
        bev(o, bevel, 3)
    return o


def torus(name, major, minor, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), segments=48, ring=16):
    bm = bmesh.new()
    for i in range(segments):
        a = 2 * math.pi * i / segments
        for j in range(ring):
            b = 2 * math.pi * j / ring
            r = major + minor * math.cos(b)
            bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b)))
    bm.verts.ensure_lookup_table()
    for i in range(segments):
        for j in range(ring):
            q = [bm.verts[(i * ring + j)], bm.verts[((i + 1) % segments) * ring + j],
                 bm.verts[((i + 1) % segments) * ring + (j + 1) % ring], bm.verts[i * ring + (j + 1) % ring]]
            bm.faces.new(q)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _finish(bm, name, mat, True)
    o.location, o.rotation_euler = loc, rot
    return o


def plane(name, w, h, mat=None, loc=(0, 0, 0)):
    """A w x h plane facing the camera (-Y) with 0..1 UVs, upright: a screen, a label, a sticker."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new(name='UVMap')
    for loop, (u, v) in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = (u, v)
    o = _obj(name, mesh)
    o.location = loc
    if mat:
        o.data.materials.append(mat)
    return o


def bev(o, width, segments=4):
    """Round the edges (a bevel modifier, applied on export) so a clearcoat catches a highlight along them."""
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width, m.segments = width, segments
    m.limit_method = 'ANGLE'
    for poly in o.data.polygons:
        poly.use_smooth = True
    if hasattr(o.data, 'use_auto_smooth'):          # Blender < 4.1
        o.data.use_auto_smooth = True
    else:
        m.harden_normals = True
    return m


def pivot(o, point):
    """Move an object's origin to a world point without moving its geometry (hands turn about the clock's centre)."""
    o.data.transform(Matrix.Translation(Vector(o.location) - Vector(point)))
    o.location = point


def export(path):
    """Centre the prop on its bounding box, scale its largest side to 1, and write a GLB."""
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        sys.exit('nothing to export: the script made no meshes')
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    s = 1.0 / max(hi - lo)
    root = bpy.data.objects.new('prop', None)
    bpy.context.scene.collection.objects.link(root)
    for o in meshes:
        if o.parent is None:
            o.parent = root
    root.scale = (s, s, s)
    root.location = -(lo + hi) / 2 * s
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format='GLB', use_selection=False,
                              export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
    dims = (hi - lo) * s
    print(f'GLB {os.path.abspath(path)}  {len(meshes)} parts, {dims.x:.2f} x {dims.z:.2f} x {dims.y:.2f} (w x h x d)')
