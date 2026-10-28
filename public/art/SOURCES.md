# LASER ESCAPE v6 — photographic art sources

Every image was generated locally on 2026-10-26 with **Z-Image-Turbo** (`Tongyi-MAI/Z-Image-Turbo`,
Apache-2.0) through mflux (`mflux-generate-z-image-turbo`, 9 steps, `-q 8`). GDD-v6 §2 names FLUX.1-schnell,
but that model is HF-gated and was not on this machine, so Z-Image-Turbo was used with the same §2.1 prompt
style. All output is AI-generated: no people, no stock photos, no third-party assets.

Encoding: `cwebp -q 88 -m 6 -sharp_yuv`. Total about 1.7 MB (39 files).

## Shared prompt pieces
- `STYLE` = `straight-on flat frontal elevation, orthographic, symmetrical, no people, no text, no logos, moody teal shadows, warm amber practical lights, subtle haze, 35mm film, highly detailed, realistic materials`
- Wall prompt = `cinematic photograph, dim high-security facility interior, <subject>, the wall fills the whole frame edge to edge, plain vertical concrete pillars at the far left and far right edges, camera at horizon level, only a thin strip of floor at the very bottom, ` + STYLE

## Walls (raw 1280×864 → 1024×640)
| file | seed | floor line (raw y) | subject |
|---|---|---|---|
| wall-0-a | 11 | 774 | back wall of a concrete security outpost with a heavy sliding steel security gate, wall-mounted floodlights, chain-link fence visible through a barred opening |
| wall-0-b | 11 | 780 | back wall of a concrete security outpost with a steel guard booth window with bars, card reader panel, electrical conduit boxes, wall-mounted floodlights, chain-link fence panels |
| wall-0-c | 11 | 792 | back wall of a concrete security outpost with steel blast shutter, horizontal steel beam, caged wall lamps, chain-link fence panel with barbed wire top |
| wall-1-a | 23 | 848 | back wall of a clean high-tech research laboratory made of white composite wall panels, large glass window into a server room with blinking server racks |
| wall-1-b | 23 | 808 | back wall of a high-tech research laboratory with white composite panels and a recessed glass sliding door, cool LED strip lights, small control panels |
| wall-1-c | 23 | 836 | back wall of a high-tech research laboratory with white composite panels, a row of tall server racks behind glass, ventilation grilles |
| wall-2-a | 11 | 820 | back wall of a maximum security prison cell block, row of steel cell bars, painted concrete, caged wall lamps |
| wall-2-b | 11 | 794 | back wall of a maximum security prison block, heavy reinforced steel door with small observation window, painted concrete walls, pipes |
| wall-2-c | 11 | 822 | back wall of a maximum security prison block, wide armored observation window with wire glass, steel bars, painted concrete |
| wall-3-a | 11 | 808 | back wall of an old industrial factory and sewer tunnel, large rusted steel pipes and valves, riveted steel plates, grates |
| wall-3-b | 11 | 764 | back wall of an industrial sewer tunnel, rusted pipes with red valve wheels, steel grate in the wall, stained concrete, wisps of steam |
| wall-3-c | 11 | 816 | back wall of an industrial factory, rusted steel panels, pressure gauges, pipe manifolds, catwalk grating, steam |

Post-processing:
1. Crop a 1.6:1 window centred horizontally, with its **bottom edge on the wall/floor line** (height = min(line, 800)), then Lanczos-resize to 1024×640.
2. Edge columns: each theme gets one shared per-row colour profile, the mean of the outer 64 px of both sides of all three variants. The outer 20 px are replaced by it, with a smoothstep blend out to 64 px and σ=2 noise. Any two variants of a theme therefore butt together seamlessly.

Alternate seeds (23 for themes 0/2/3, 11 for theme 1) were rejected to keep each theme's three variants on the same seed and framing.

