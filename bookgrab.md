/\*\*

- bookGrab.config.js — ANTIGRAVITY VARIANT
- Single source of truth for all animation constants.
- Direction annotations: ↑ up ↓ down ← left → right ↻ clockwise ↺ counter-clockwise
- GPU note: only transform + opacity are ever animated. All others are static CSS.
- Total estimated timeline: ~2.45s (P0 → P5b)
  \*/

export const GRAB_CONFIG = {

// ─────────────────────────────────────────────────────────────────────────────
// § 0 PHASE 0 — LEVITATION PULSE (pre-ignition field charge)
// Book vibrates ← → as electromagnetic field builds beneath it.
// SHM: x(t) = A·sin(ωt) — pure horizontal oscillation, no lift yet.
// ─────────────────────────────────────────────────────────────────────────────
LEVITATION_PULSE_X: 4, // px ← → jitter amplitude
LEVITATION_PULSE_Y: 1, // px ↑ micro-bounce per cycle (subtle)
LEVITATION_PULSE_SCALE: 1.01, // uniform scale breathe during charge
LEVITATION_PULSE_ROT_Z: 0.8, // deg ↻ slight rock per oscillation
LEVITATION_PULSE_DURATION: 0.06, // s per half-cycle (fast buzz)
LEVITATION_PULSE_REPEAT: 3, // full oscillation cycles before P1
LEVITATION_PULSE_YOYO: true, // reverses direction each repeat
LEVITATION_PULSE_EASE: "none", // linear — raw SHM feel
LEVITATION_PULSE_DELAY: 0, // s fires immediately on click
LEVITATION_PULSE_OPACITY_FLASH: 0.92, // briefly dims — energy absorption cue
LEVITATION_PULSE_STAGGER: 0, // s (single card only, always 0)
LEVITATION_PULSE_TRANSFORM_ORIGIN:"50% 100%", // pivot at base — field enters from below

// ─────────────────────────────────────────────────────────────────────────────
// § 1 PHASE 1 — FLOAT LIFT (buoyancy overcomes slot friction)
// Fb = ρ_fluid · g_anti · V — buoyant force exceeds weight.
// Book compresses vertically (slot grip), then pops free upward.
// ─────────────────────────────────────────────────────────────────────────────
PINCH_SCALE_Y: 0.94, // compress ↓ (slot grip before release)
PINCH_SCALE_X: 1.03, // widen ← → slightly (volume conservation)
PINCH_Y: -40, // px ↑ lifts while still compressed
PINCH_Z: 20, // px toward camera — pops forward slightly
PINCH_ROT_Z: -1.5, // deg ↺ micro lean left as it lifts
PINCH_ROT_X: 4, // deg tips top ↑ toward viewer
PINCH_DURATION: 0.3, // s
PINCH_EASE: "back.out(1.7)", // overshoot — field snaps it free
PINCH_DELAY: 0, // s starts after P0 completes
PINCH_OPACITY: 1, // stays fully visible
PINCH_TRANSFORM_ORIGIN: "50% 100%", // pivot bottom edge
PINCH_SHADOW_SCALE_Y: 0.6, // shadow shrinks ↓ as book rises
PINCH_SHADOW_OPACITY: 0.4, // shadow fades as book lifts
PINCH_WILL_CHANGE: "transform, opacity", // GPU hint set at phase start

// ─────────────────────────────────────────────────────────────────────────────
// § 2 PHASE 2 — GRAVITY BREAK (rotational escape from slot constraint)
// τ = r × F_anti — torque now pulls top of book ↑ and back.
// rotationY goes NEGATIVE (tips back away from viewer).
// rotationX adds upward tipping.
// ─────────────────────────────────────────────────────────────────────────────
TILT_ROTATION_Y: -22, // deg ↺ tips back (away from viewer)
TILT_ROTATION_X: 15, // deg top tips ↑ away (antigravity torque)
TILT_ROTATION_Z: -3, // deg ↺ slight lean into ascent path
TILT_SCALE: 1.05, // grows — freed from slot constraint
TILT_Y: -65, // px ↑ continues rising through P2
TILT_Z: 35, // px further toward camera — 3D depth
TILT_DURATION: 0.35, // s
TILT_EASE: "sine.inOut", // smooth arc — no mechanical friction
TILT_DELAY: 0.04, // s slight overlap with P1 tail
TILT_OPACITY: 1, // fully visible
TILT_TRANSFORM_ORIGIN: "50% 50%", // pivot centre — free rotation
TILT_PERSPECTIVE_SHIFT: 0, // handled globally, not per-card

// ─────────────────────────────────────────────────────────────────────────────
// § 3 PHASE 3 — ASCEND ARC (vertical escape velocity dominates)
// y(t) = y₀ - ½·a_anti·t² parabola opening ↑
// Lateral drag is minimal: x barely moves vs. massive y travel.
// Book swells closer to camera — feels like it escapes TOWARD viewer first.
// ─────────────────────────────────────────────────────────────────────────────
ARC_X: 120, // px → small lateral drift (atmospheric drag)
ARC_Y: -350, // px ↑ escape velocity — dominant axis
ARC_Z: 80, // px ↑ depth: surges toward viewer mid-flight
ARC_ROT_Z: 12, // deg ↻ clockwise tumble as it ascends
ARC_ROT_X: -8, // deg tips nose ↑ into ascent
ARC_ROT_Y: -10, // deg continues backing away then straightens
ARC_SCALE: 1.6, // explodes toward camera — dramatic perspective
ARC_SCALE_X: 1.55, // allow mild non-uniform for stretch feel
ARC_SCALE_Y: 1.65, // slightly taller — momentum stretch
ARC_OPACITY: 1, // peak visibility at top of arc
ARC_DURATION: 0.85, // s hangs slightly longer in mid-air
ARC_EASE: "power2.inOut", // accelerates then decelerates at peak
ARC_DELAY: 0.08, // s
ARC_MIDPOINT_Y_OFFSET: -160, // px ↑ keyframe waypoint (for custom path)
ARC_MIDPOINT_X_OFFSET: 60, // px → waypoint — slight S-curve
ARC_TRANSFORM_ORIGIN: "50% 50%",

// ─────────────────────────────────────────────────────────────────────────────
// § 4 PHASE 4 — VOID EXIT (escape velocity achieved — exits top viewport)
// Fd = ½ρv²CdA — drag increases as speed increases, opacity fades.
// EXIT direction: TOP of viewport. y is large negative.
// rotZ flips to POSITIVE (spin reverses — antigravity field rotation rule).
// ─────────────────────────────────────────────────────────────────────────────
EXIT_X: 150, // px → continues slight lateral drift
EXIT_Y: -800, // px ↑ shoots above viewport completely
EXIT_Z: -60, // px recedes back as it exits (perspective loss)
EXIT_ROT_Z: 45, // deg ↻ extreme spin — rotZ POSITIVE in antigrav
EXIT_ROT_X: -40, // deg nose flips ↑ hard — escape tilt
EXIT_ROT_Y: 8, // deg slight yaw on exit
EXIT_SCALE: 0.5, // shrinks ↓ — distance recession after scale peak
EXIT_OPACITY: 0, // fades completely into the void
EXIT_DURATION: 0.45, // s snappier escape than normal gravity
EXIT_EASE: "power4.in", // explosive acceleration — a_anti doubles
EXIT_DELAY: 0.04, // s brief overlap with P3 tail
EXIT_TRANSFORM_ORIGIN: "50% 50%",
EXIT_OPACITY_EASE: "power2.in", // opacity fades faster at end
EXIT_OPACITY_DELAY: 0.1, // s opacity hold before fade begins

// ─────────────────────────────────────────────────────────────────────────────
// § 5 PHASE 5 — SIBLING LEVITATION WAVE (pressure wave from removal)
// F = -k·x — spring restoring on TWO axes: y first, then x.
// 5a: siblings briefly levitate ↑ (pressure release)
// 5b: siblings settle ↓ to y=0 + close gap (elastic re-anchor)
// ─────────────────────────────────────────────────────────────────────────────
// 5a — Float up
SIBLING_FLOAT_Y: -10, // px ↑ brief levitation
SIBLING_FLOAT_SCALE: 1.02, // slight swell — decompression
SIBLING_FLOAT_ROT_Z: 1.2, // deg ↺ rock slightly outward
SIBLING_FLOAT_DURATION: 0.28, // s
SIBLING_FLOAT_EASE: "power2.out",
SIBLING_FLOAT_OPACITY: 1, // stays visible
// 5b — Settle + gap close
SIBLING_SETTLE_Y: 0, // px returns to baseline
SIBLING_SETTLE_SCALE: 1, // back to normal
SIBLING_SETTLE_ROT_Z: 0, // deg back to upright
SIBLING_SETTLE_DURATION: 0.38, // s
SIBLING_SETTLE_EASE: "elastic.out(1, 0.3)", // bouncy re-anchor
SIBLING_SHIFT: -22, // px ← gap close (toward removed book's slot)
SIBLING_DURATION: 0.4, // s x-shift duration
SIBLING_EASE: "power2.out",
SIBLING_STAGGER: 0.05, // s ripple outward from removed book position
SIBLING_STAGGER_DIRECTION: "start", // ripple from nearest sibling outward
SIBLING_OVERLAP: "-=0.45",// timeline overlap: 5a starts before P4 ends
SIBLING_WAVE_DECAY: 0.85, // amplitude multiplier per sibling (wave dampens)
SIBLING_MAX_AFFECTED: 6, // max siblings that react

// ─────────────────────────────────────────────────────────────────────────────
// § 6 AMBIENT LEVITATION LOOP (idle state — all cards on shelf)
// Buoyancy at rest: subtle sine-wave oscillation ↑↓, infinite.
// Killed via gsap.killTweensOf(card) the instant grab fires.
// ─────────────────────────────────────────────────────────────────────────────
AMBIENT_FLOAT_Y: -5, // px ↑ peak of idle oscillation
AMBIENT_FLOAT_Y_MIN: 0, // px ↓ trough (CSS origin)
AMBIENT_FLOAT_SCALE: 1.008, // very subtle breathe — life-like
AMBIENT_FLOAT_ROT_Z: 0.6, // deg gentle sway ← → (random per card)
AMBIENT_FLOAT_DURATION: 1.8, // s per half-cycle
AMBIENT_FLOAT_EASE: "sine.inOut",
AMBIENT_FLOAT_REPEAT: -1, // infinite
AMBIENT_FLOAT_YOYO: true, // reverses at each end
AMBIENT_FLOAT_STAGGER: 0.12, // s each card offset — avoids synchrony
AMBIENT_FLOAT_STAGGER_FROM: "random",// random offsets feel organic
AMBIENT_SWAY_DURATION: 2.4, // s rotZ sway (separate, slower than y)
AMBIENT_SWAY_EASE: "sine.inOut",
AMBIENT_BREATHE_SCALE_DURATION: 2.2, // s scale breathe cycle
AMBIENT_KILL_FADE_DURATION: 0.1, // s tween-out ambient before grab fires
AMBIENT_RESUME_DELAY: 1.2, // s after book exits, restart ambient on shelf

// ─────────────────────────────────────────────────────────────────────────────
// § 7 3-D RENDERING (perspective + preserve-3d)
// Lower perspective = more dramatic depth for vertical exit.
// Origin at 50% 80% so top exit reads more extreme.
// ─────────────────────────────────────────────────────────────────────────────
PERSPECTIVE: "900px",
PERSPECTIVE_ORIGIN: "50% 80%",
PERSPECTIVE_MOBILE: "600px", // tighter on small viewports
CARD_Z_BASE: 0, // px cards start at z=0 in stack
CARD_Z_HOVER: 40, // px toward camera on hover
GRID_TILT_X: 3, // deg shelf tilts ↓ slightly (antigravity lean)
GRID_TRANSFORM_STYLE: "preserve-3d",
CARD_TRANSFORM_STYLE: "preserve-3d",
CARD_BACKFACE_VISIBILITY: "hidden",
DEPTH_SCALE_FACTOR: 1.0, // multiplier for z translations (tune globally)
CAMERA_RESET_DURATION: 0.5, // s perspective returns after exit

// ─────────────────────────────────────────────────────────────────────────────
// § 8 GLOW / VISUAL FX (static CSS — NOT animated, GPU safe)
// Upward glow suggests levitation field below each card.
// ─────────────────────────────────────────────────────────────────────────────
GLOW_COLOR: "rgba(100, 160, 255, 1)",
GLOW_COLOR_PULSE: "rgba(120, 200, 255, 1)",
GLOW_IDLE_SPREAD: 8, // px drop-shadow spread at rest
GLOW_IDLE_BLUR: 8, // px
GLOW_IDLE_OPACITY: 0.18, // alpha of glow at idle
GLOW_GRAB_SPREAD: 24, // px glow explodes on grab
GLOW_GRAB_BLUR: 24, // px
GLOW_GRAB_OPACITY: 0.45,
GLOW_EXIT_BLUR: 40, // px blurs as it accelerates ↑
GLOW_EXIT_OPACITY: 0.0, // fades at exit
GLOW_DIRECTION_Y: -4, // px ↑ shadow offset (upward = light below)
GLOW_DIRECTION_X: 0, // px centred horizontally
TINT_COLOR: "rgba(120, 180, 255, 0.06)", // shelf bg tint
TINT_GRABBING_OPACITY: 0.12, // shelf tint brightens on grab
SHADOW_BASE_BLUR: 12, // px base book shadow
SHADOW_BASE_COLOR: "rgba(60, 100, 200, 0.25)",

// ─────────────────────────────────────────────────────────────────────────────
// § 9 SPRING PHYSICS (tuning for elastic/bounce eases)
// Used to derive elastic.out(amplitude, period) values.
// Higher stiffness = tighter bounce. Higher damping = fewer oscillations.
// ─────────────────────────────────────────────────────────────────────────────
SPRING_STIFFNESS: 180, // N/m — controls snap speed
SPRING_DAMPING: 12, // Ns/m — controls how quickly it settles
SPRING_MASS: 1, // kg — logical card mass unit
SPRING_INITIAL_VELOCITY: 0, // m/s — at rest before grab
SPRING_OVERSHOOT_CLAMP: false, // allow overshoot for organic feel
SPRING_SETTLE_THRESHOLD: 0.01, // units — animation ends below this delta
SPRING_AMPLITUDE_P1: 1.7, // back.out amplitude (P1 buoyancy snap)
SPRING_PERIOD_P5: 0.3, // elastic.out period (P5 sibling settle)
SPRING_AMPLITUDE_P5: 1.0, // elastic.out amplitude
ELASTIC_BACK_OUT_P0: "back.out(2.0)", // pre-computed ease strings
ELASTIC_OUT_P5A: "elastic.out(1, 0.3)",
ELASTIC_OUT_P5B: "elastic.out(0.8, 0.4)",

// ─────────────────────────────────────────────────────────────────────────────
// § 10 TIMING & ORCHESTRATION (inter-phase overlaps and total budget)
// All overlap values are GSAP timeline position strings.
// Positive = delay after prev phase. Negative = overlap with prev.
// ─────────────────────────────────────────────────────────────────────────────
PHASE_OVERLAP_P0_P1: "+=0", // P1 starts immediately after P0
PHASE_OVERLAP_P1_P2: "-=0.05",// P2 starts 0.05s before P1 ends
PHASE_OVERLAP_P2_P3: "-=0.08",// P3 starts 0.08s before P2 ends
PHASE_OVERLAP_P3_P4: "-=0.10",// P4 starts as P3 peaks
PHASE_OVERLAP_P4_P5: "-=0.45",// P5 starts well before P4 finishes
TOTAL_DURATION_ESTIMATE: 2.45, // s (reference — do not animate)
GRAB_COOLDOWN: 0.4, // s debounce — ignore clicks during animation
WILL_CHANGE_REMOVE_DELAY: 0.05, // s after onComplete, remove will-change
TIMELINE_DEFAULTS_EASE: "power2.out",
TIMELINE_DEFAULTS_OVERWRITE: "auto", // GSAP overwrite mode

// ─────────────────────────────────────────────────────────────────────────────
// § 11 RESPONSIVE / BREAKPOINTS (scale factors per viewport)
// Applied as multipliers to key values — keeps proportions consistent.
// ─────────────────────────────────────────────────────────────────────────────
BREAKPOINT_MOBILE_MAX: 480, // px viewport width
BREAKPOINT_TABLET_MAX: 1024, // px viewport width
MOBILE_Y_SCALE: 0.65, // reduce vertical travel on small screens
MOBILE_X_SCALE: 0.6, // reduce lateral drift
MOBILE_DURATION_SCALE: 0.85, // slightly faster on mobile
MOBILE_SCALE_MAX: 1.35, // cap scale on mobile (avoids overflow)
TABLET_Y_SCALE: 0.82,
TABLET_X_SCALE: 0.78,
TABLET_DURATION_SCALE: 0.92,
VIEWPORT_TOP_PADDING: 20, // px clearance before exit considered "void"
CLAMP_Y_MAX: -900, // px never translate further than this ↑
CLAMP_X_MAX: 300, // px max lateral drift ←→

// ─────────────────────────────────────────────────────────────────────────────
// § 12 GRAB TARGET (the card being grabbed)
// Class names and selectors used in bookGrab.js queries.
// ─────────────────────────────────────────────────────────────────────────────
CLASS_CARD: "book-card",
CLASS_GRID: "book-grid",
CLASS_GRABBING: "is-grabbing",
CLASS_ANTIGRAVITY: "is-antigravity",
CLASS_EXITING: "is-exiting",
CLASS_AMBIENT: "is-ambient",
SELECTOR_SIBLINGS: ".book-card:not(.is-grabbing)",
SELECTOR_SHELF: "#drawer .book-grid",

// ─────────────────────────────────────────────────────────────────────────────
// § 13 ACCESSIBILITY (prefers-reduced-motion fallback)
// When prefersReducedMotion() = true, ALL phases are skipped.
// Only an instant opacity set fires, then onDone() is called.
// ─────────────────────────────────────────────────────────────────────────────
A11Y_REDUCED_OPACITY_TARGET: 0, // fade to invisible instantly
A11Y_REDUCED_DURATION: 0, // s instant (no tween)
A11Y_SKIP_PHASES: ["P0","P1","P2","P3","P4","P5"], // all skipped
A11Y_AMBIENT_DISABLED: true, // no idle float in reduced motion
A11Y_SIBLING_SHIFT_INSTANT: true, // siblings snap to new position instantly
A11Y_SIBLING_SHIFT_DURATION: 0, // s

// ─────────────────────────────────────────────────────────────────────────────
// § 14 DEBUG / DEV (set DEBUG_ENABLED: false in production)
// ─────────────────────────────────────────────────────────────────────────────
DEBUG_ENABLED: false, // master switch
DEBUG_SLOW_MOTION: 1.0, // multiplier — set to 5 for slow-mo review
DEBUG_SHOW_PHASE_LABELS: false, // overlay phase name on card during tween
DEBUG_HIGHLIGHT_GPU_PROPS: false, // outline elements with will-change set
DEBUG_LOG_TIMELINE: false, // console.log each phase start
DEBUG_VISUALIZE_FORCES: false, // draw SVG force arrows on card
DEBUG_GRID_OVERLAY: false, // CSS grid overlay for alignment
DEBUG_WIREFRAME: false, // outline all transformed elements
DEBUG_PHYSICS_PANEL: false, // floating panel showing live values

};

