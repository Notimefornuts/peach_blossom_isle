# Shoreline rock maps

The three maps under `assets/textures/` drive the weathered limestone of the
island facade. They are derived from
[Rock Boulder Dry by Sergej Majboroda on Poly Haven](https://polyhaven.com/a/rock_boulder_dry),
available under [CC0](https://polyhaven.com/license).

| File | Contents | Size |
|---|---|---|
| `rock-albedo.webp` | sRGB pale weathered limestone with warm mottling | 1024 × 1024 |
| `rock-normal.webp` | linear tangent-space normal, OpenGL convention | 1024 × 1024 |
| `rock-orm.webp` | linear R = cavity occlusion, G = roughness, B = lichen mask | 512 × 512 |
| `rock-constants.json` | albedo linear mean and the matching tint gain | — |

`rock-constants.json` holds the linear mean of the albedo map and the factor
that lifts a per-instance tint by the same amount, so the new material keeps
the value the island's palette already had. Recompute both with
`python tools/build_rock_textures.py`, which downloads the 2K source once into
`tools/.cache/` and re-grades it.
