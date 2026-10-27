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