## Floors (raw 1536×768 → 1024×512, tileable both axes)
Prompt: `top-down orthographic photograph looking straight down at a <subject>, flat even lighting with a slight teal tint, seamless texture, uniform pattern, no objects, no text, highly detailed, realistic material`
| file | seed | subject | gain |
|---|---|---|---|
| floor-0 | 31 | worn grey concrete floor slab with faint expansion joints and oil stains | 0.62 |
| floor-1 | 101 | *(re-prompted)* `top-down orthographic photograph looking straight down at a light grey industrial epoxy laboratory floor made of large square tiles with thin dark grout seams, scuff marks, faint wheel marks, slightly worn, flat even lighting, seamless texture, no objects, no text, highly detailed, realistic material` | 0.50 |
| floor-2 | 47 | dark painted concrete prison floor, scuffed and worn | 1.0 |
| floor-3 | 31 | rusted steel diamond plate and metal floor grating, wet, industrial | 0.9 |

Post-processing: remove low-frequency lighting (Gaussian high-pass, two radii), flatten row and column trends, then apply the gain.
To make it tileable, pick the 1280-px window whose 128-px overlap halves differ least and join it with a **min-error seam cut**
(image quilting, 6 px feather) in x, then again in y. Finish with a linear ramp that makes opposite edges match row by row and column by column.

## Ceilings (raw 1536×512 → 1024×256, tileable left↔right)
Prompt: `cinematic photograph, frontal view of an overhead services band near the <subject>, horizontal runs spanning the full width, straight-on flat frontal elevation, orthographic, no people, no text, moody teal shadows, warm amber practical lights, subtle haze, highly detailed, realistic materials`
| file | seed | raw rows | subject |
|---|---|---|---|
| ceiling-0 | 53 | 120–440 | concrete ceiling with steel ventilation ducts, electrical conduits and caged lamps |
| ceiling-1 | 53 | 80–400 | white ceiling with aluminium ventilation ducts, cable trays and LED light strips |
| ceiling-2 | 53 | 100–420 | dark concrete ceiling with pipes, wire cable trays and caged lamps |
| ceiling-3 | 53 | 120–440 | rusted industrial ceiling with large pipes, valves, cable trays and steel girders |

Post-processing: take a band of 320 rows, remove left-right lighting drift per row (blur radii 120 and 60), pick the window whose
96-px overlap differs least, crossfade it (smoothstep), match the edges with a linear ramp, then resize to 1024×256.

## Title (raw 720×1280 → 1080×1920), seed 29
`cinematic movie poster photograph, long dark high-security corridor in perspective, a grid of thin bright red laser beams crossing the corridor glowing in haze, a lone silhouetted special operative in tactical gear seen from behind standing in the lower middle, the top third of the image is dark empty shadow, moody teal shadows, warm amber practical lights, volumetric haze, 35mm film, highly detailed, no text, no logos`
Post-processing: Lanczos upscale ×1.5 and unsharp mask (r1.2, 40%). Rows 0–30% are darkened to 25%, easing back to 100% by 45% (logo area).

## Zones (raw 1280×720 → 640×360)
Prompt: `cinematic film still, wide shot, <subject>, no people, no text, no logos, moody teal shadows, warm amber practical lights, subtle haze, 35mm film, highly detailed, realistic materials`
| file | seed | subject |
|---|---|---|
| zone-0 | 83 | outer perimeter security checkpoint of a secret facility at dusk, floodlights, chain-link fence, barrier gate, guard tower |
| zone-1 | 61 | underground sewer tunnel with steam, wet concrete, pipes, dim amber lamps |
| zone-2 | 83 | white high-tech research wing corridor, glass walls, clean panels, cool lighting |
| zone-3 | 61 | dark server room, rows of server racks with small blinking lights, cable trays |
| zone-4 | 61 | prison cell block interior, rows of barred cells on two tiers, caged lamps |
| zone-5 | 61 | prison cell block under red alarm lighting, rotating red beacons, haze |
| zone-6 | 83 | research wing emergency exit corridor lit by red emergency lights, glass walls |
| zone-7 | 83 | factory production line with heavy industrial machines, conveyor, steam, sparks |
| zone-8 | 83 | rooftop of a tall building at night with HVAC units, city lights in the distance |
| zone-9 | 61 | rooftop helipad at dawn with a black helicopter, city skyline, low sun |

