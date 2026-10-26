"""A prop of your own. Copy this file, build the object with kit.py, then:

  fcm.py blender <job> my_prop.py --name mic      ->  <job>/models/mic.glb, used as {"fx": "prop-3d", "model": "mic"}

Keep it low-poly and PBR. Front faces -Y (Blender's front view). Name moving parts hand_hour / hand_minute / screen / spin
(see kit.py), so prop-3d can animate them. Real proportions in metres; export() centres and scales it.
"""
import os
import sys

sys.path.insert(0, os.environ.get('FCM_BLENDER_KIT') or os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

out = kit.args()[0]
kit.reset()

# a studio microphone, as an example
metal = kit.material('metal', '#C9CCD1', metallic=1.0, roughness=0.3)
grille = kit.material('grille', '#2A2B30', metallic=0.6, roughness=0.55)
kit.lathe('head', [(0, 0.12), (0.03, 0.125), (0.038, 0.15), (0.038, 0.2), (0.03, 0.225), (0, 0.23)], grille)
kit.lathe('body', [(0, 0.0), (0.022, 0.0), (0.024, 0.06), (0.03, 0.12), (0, 0.122)], metal)

kit.export(out)