/\*\*

- PARAMETER INDEX (quick-reference for bookGrab.js consumers)
-
- Phase │ Key prefix │ Count │ Direction summary
- ──────┼─────────────────────┼───────┼────────────────────────────────────────
- P0 │ LEVITATION*PULSE* │ 12 │ x ←→ y ↑ scale breathe rotZ sway
- P1 │ PINCH\_ │ 14 │ scaleY compress ↓ y ↑ z forward
- P2 │ TILT\_ │ 11 │ rotY back rotX top ↑ y ↑ z forward
- P3 │ ARC\_ │ 16 │ y ↑↑ dominant x → small scale ↑ big
- P4 │ EXIT\_ │ 14 │ y ↑↑↑ viewport exit rotZ ↻ positive
- P5 │ SIBLING\_ │ 19 │ y ↑ then y=0 elastic x ← gap close
- Amb │ AMBIENT\_ │ 14 │ y ↑↓ infinite sway breathe
- 3D │ PERSPECTIVE / CARD\_ │ 10 │ 900px origin 50% 80% z-stack
- FX │ GLOW* / TINT* │ 16 │ upward shadow ↑ blue tint static CSS
- Spring│ SPRING\_ │ 12 │ elastic.out / back.out tuning
- Time │ PHASE*OVERLAP* │ 10 │ inter-phase position strings
- Resp │ MOBILE* / TABLET* │ 12 │ scale factors per viewport
- DOM │ CLASS* / SELECTOR* │ 8 │ class names + query selectors
- A11y │ A11Y\_ │ 6 │ reduced-motion instant fallback
- Debug │ DEBUG\_ │ 9 │ dev tools — all false in prod
-       │                     │ 183   │
  \*/