Rejected: zone-7 s61 (tiny people in the background) and zone-6 s61 (an exit sign with a small legible word).

## Theme 0 exterior sets (zones 9 "rooftop" night, 10 "helipad" dawn)
Wall prompt = `cinematic photograph, exterior rooftop of a high-security facility, <subject>, the scene fills the whole frame edge to edge, plain concrete stair-tower wall sections at the far left and far right edges, camera at horizon level, only a thin strip of roof deck at the very bottom, ` + STYLE
Raw 1280×864 → 1024×640, all seed 11 (seed 23 rejected to keep framing consistent).
| file | floor line (raw y) | subject |
|---|---|---|
| wall-0-night-a | 824 | at night, low concrete parapet wall with a steel safety railing, two large HVAC units on the roof, the city skyline with lit windows and a dark night sky beyond in the upper half |
| wall-0-night-b | 824 | at night, low concrete parapet wall with a steel safety railing, tall antenna masts with red aircraft warning lights, ventilation stacks, the city skyline with lit windows and a dark night sky beyond in the upper half |
| wall-0-night-c | 768 | at night, low concrete parapet wall with a steel safety railing, caged amber wall lamps, rooftop access door housing, cable conduits, the city skyline and dark teal night sky beyond in the upper half |
| wall-0-dawn-a | 778 | at dawn, helipad edge, low concrete parapet with a row of small helipad perimeter lights, steel safety net frame, distant city skyline silhouette, dawn sky gradient from amber horizon to teal above in the upper half |
| wall-0-dawn-b | 720 | at dawn, helipad edge, low concrete parapet with helipad perimeter lights, a windsock on a slim steel mast, distant city skyline silhouette, dawn sky gradient from amber horizon to teal above in the upper half |
| wall-0-dawn-c | 712 | at dawn, helipad edge, low concrete parapet with helipad perimeter lights, floodlight mast, small equipment cabinet, distant city skyline silhouette, dawn sky gradient from amber horizon to teal above in the upper half |

Post-processing:
1. Crop and resize as for the interior walls, with the bottom edge on the parapet/deck line.
2. Per-row tone of b and c pulled 80% toward a (49-row box-smoothed), so sky gradients match.
3. Every variant gets variant a's own left/right 128-px pillar strips (24-px feather), because the generated pillars differ in height.
4. Same shared edge-column profile as the interior walls.

Floors (tileable both axes; same flatten → best window → seam-cut x/y → edge-ramp pipeline as the interior floors):
| file | seed | prompt subject | notes |
|---|---|---|---|
| floor-0-night | 47 | `top-down orthographic photograph looking straight down at a dark weathered rooftop concrete with grey waterproofing membrane patches and seams, wet, night, lit by cool teal light, flat even lighting, seamless texture, uniform pattern, no objects, no text, no numbers, highly detailed, realistic material` | rows 160–768 only (skips the roof edge), y-overlap 96 |
| floor-0-dawn | 127 | *(re-prompted)* `flat top-down orthographic photograph looking straight down at weathered grey rooftop concrete helipad surface, a few long straight faded worn white and yellow painted stripes running horizontally across the whole width, peeling paint, cracks, stains, uniform even dawn light, seamless texture, no circles, no letters, no numbers, no objects, highly detailed, realistic material` | gain 0.62 |

Rejected: the first dawn floors (s31 had perspective, s47 had a single large circle that would repeat visibly) and dawn re-prompt seeds 101/113 (stripes too saturated).

## v7 — bosses and cutscene stills (generated 2026-10-27, same model and settings)

### Boss sprites (raw 1280×1024 → keyed RGBA WebP q80, long side 1024)
Prompt = `studio photograph of <subject>, full body in frame with margin, side view facing left, isolated on a solid flat bright chroma key green background, evenly lit backdrop, no floor, no shadow, dramatic cinematic rim lighting, gunmetal and matte dark steel, worn industrial military hardware, realistic, highly detailed, menacing, grounded, no text, no logos, no people`.
Subjects: GDD-v7 §1 boss descriptions (warden, lab-ai, core, jailer, apc, chimera, crane, gunship were picked from seeds 11/23/37).

`sewer-eye` and `sniper` were re-prompted (v1 rendered fixed-wing drones on landing gear; v2 sniper read as a flying rifle) with
`… seen from the side, four rotors …, no wings, no landing gear, no legs, …, hovering high in mid air, …, no ground, no shadow, bright even fill light on the underside, …`:
| file | seed | subject |
|---|---|---|
| boss-sewer-eye | 201 | heavy armored quadcopter surveillance drone, four rotors on short arms on top, boxy armored olive hull, a huge round glowing searchlight lamp mounted on the front left of the hull |
| boss-sniper | 211 | large armored military quadcopter drone, four big rotors on thick horizontal arms at the top, compact angular armored central body with a red sensor eye, a long black sniper rifle with a scope mounted under the body pointing left |

Post-processing: chroma key (greenness ramp, speck removal, edge unmix + despill, 1 px choke), saturated red/amber emissives toned to 55 %
(the game draws live glows), padded to the rig box aspect and bottom-aligned. Anchors are measured on the delivered sprites
(`BOSS_PHOTO_RIGS` in `src/render/boss-rigs.ts`, fractions of the opaque bbox).

### Cutscene stills (raw 864×1536 → 1080×1920, Lanczos + unsharp r1.2 35 %, WebP q80; 19 files, 1.3 MB)
Prompt = `<subject>, cinematic film still, vertical composition, moody teal shadows, warm amber practical lights, subtle haze, 35mm film, highly detailed, realistic, no text, no letters, no logos, no faces visible`.
People appear only from behind (GDD-v7 §2). Seeds: op-1/op-3/rescue-1/rescue-3/end-1/end-2 from 61/83; op-2 s113, rescue-2 s101, end-3 s113 (re-prompted);
boss-1 s11, boss-2 s11, boss-3 s23, boss-4 s11, boss-5 s11, boss-6 s11, boss-7 s23, boss-8 s11, boss-9 s23, boss-10 s23.
Boss stills (`boss-N-a`) use `cinematic film still, vertical composition, low angle, <boss subject>, the whole machine visible and centered with empty space around it, menacing, in a <zone setting>, no people, …`.

Rejected: rescue-2 seeds 61/83 (lettering on the operative's vest), op-2 seeds 61/83 (profile view of the face),
end-3 seeds 61/83 (helicopter in frame contradicts "seen from the departing helicopter").

## v8 — Higgsfield set (generated 2026-10-28)

Model: **GPT Image 2.5** (`gpt_image_2_5`, variant `flare`) through the Higgsfield CLI. Quality `medium`, resolution `2k`
(badges `1k`), 2 candidates per asset, best one picked. **77 credits** in total (101 jobs: 98 completed, 1 blocked as NSFW
(`map-b`, a false positive), 2 local path errors that were never charged). GPT Image takes no seed, so the job id is what
identifies each render (`higgsfield generate get <id>`). All output is AI-generated: no real people, no third-party assets.

Encoding: `cwebp -q 80 -m 6 -sharp_yuv` (map `-q 70`; badges `-q 72 -alpha_q 80`), cover-crop to the target aspect, Lanczos,
unsharp r1.0 30 %.

### One hero across portraits, title and cutscenes
A hero model sheet was generated first. It was passed as an image reference (`--image`) to the Agent K, Black Cat and
Special Forces portraits and to every title/cutscene still:
`Character model sheet photograph of a lean special operative, matte black tactical suit with slim plate carrier, low-profile matte black helmet with a single horizontal green glowing visor light covering the eyes, face fully hidden behind a black balaclava and visor, teal accent piping along the shoulders and legs, black gloves and boots. Three views side by side on a dark charcoal studio backdrop: front, three-quarter back, and side. Full body in frame, rim lighting, moody teal shadows, warm amber kicker light, subtle haze, 35mm film photograph, realistic materials, no text, no labels, no logos`

- `HERO` = `the same lean special operative as in the reference image: matte black tactical suit with slim plate carrier, low-profile matte black helmet with a single horizontal green glowing visor light, face fully hidden behind a black balaclava, teal accent piping along the shoulders and legs`
- `STYLE` = `moody teal shadows, warm amber practical lights, subtle haze, 35mm film photograph, realistic materials, highly detailed`
- `NO` = `no text, no letters, no numbers, no logos, no insignia, no face visible`

**Operator portraits** `op-<skin>.webp` (2:3 → 600×900):
`Full-body portrait photograph of a special operative character, <look>. standing in a confident three-quarter view facing slightly left` (candidate b: `in a ready stance, three-quarter view, slight low angle`) `, whole body from helmet to boots in frame with margin, centered, on a dark charcoal studio backdrop fading to black, strong teal rim light and warm amber kicker light, STYLE, NO`
| skin | look |
|---|---|
| kid | `Agent K, the default look: HERO, compact night-vision mount on the helmet, holstered sidearm, green visor glow` |
| cat | `Black Cat: a unisex stealth infiltrator in a matte black armored stealth suit with segmented light armor plates on the chest, shoulders and shins, utility belt, tactical gloves, a smooth seamless black cowl helmet with two small angular cat-ear-shaped sensor fins on top and a thin glowing teal visor slit, teal accent piping, lean build, practical military gear, not a costume` |
| bunny | `the Hacker: a dark charcoal hoodie worn over light body armor with the hood up, black face mask, a thin glowing teal visor band, cargo trousers, a slim tech backpack with a coiled cable running to a glowing teal holographic wrist computer on the forearm` |
| ninja | `Shadow: navy-black cloth wraps over a fitted tactical suit, a wrapped face mask with a narrow eye slit glowing faint amber, a long dark cloth sash tied at the waist with knot tails, a short blade on the back, amber accent light` |
| robot | `R-7: a lean humanoid combat android with gunmetal grey armor plates, visible mechanical joints and seams, a smooth faceless head with a single horizontal glowing red sensor line, no human skin anywhere` |
| astro | `Special Forces: a heavier operative in ranger-green fatigues with a bulky plate carrier and pouches, ballistic helmet with a small green night-vision light, protective eyewear and a balaclava, amber accent light, holstered sidearm` |

**Title and cutscene stills** (9:16 → 1080×1920), prompt = `<subject>, STYLE, NO`:
- `title`: `Cinematic movie poster photograph, a long dark high-security corridor in deep perspective, a grid of thin bright red laser beams crossing the corridor glowing in haze, HERO, seen from behind, standing small in the lower middle of the frame facing down the corridor, the entire top third of the image is dark empty shadow, vertical composition, volumetric haze`. Post: rows 0–28 % at 35 % brightness, smoothstep back to 100 % by 42 % (logo band).
- `cut/op-2`: `Cinematic film still, vertical composition, HERO, seen from behind over the shoulder in a dim staging room, checking and tightening the straps of the gear and a wrist device, a weapon locker and a small amber work lamp, back view only`
- `cut/end-1`: `Cinematic film still, vertical composition, inside the open side door of a black helicopter at dawn on a rooftop helipad, HERO, seen from behind climbing in, helping a rescued scientist in a faded orange jumpsuit also seen from behind, rotor wash, dawn sky amber to teal, back views only`
- `cut/end-3`: `Cinematic film still, vertical composition, view from inside a departing helicopter looking down through the open side door at a secret facility complex on the outskirts of a city at sunrise, HERO, seen from behind sitting at the door edge in the foreground, low sun, long shadows, mist`

### Bosses: sniper, apc, core (replacing the v7 sprites)
`studio photograph of <subject>, full body in frame with generous margin, isolated on a solid flat bright chroma key green background, evenly lit backdrop, no floor, no shadow, dramatic cinematic rim lighting, gunmetal and matte dark steel, worn industrial military hardware, realistic, highly detailed, menacing, grounded, no text, no logos, no people` (16:9 for sniper/apc, 9:16 for core)
- sniper: `a tall three-legged tripod sniper sentry mech seen exactly from the side facing left, three long thin articulated legs planted wide, a compact armored turret head on top with a single glowing red scope eye, an extremely long railgun barrel with coil rings pointing horizontally to the left, cables and ammo drum`
- apc: `a heavy eight-wheeled armored personnel carrier in front three-quarter view facing left, bright headlights switched on, angular armor plates, a small autocannon turret on the roof, mud on the wheels` (flipped to face right, because the APC chases from behind)
- core: `a tall rectangular server-core monolith machine standing upright seen from the front, dark armored panels, a large exposed circular glowing red mechanical iris lens in the upper middle like an eye, thick bundled cables hanging and arcing from its sides into the base, small electric arcs between cable ends, heat vents`

Post: the v7 chroma key (`key.py`), saturated reds/ambers toned to 55 %, long side 1024, `cwebp -q 80 -alpha_q 90 -m 6 -sharp_yuv -exact`.
Anchors were re-measured on the opaque bbox (`BOSS_PHOTO_RIGS`). The sniper now stands on the floor (`place: 'ground', idle: 'breathe'`, no rotors).
The APC is bigger and further in (`frac 0.5, fx 0.18`).

### Achievement patches `ach/<id>.webp` (1:1 1k → 128×128 RGBA)
`Embroidered tactical morale patch, flat front view, <motif>, stitched in teal and amber thread on dark charcoal twill fabric, merrowed border, a single bold simple motif, centered, isolated on a plain near-black background, macro product photograph, soft studio light, realistic thread texture, no text, no letters, no words`
Motifs: first-clear `a single boot print crossing a thin laser line` · zone-N `a shield shape with one large crisp numeral N` · rescue `an open padlock and a broken chain` · escape `a helicopter silhouette rising above a rooftop` · flawless-boss `a cracked red robot eye behind a crosshair` · perfect-stage `a precise crosshair reticle with a small diamond in the center` · chain-50 `two interlocked chain links` · chain-100 `a long chain of interlocked links forming a circle` · overdrive-3 `a lightning bolt over three chevrons` · all-stars-zone `three stars over a castle tower` · stars-150 `a laurel wreath around a single star` · endless-60 `a stopwatch with one quarter segment filled` · endless-180 `a stopwatch with a full ring and an infinity loop` · daily-1 `a calendar page with a checkmark` · daily-7 `a row of seven small dots under a rising sun` · all-operators `six small helmet silhouettes in a hexagon arrangement` · archivist `a film reel and a folder`.
Post: the backdrop is keyed with the convex hull of everything brighter than the backdrop (blurred luma > 18; the backdrop measures about 8).
Every patch shape is convex, so the dark fabric stays opaque. Then a 2 px choke, a 1.2 px feather, a square crop on the patch and a resize to 128.

### Zone banners `zone-0…9.webp` (16:9 2k → 1280×720, replacing the 640×360 v6 set)
v6 "Zones" prompt with `no signs` added: `cinematic film still, wide shot, <subject>, no people, no text, no logos, no signs, moody teal shadows, warm amber practical lights, subtle haze, 35mm film, highly detailed, realistic materials`, same subjects.

### Map, locked dossier, icon, share card
- `map-bg.webp` (9:16 → cover-crop 1080×2400, q70): `Very dark top-down night satellite photograph of a secret walled industrial facility complex, overlaid with a faint thin teal blueprint grid and faint technical outlines of buildings, small dim amber route lights along paths, mostly near-black, very low contrast, muted, no text, no labels, no numbers, no symbols`
- `cut/locked.webp` (720×1280): `Close-up photograph of a classified intelligence dossier lying on a dark metal desk, a blurred surveillance photo clipped to it, thick black redaction bars covering every line of the document, a large faded red ink stamp shape that is illegible, a paperclip, dim amber desk lamp light, moody teal shadows, 35mm film, shallow depth of field, no readable text, no letters, no words`
- `../icon-180.png`, `icon-192.png`, `icon-512.png` (1:1): `App icon artwork, square, bold simple graphic composition: the dark silhouette of a special operative helmet in three-quarter view with a single glowing green horizontal visor light, behind it two bright red laser beams crossing in an X, dark teal background with a soft vignette, cinematic glow, high contrast, readable at small size, centered with margin, no text, no letters, no border`
- `../og.jpg` (16:9 → 1200×630, JPEG q86, because a PNG was 785 KB): `Cinematic wide movie poster photograph, a lean special operative in a matte black tactical suit with a low-profile helmet and a single green glowing visor light, teal accent piping, seen from behind on the right third of the frame, facing a long dark high-security corridor crossed by a grid of thin bright red laser beams glowing in haze, the left half of the frame is dark empty shadow for a title, moody teal shadows, warm amber practical lights, subtle haze, 35mm film, highly detailed, realistic materials, no text, no logos`

### Picks and job ids
| file | pick | params | job id |
|---|---|---|---|
| op-kid | op-kid-a | 2:3 medium 2k + hero ref | bbbd19a5-74af-4506-94dd-8447d4b54a2d |
| op-cat | op-cat-c | 2:3 medium 2k + hero ref | b5aee246-258d-4554-9aa8-b5c8d7e821b6 |
| op-bunny | op-bunny-b | 2:3 medium 2k | ff074b26-a77d-4cff-bd7d-35f1078f2747 |
| op-ninja | op-ninja-a | 2:3 medium 2k | 562b7d02-67eb-4bd9-b449-e7bf84a3d13a |
| op-robot | op-robot-a | 2:3 medium 2k | e50ca01a-2626-4bbb-b7ec-127f6929b049 |
| op-astro | op-astro-a | 2:3 medium 2k + hero ref | 8bec329b-4396-4b92-994f-8a109fe9dd18 |
| title | title-a | 9:16 medium 2k + hero ref | 76abf644-907d-4687-a610-79c1880654d3 |
| cut/op-2 | op-2-b | 9:16 medium 2k + hero ref | e14a7b23-93a3-402d-9ccd-c6471fee52d1 |
| cut/end-1 | end-1-a | 9:16 medium 2k + hero ref | 273009e1-6413-4003-97bc-b39b40db60cb |
| cut/end-3 | end-3-a | 9:16 medium 2k + hero ref | c3c6cdd1-9457-4105-8fc0-29749726fe88 |
| boss-sniper | boss-sniper-a | 16:9 medium 2k | f8810673-2b8c-4c36-8964-dd96a7459c8a |
| boss-apc | boss-apc-a | 16:9 medium 2k | e684d08a-c012-4048-bf16-301a25b36dc7 |
| boss-core | boss-core-b | 9:16 medium 2k | 0647d02d-b70f-40e6-9a98-39cbb294edbe |
| map-bg | map-a | 9:16 medium 2k | dd23a28d-50eb-4c04-b24a-bc57c422671d |
| cut/locked | locked-a | 9:16 medium 2k | 2370ca97-01f3-4d57-90c3-e746ab1e486c |
| icon-*.png | icon-a | 1:1 medium 2k | c4667811-5fcb-4987-af46-d9d3f4530f04 |
| og.jpg | og-b | 16:9 medium 2k | cbca9de8-9976-441e-a5e1-d322ee40c9d4 |
| zone-0 | zone-0-a | 16:9 medium 2k | 70e6c765-d350-49be-a8cd-1fe8dee9e5dd |
| zone-1 | zone-1-a | 16:9 medium 2k | e9b5ceae-5a2d-416c-92b4-04d063f8b08e |
| zone-2 | zone-2-a | 16:9 medium 2k | 82a405e2-56b3-4eb5-a695-08552a5ee587 |
| zone-3 | zone-3-b | 16:9 medium 2k | e3f0b0c6-2999-404c-af72-d6bfb1aeafe3 |
| zone-4 | zone-4-b | 16:9 medium 2k | e0a2b420-ffd5-458f-ab29-2591e65dbdf0 |
| zone-5 | zone-5-a | 16:9 medium 2k | 6eb79c41-3636-450a-a57e-ecf8d6bb469c |
| zone-6 | zone-6-a | 16:9 medium 2k | 29912707-c47a-4519-a98d-9b0c00e3e265 |
| zone-7 | zone-7-a | 16:9 medium 2k | ae389cad-ae57-46bf-94df-10fc00041de1 |
| zone-8 | zone-8-a | 16:9 medium 2k | 7d813361-3d8f-4ac6-a018-3472123644c2 |
| zone-9 | zone-9-b | 16:9 medium 2k | 8b4fc94a-7d39-454b-9509-a5021de552fb |
| ach/all-operators | ach-all-operators-a | 1:1 medium 1k | ef5a4685-42b7-449a-8be5-ac0be5942c8d |
| ach/all-stars-zone | ach-all-stars-zone-a | 1:1 medium 1k | dfa36fa5-c7e3-485f-b8d8-9c96a37b67ab |
| ach/archivist | ach-archivist-a | 1:1 medium 1k | 44028f78-334e-4707-8977-7b13a9d33239 |
| ach/chain-100 | ach-chain-100-a | 1:1 medium 1k | 1c83932f-a47e-4189-89cc-11ebdffdf4bd |
| ach/chain-50 | ach-chain-50-a | 1:1 medium 1k | 09fb2a45-8c37-485d-909c-4dd6287e05a8 |
| ach/daily-1 | ach-daily-1-a | 1:1 medium 1k | 3c296780-cde0-465e-8641-51227cb1fcfd |
| ach/daily-7 | ach-daily-7-b | 1:1 medium 1k | 22cd9062-511c-4f8d-b396-b00b8074a08b |
| ach/endless-180 | ach-endless-180-b | 1:1 medium 1k | b097f895-92c3-4bcb-837d-1a33dececcf8 |
| ach/endless-60 | ach-endless-60-a | 1:1 medium 1k | a8e6d528-3f3d-42c4-a66a-47944e168c1f |
| ach/escape | ach-escape-b | 1:1 medium 1k | 5844aa89-4891-4a56-af63-e87c5dcc3572 |
| ach/first-clear | ach-first-clear-a | 1:1 medium 1k | 5cc29977-1411-4c61-a389-d416799450c4 |
| ach/flawless-boss | ach-flawless-boss-a | 1:1 medium 1k | abb36fe4-3327-4552-8032-86491aa7ff0d |
| ach/overdrive-3 | ach-overdrive-3-a | 1:1 medium 1k | babb4615-6aad-485b-b8a4-b6ea4edce29d |
| ach/perfect-stage | ach-perfect-stage-a | 1:1 medium 1k | 4a4aa655-3e88-40a1-b10b-3aaad812a2b2 |
| ach/rescue | ach-rescue-a | 1:1 medium 1k | d0a6ae68-0273-48fa-bff9-8ee266cfa41f |
| ach/stars-150 | ach-stars-150-a | 1:1 medium 1k | 109de635-a7b9-45e4-b34d-df0d560d54ad |
| ach/zone-1 | ach-zone-1-a | 1:1 medium 1k | 80eac625-75da-4f21-b1d4-e6f52604ded8 |
| ach/zone-10 | ach-zone-10-a | 1:1 medium 1k | dc787979-bd9f-4ec0-9720-ed1aa5889a91 |
| ach/zone-3 | ach-zone-3-a | 1:1 medium 1k | 316e93d0-a998-43a0-963f-b81f968cb68f |
| ach/zone-5 | ach-zone-5-a | 1:1 medium 1k | f14f4d9b-f966-4267-ab44-69d197dc4a59 |
| ach/zone-7 | ach-zone-7-a | 1:1 medium 1k | be6cb80d-cf5a-4dd8-9327-4e40bce53521 |
| (hero model sheet, reference only) | hero-sheet | 3:2 medium 2k | e13b35a0-e361-4d76-9319-9726cffc825f |

Rejected:
- Black Cat a/b read as a costume bodysuit, so the look was re-prompted as armored tactical gear and c was picked.
- op-robot-b holds a rifle.
- zone-3-a has letterbox bars baked into the render.
- title-b, op-2-a, end-1-b and end-3-b have weaker compositions; end-3-b also crops the scene.
- sniper-b, apc-b and core-a have a weaker eye or weaker headlights.
- og-a cuts the operative at the right edge.
- locked-b and icon-b are near duplicates of the picks.
- For each badge, the second candidate has a less crisp motif or an extra element (for example, all-operators-b shows 7 helmets).
