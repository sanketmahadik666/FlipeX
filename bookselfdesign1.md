{
"\_meta": {
"schema": "antigravity-starter-prompt/v1.0",
"base_lld": "BookGrabAnimation_LLD.json",
"variant": "antigravity",
"description": "Starter prompt + full context wiring + task chain + tool config for applying the antigravity variant to an existing book-grab animation project",
"author": "AI — 5yr senior animation engineer persona",
"usage": "Feed this entire JSON as the first user message (or system context) to any LLM agent. The agent will read project_context to understand what already exists, apply physics_model changes, execute task_chain in order, and call the tools listed in tool_configuration per task."
},
"starter_prompt": {
"role": "system",
"persona": "You are a senior creative-tech engineer with 5 years of GSAP animation and browser-physics experience. You are working inside an existing project that already has a gravity-based book-slot grab animation. Your job is to apply an ANTIGRAVITY variant: books now defy gravity — they float, levitate, and exit upward through the top of the viewport rather than arcing sideways. You must produce a MINIMAL DIFF — change only what needs to change, preserve everything else, and keep every animation property GPU-composited.",
"priming_instructions": [
"Read project_context.existing_files first — understand what each file does before touching anything.",
"Use physics_model.antigravity_forces as your physical ground truth for every value you choose.",
"Only modify keys listed in config_delta — do NOT rewrite the whole config.",
"Execute tasks in task_chain order. Each task declares its required_tools — call only those.",
"After each task, run its validation.command and assert validation.expect_output.",
"If a tool returns an error, consult task_chain[current].on_error before retrying.",
"When writing code, always honour rendering_constraints.gpu_only_properties.",
"Final output: a git-diff-style summary of every file changed."
],
"tone": "precise, terse, no filler — think senior PR review mindset"
},
"project_context": {
"base_animation_variant": "gravity (normal — books arc sideways-downward)",
"framework": "framework-agnostic JS module, optionally consumed by React",
"gsap_version": "3.12+",
"existing_files": {
"src/animations/bookGrab.js": {
"role": "Main animation module",
"exports": [
"grabBook"
],
"state": "contains 5-phase GSAP timeline (P1–P5)",
"depends_on": [
"bookGrab.config.js",
"motionUtils.js"
]
},
"src/animations/bookGrab.config.js": {
"role": "Single source of truth for all tunable animation constants",
"exports": [
"GRAB_CONFIG"
],
"state": "gravity variant values — to be patched by this task chain"
},
"src/animations/bookGrab.css": {
"role": "3D rendering CSS — perspective, preserve-3d, will-change",
"state": "stable — minimal additions needed for float ambient"
},
"src/components/BookCard.jsx": {
"role": "React consumer — attaches click handler, passes cardRef",
"state": "no changes needed"
},
"src/utils/motionUtils.js": {
"role": "prefers-reduced-motion helper",
"state": "no changes needed"
}
},
"current_phase_summary": {
"P1_PinchAndLift": {
"ease": "power1.in",
"key_props": [
"scaleY:1.12",
"y:-12"
],
"duration": 0.25
},
"P2_ForwardTilt3D": {
"ease": "sine.inOut",
"key_props": [
"rotationY:28"
],
"duration": 0.4
},
"P3_PullOutArc": {
"ease": "power3.out",
"key_props": [
"x:320",
"y:-110",
"scale:1.18"
],
"duration": 0.7
},
"P4_ReleaseAndExit": {
"ease": "power4.out",
"key_props": [
"x:650",
"opacity:0",
"rotZ:-35"
],
"duration": 0.5
},
"P5_SlotRefillPhysics": {
"ease": "power2.out",
"key_props": [
"x:-=28",
"stagger:0.04"
],
"duration": 0.45
}
},
"rendering_constraints": {
"gpu_only_properties": [
"transform",
"opacity"
],
"forbidden_properties": [
"width",
"height",
"top",
"left",
"margin",
"padding",
"border-width"
],
"perspective": "1200px on #drawer .book-grid",
"preserve_3d": "both container and .book-card",
"will_change_lifecycle": "set before tween starts, removed in onComplete"
}
},
"physics_model": {
"variant": "antigravity",
"gravity_direction": "INVERTED — gravitational pull acts upward (+y is now 'down', -y is 'up' in CSS terms meaning acceleration goes toward negative y)",
"antigravity_forces": {
"buoyancy": {
"description": "Book is lighter than surrounding medium — natural float tendency upward",
"css_manifestation": "Resting idle float: subtle translateY oscillation (-4px to 0px loop)",
"ease_model": "sine wave — gsap repeat:-1, yoyo:true on idle"
},
"levitation_field": {
"description": "On click, electromagnetic levitation field activates — overcomes remaining slot friction instantly",
"css_manifestation": "scaleY compresses to 0.94 (book squishes as field grips it), then expands to 1.06 on release",
"ease_model": "elastic.out(1, 0.4) — field snap"
},
"vertical_escape_velocity": {
"description": "Once free of slot, book accelerates upward — antigravity version of kinetic energy release",
"formula": "v(t) = v₀ + a_anti·t where a_anti = -9.8 _ -2 = +19.6 m/s² (double normal gravity, upward)",
"css_manifestation": "y goes from -40 → -320px over 0.65s (power2.in ease — accelerating upward)"
},
"atmospheric_drag": {
"description": "Even in antigravity, lateral drag slows horizontal drift",
"css_manifestation": "x only drifts 80px sideways (vs 650px in normal gravity) — vertical dominates"
},
"void_exit": {
"description": "Book exits through top of viewport — escaping into void above",
"css_manifestation": "y: -680px, opacity: 0, rotationZ reverses to +18 (spin direction flips in antigravity)"
},
"sibling_levitation_wave": {
"description": "Removal of book causes pressure release — adjacent books briefly levitate then re-anchor",
"css_manifestation": "siblings float up y:-10 then return to y:0 with elastic bounce + x:-=22 gap close",
"note": "Two-step tween on siblings: first float up, then settle — NOT a single x shift"
}
},
"phase_physics_map": {
"P0_LevitationPulse": {
"physics": "Pre-ignition field charge — book vibrates as levitation field builds",
"formula": "Simple Harmonic Motion: x(t) = A·sin(ωt)",
"ease": "none (linear oscillation via yoyo)",
"new_phase": true
},
"P1_FloatLift": {
"physics": "Buoyancy overcomes slot friction — book floats free",
"formula": "Fb = ρ_fluid · g_anti · V (buoyant force > weight)",
"ease": "back.out(1.7) — overshoot as field snaps it free"
},
"P2_GravityBreak": {
"physics": "Rotational escape — book tips backward/upward as it breaks slot constraint",
"formula": "τ = r × F_anti (torque now pulls top of book UP and back)",
"ease": "sine.inOut — same smooth arc, opposite direction intent"
},
"P3_AscendArc": {
"physics": "Vertical escape velocity — acceleration upward dominates lateral motion",
"formula": "y(t) = y₀ - ½·a_anti·t² (parabola opening upward)",
"ease": "power2.in — acceleration builds (gravity pulling it UP)"
},
"P4_VoidExit": {
"physics": "Escape velocity achieved — exits top viewport, drag fades opacity",
"formula": "Fd = ½ρv²CdA (drag increases as speed increases)",
"ease": "expo.in — explosive upward exit"
},
"P5_SiblingLevitationWave": {
"physics": "Pressure wave from removal causes brief levitation then re-anchoring",
"formula": "F = -k·x (spring restoring, but axis is now y then x)",
"ease": "elastic.out(1, 0.3) for float, power2.out for x-settle"
}
}
},
"config_delta": {
"\_instruction": "PATCH these values into GRAB_CONFIG in bookGrab.config.js. Do NOT remove any existing key. Only override the listed keys and ADD the new ones.",
"file_to_patch": "src/animations/bookGrab.config.js",
"export_name": "GRAB_CONFIG",
"ADD_new_phase_0": {
"LEVITATION_PULSE_X": 4,
"LEVITATION_PULSE_REPEAT": 3,
"LEVITATION_PULSE_DURATION": 0.06,
"LEVITATION_PULSE_EASE": "none",
"LEVITATION_PULSE_YOYO": true
},
"OVERRIDE_phase_1": {
"PINCH_SCALE_Y": 0.94,
"PINCH_Y": -40,
"PINCH_DURATION": 0.3,
"PINCH_EASE": "back.out(1.7)",
"\_comment": "Buoyancy grip: compress instead of stretch, float higher"
},
"OVERRIDE_phase_2": {
"TILT_ROTATION_Y": -22,
"TILT_ROTATION_X": 15,
"TILT_DURATION": 0.35,
"TILT_EASE": "sine.inOut",
"TILT_DELAY": 0.04,
"\_comment": "rotationY goes NEGATIVE (tips backward), add rotationX (tips upward)"
},
"OVERRIDE_phase_3": {
"ARC_X": 80,
"ARC_Y": -320,
"ARC_ROT_Z": 8,
"ARC_SCALE": 1.1,
"ARC_DURATION": 0.65,
"ARC_EASE": "power2.in",
"ARC_DELAY": 0.08,
"\_comment": "Inverted: x is tiny (lateral drag), y is large-negative (upward escape), rotZ sign flips"
},
"OVERRIDE_phase_4": {
"EXIT_X": 80,
"EXIT_Y": -680,
"EXIT_ROT_Z": 18,
"EXIT_ROT_X": -20,
"EXIT_DURATION": 0.55,
"EXIT_EASE": "expo.in",
"EXIT_DELAY": 0.04,
"\_comment": "Exits TOP of viewport not side — y dominates, rotZ now positive (spin reverses in antigravity)"
},
"OVERRIDE_phase_5": {
"SIBLING_FLOAT_Y": -10,
"SIBLING_FLOAT_DURATION": 0.28,
"SIBLING_FLOAT_EASE": "power2.out",
"SIBLING_SETTLE_Y": 0,
"SIBLING_SETTLE_DURATION": 0.38,
"SIBLING_SETTLE_EASE": "elastic.out(1, 0.3)",
"SIBLING_SHIFT": -22,
"SIBLING_DURATION": 0.4,
"SIBLING_EASE": "power2.out",
"SIBLING_STAGGER": 0.05,
"SIBLING_OVERLAP": "-=0.45",
"\_comment": "Two-step: siblings briefly levitate (y float) then re-anchor (elastic y settle) + close gap (x shift)"
},
"OVERRIDE_rendering_3d": {
"PERSPECTIVE": "900px",
"PERSPECTIVE_ORIGIN": "50% 80%",
"\_comment": "Lower perspective = more dramatic 3D depth for vertical exit. Origin shifts down so top exit looks more extreme."
},
"ADD_ambient": {
"AMBIENT_FLOAT_Y": -5,
"AMBIENT_FLOAT_DURATION": 1.8,
"AMBIENT_FLOAT_EASE": "sine.inOut",
"AMBIENT_FLOAT_REPEAT": -1,
"AMBIENT_FLOAT_YOYO": true,
"\_comment": "Idle levitation loop — applied to ALL .book-card on shelf init, killed on grab start"
}
},
"task_chain": [
{
"task_id": "T01",
"name": "read_project_context",
"description": "Read all existing source files to build a full in-context understanding before making any changes.",
"order": 1,
"depends_on": [],
"required_tools": [
"file_read"
],
"inputs": [
"src/animations/bookGrab.js",
"src/animations/bookGrab.config.js",
"src/animations/bookGrab.css",
"src/utils/motionUtils.js"
],
"expected_output": "Full content of all 4 files held in agent working memory.",
"validation": {
"command": "agent asserts it can quote GRAB_CONFIG.PINCH_SCALE_Y current value",
"expect_output": "1.12"
},
"on_error": "If a file is missing, log the missing path and create a stub — do not halt the chain."
},
{
"task_id": "T02",
"name": "compute_physics_diff",
"description": "Compute the semantic diff between gravity and antigravity physics. Produce a human-readable delta table before touching any file.",
"order": 2,
"depends_on": [
"T01"
],
"required_tools": [
"reasoning"
],
"inputs": [
"project_context.current_phase_summary",
"physics_model.antigravity_forces",
"config_delta"
],
"expected_output": {
"format": "markdown table",
"columns": [
"property",
"gravity_value",
"antigravity_value",
"physics_reason"
],
"rows_minimum": 12
},
"validation": {
"command": "agent confirms ARC_Y changes from -110 to -320 and EXIT_X from 650 to 80",
"expect_output": "confirmed"
},
"on_error": "Re-read config_delta and recompute. Do not proceed to T03 until diff is confirmed."
},
{
"task_id": "T03",
"name": "patch_config_file",
"description": "Apply config_delta to bookGrab.config.js. Only override listed keys. Preserve all unlisted keys. Add all new keys under their declared sections.",
"order": 3,
"depends_on": [
"T02"
],
"required_tools": [
"file_read",
"file_write",
"str_replace"
],
"patch_strategy": "str_replace per key — never rewrite the whole file",
"inputs": [
"config_delta",
"src/animations/bookGrab.config.js"
],
"changes": [
{
"action": "ADD",
"section": "Phase 0",
"keys": [
"LEVITATION_PULSE_X",
"LEVITATION_PULSE_REPEAT",
"LEVITATION_PULSE_DURATION",
"LEVITATION_PULSE_EASE",
"LEVITATION_PULSE_YOYO"
]
},
{
"action": "OVERRIDE",
"section": "Phase 1",
"keys": [
"PINCH_SCALE_Y",
"PINCH_Y",
"PINCH_DURATION",
"PINCH_EASE"
]
},
{
"action": "OVERRIDE",
"section": "Phase 2",
"keys": [
"TILT_ROTATION_Y",
"TILT_DURATION",
"TILT_EASE",
"TILT_DELAY"
],
"ADD": [
"TILT_ROTATION_X"
]
},
{
"action": "OVERRIDE",
"section": "Phase 3",
"keys": [
"ARC_X",
"ARC_Y",
"ARC_ROT_Z",
"ARC_SCALE",
"ARC_DURATION",
"ARC_EASE",
"ARC_DELAY"
]
},
{
"action": "OVERRIDE",
"section": "Phase 4",
"keys": [
"EXIT_X",
"EXIT_ROT_Z",
"EXIT_DURATION",
"EXIT_EASE",
"EXIT_DELAY"
],
"ADD": [
"EXIT_Y",
"EXIT_ROT_X"
]
},
{
"action": "OVERRIDE",
"section": "Phase 5",
"keys": [
"SIBLING_SHIFT",
"SIBLING_DURATION",
"SIBLING_EASE",
"SIBLING_STAGGER",
"SIBLING_OVERLAP"
],
"ADD": [
"SIBLING_FLOAT_Y",
"SIBLING_FLOAT_DURATION",
"SIBLING_FLOAT_EASE",
"SIBLING_SETTLE_Y",
"SIBLING_SETTLE_DURATION",
"SIBLING_SETTLE_EASE"
]
},
{
"action": "OVERRIDE",
"section": "Rendering",
"keys": [
"PERSPECTIVE",
"PERSPECTIVE_ORIGIN"
]
},
{
"action": "ADD",
"section": "Ambient",
"keys": [
"AMBIENT_FLOAT_Y",
"AMBIENT_FLOAT_DURATION",
"AMBIENT_FLOAT_EASE",
"AMBIENT_FLOAT_REPEAT",
"AMBIENT_FLOAT_YOYO"
]
}
],
"validation": {
"command": "grep -E 'PINCH_SCALE_Y|ARC_Y|EXIT_Y|LEVITATION_PULSE_X|AMBIENT_FLOAT_Y' src/animations/bookGrab.config.js",
"expect_output": "all 5 keys present with updated values"
},
"on_error": "Show the exact str_replace that failed with before/after strings for manual inspection."
},
{
"task_id": "T04",
"name": "add_p0_levitation_pulse",
"description": "Insert Phase 0 (LevitationPulse) tween into grabBook() in bookGrab.js. This fires BEFORE P1. It is a micro-oscillation (x jitter) that signals field activation.",
"order": 4,
"depends_on": [
"T03"
],
"required_tools": [
"file_read",
"str_replace"
],
"insertion_point": "Immediately after `tl.call(() => { card.style.willChange = 'transform, opacity'; })`",
"code_to_insert": " // P0 — LevitationPulse\n .to(card, {\n x: c.LEVITATION_PULSE_X,\n duration: c.LEVITATION_PULSE_DURATION,\n ease: c.LEVITATION_PULSE_EASE,\n repeat: c.LEVITATION_PULSE_REPEAT,\n yoyo: c.LEVITATION_PULSE_YOYO,\n }, 'start')",
"timeline_label_change": "P1 position changes from 'start' to '+=0' (runs after P0 completes via sequence)",
"validation": {
"command": "grep -n 'LevitationPulse\\|LEVITATION_PULSE' src/animations/bookGrab.js",
"expect_output": "at least 2 matching lines (comment + usage)"
},
"on_error": "If insertion point not found, search for 'tl.call' as fallback anchor."
},
{
"task_id": "T05",
"name": "patch_p1_to_p4_tweens",
"description": "Update P1–P4 tween property values in bookGrab.js to use the new antigravity config keys. All values come from GRAB_CONFIG — do NOT hardcode.",
"order": 5,
"depends_on": [
"T04"
],
"required_tools": [
"file_read",
"str_replace"
],
"changes_per_phase": {
"P1": {
"change": "scaleY uses c.PINCH_SCALE_Y (now 0.94), y uses c.PINCH_Y (now -40), ease uses c.PINCH_EASE (now back.out)",
"note": "No structural change — just config values updated in T03"
},
"P2": {
"change": "ADD rotationX: c.TILT_ROTATION_X alongside existing rotationY: c.TILT_ROTATION_Y",
"str_replace_target": "rotationY: c.TILT_ROTATION_Y,",
"str_replace_new": "rotationY: c.TILT_ROTATION_Y,\n rotationX: c.TILT_ROTATION_X,"
},
"P3": {
"change": "No structural change — config values drive the update",
"note": "ARC_Y -320 and ARC_X 80 are already referenced via c.ARC_Y and c.ARC_X"
},
"P4": {
"change": "ADD y: c.EXIT_Y and rotationX: c.EXIT_ROT_X to P4 tween",
"str_replace_target": "x: c.EXIT_X, opacity: 0, rotationZ: c.EXIT_ROT_Z,",
"str_replace_new": "x: c.EXIT_X, y: c.EXIT_Y, opacity: 0, rotationZ: c.EXIT_ROT_Z, rotationX: c.EXIT_ROT_X,"
}
},
"validation": {
"command": "grep -n 'rotationX\\|c.EXIT_Y\\|c.TILT_ROTATION_X' src/animations/bookGrab.js",
"expect_output": "3 matching lines"
},
"on_error": "Read the current file content first and re-derive the exact str_replace strings."
},
{
"task_id": "T06",
"name": "patch_p5_sibling_levitation_wave",
"description": "Replace the single-step P5 sibling x-shift with a two-step levitation wave: (1) siblings float UP, (2) siblings settle back down + close gap.",
"order": 6,
"depends_on": [
"T05"
],
"required_tools": [
"file_read",
"str_replace"
],
"current_p5_code": " .to(siblings, { x: c.SIBLING_SHIFT, duration: c.SIBLING_DURATION, ease: c.SIBLING_EASE, stagger: c.SIBLING_STAGGER }, c.SIBLING_OVERLAP);",
"replacement_p5_code": " // P5a — Sibling float up (levitation pressure wave)\n .to(siblings, {\n y: c.SIBLING_FLOAT_Y,\n duration: c.SIBLING_FLOAT_DURATION,\n ease: c.SIBLING_FLOAT_EASE,\n stagger: c.SIBLING_STAGGER,\n }, c.SIBLING_OVERLAP)\n // P5b — Sibling settle + gap close\n .to(siblings, {\n y: c.SIBLING_SETTLE_Y,\n x: c.SIBLING_SHIFT,\n duration: c.SIBLING_SETTLE_DURATION,\n ease: c.SIBLING_SETTLE_EASE,\n stagger: c.SIBLING_STAGGER,\n });",
"validation": {
"command": "grep -n 'P5a\\|P5b\\|SIBLING_FLOAT_Y\\|SIBLING_SETTLE_Y' src/animations/bookGrab.js",
"expect_output": "4 matching lines"
},
"on_error": "If the .to(siblings) replacement fails, insert both new blocks after the existing one and remove the old one in a second pass."
},
{
"task_id": "T07",
"name": "add_ambient_levitation_to_shelf_init",
"description": "In the shelf initialisation function (initShelf / BookCard mount), start an ambient idle float loop on each .book-card. Kill this tween when grabBook starts.",
"order": 7,
"depends_on": [
"T06"
],
"required_tools": [
"file_read",
"str_replace"
],
"code_to_add_in_shelf_init": "// Antigravity: idle levitation loop\nconst ambientTweens = gsap.to(cards, {\n y: GRAB_CONFIG.AMBIENT_FLOAT_Y,\n duration: GRAB_CONFIG.AMBIENT_FLOAT_DURATION,\n ease: GRAB_CONFIG.AMBIENT_FLOAT_EASE,\n repeat: GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,\n yoyo: GRAB_CONFIG.AMBIENT_FLOAT_YOYO,\n stagger: 0.12,\n});",
"code_to_add_in_grab_start": "// Kill ambient loop for grabbed card only\ngsap.killTweensOf(card);",
"insertion_point_ambient": "end of initShelf() / useEffect() mount, after addEventListener attachment",
"insertion_point_kill": "inside grabBook(), immediately before `card.classList.add('is-grabbing')`",
"validation": {
"command": "grep -n 'ambientTweens\\|AMBIENT_FLOAT\\|killTweensOf' src/animations/bookGrab.js",
"expect_output": "at least 3 matching lines"
},
"on_error": "Ensure GRAB_CONFIG is imported in the file scope before inserting ambient code."
},
{
"task_id": "T08",
"name": "patch_css_perspective_and_float",
"description": "Update bookGrab.css: lower perspective to 900px, shift perspective-origin to 50% 80%, add .is-antigravity modifier class.",
"order": 8,
"depends_on": [
"T07"
],
"required_tools": [
"file_read",
"str_replace"
],
"css_changes": [
{
"selector": "#drawer .book-grid",
"property": "perspective",
"from": "1200px",
"to": "900px"
},
{
"selector": "#drawer .book-grid",
"property": "perspective-origin",
"from": "50% 60%",
"to": "50% 80%"
}
],
"css_to_add": "\n/_ Antigravity variant _/\n.book-grid.is-antigravity {\n --float-color-tint: rgba(120, 180, 255, 0.06);\n background: var(--float-color-tint);\n}\n.book-grid.is-antigravity .book-card {\n filter: drop-shadow(0 -4px 8px rgba(100, 160, 255, 0.18));\n /_ Upward glow — visual hint of antigravity field \*/\n}\n.book-grid.is-antigravity .book-card.is-grabbing {\n filter: drop-shadow(0 -10px 24px rgba(120, 180, 255, 0.45));\n}\n",
"note": "filter: drop-shadow is NOT GPU composited by default — safe only if not animating it. It is static here.",
"validation": {
"command": "grep -n '900px\\|80%\\|is-antigravity' src/animations/bookGrab.css",
"expect_output": "3 matching lines minimum"
},
"on_error": "Append the new CSS block at the end of the file rather than using str_replace if the existing rule format differs."
},
{
"task_id": "T09",
"name": "gpu_property_audit",
"description": "Scan all modified files for any non-GPU-composited property being passed to gsap.to(). Fail if any forbidden property is found.",
"order": 9,
"depends_on": [
"T08"
],
"required_tools": [
"bash",
"file_read"
],
"audit_command": "grep -Hn 'gsap\\.to\\|gsap\\.from\\|\\.to(' src/animations/bookGrab.js | grep -v '//' | grep -Ei 'width|height|margin|padding|top:|left:|font'",
"expected_result": "no output (zero matches)",
"allowed_exception": "filter in CSS only (static, not animated)",
"validation": {
"command": "above audit_command",
"expect_output": "empty string"
},
"on_error": {
"action": "identify the offending property",
"replacement": "swap for GPU equivalent — e.g. top/left → y/x, width/height → scaleX/scaleY",
"then": "re-run audit until clean"
}
},
{
"task_id": "T10",
"name": "reduced_motion_fallback_check",
"description": "Verify the prefers-reduced-motion fallback in bookGrab.js still correctly bypasses ALL 6 phases (P0–P5) and only calls gsap.set(card, {opacity:0}).",
"order": 10,
"depends_on": [
"T09"
],
"required_tools": [
"file_read",
"reasoning"
],
"check": "Trace code path when prefersReducedMotion() returns true. Confirm no tween fires, onDone is called immediately.",
"validation": {
"command": "grep -A3 'prefersReducedMotion' src/animations/bookGrab.js",
"expect_output": "gsap.set and onDone call present inside the if block"
},
"on_error": "Add a guard: if (prefersReducedMotion()) { gsap.set(card, { opacity:0 }); gsap.killTweensOf(card); onDone?.(); return; }"
},
{
"task_id": "T11",
"name": "generate_final_diff_summary",
"description": "Produce a structured git-diff-style summary of every change made across all files. This is the deliverable the developer reviews before committing.",
"order": 11,
"depends_on": [
"T10"
],
"required_tools": [
"reasoning",
"file_read"
],
"output_format": {
"type": "json",
"schema": {
"files_changed": "array of { file, hunks_count, lines_added, lines_removed, summary }",
"config_keys_changed": "array of { key, from, to }",
"new_phases_added": "array of phase ids",
"physics_concepts_used": "array of strings",
"total_animation_duration_before": 2.05,
"total_animation_duration_after": "calculated from new phase windows"
}
},
"validation": {
"command": "agent confirms diff covers all 5 files in scope",
"expect_output": "5 files listed"
},
"on_error": "Re-read each file and re-generate the diff summary."
}
],
"tool_configuration": {
"file_read": {
"type": "filesystem",
"description": "Read source files from project root",
"base_path": "./src",
"permissions": "read-only",
"encoding": "utf-8",
"used_in_tasks": [
"T01",
"T03",
"T04",
"T05",
"T06",
"T07",
"T08",
"T09",
"T10",
"T11"
]
},
"file_write": {
"type": "filesystem",
"description": "Write patched files back to disk",
"base_path": "./src",
"permissions": "write",
"encoding": "utf-8",
"strategy": "always write to a staging path first, then rename to final path",
"staging_path": "./src/.antigravity-patch-staging/",
"used_in_tasks": [
"T03"
]
},
"str_replace": {
"type": "precision_edit",
"description": "Surgical in-place string replacement — never rewrites whole files",
"rules": [
"old_str must be unique in the file — verify uniqueness before replace",
"always read the file fresh before computing old_str",
"if old_str is not found, log it and fall back to file_write append"
],
"used_in_tasks": [
"T03",
"T04",
"T05",
"T06",
"T07",
"T08"
]
},
"bash": {
"type": "shell",
"description": "Run validation grep commands and audit scripts",
"allowed_commands": [
"grep",
"cat",
"wc",
"ls",
"echo",
"node -e"
],
"forbidden_commands": [
"rm",
"mv",
"chmod",
"curl",
"wget"
],
"cwd": "./",
"used_in_tasks": [
"T09"
]
},
"reasoning": {
"type": "internal_llm",
"description": "Agent's own reasoning — used for diff computation and code tracing (no external call)",
"used_in_tasks": [
"T02",
"T10",
"T11"
]
},
"web_search": {
"type": "search",
"description": "Look up GSAP API details if uncertain about syntax for elastic.out, back.out, or expo.in parameters",
"allowed_queries": [
"gsap elastic.out parameters site:gsap.com",
"gsap back.out overshoot value site:gsap.com",
"gsap expo.in ease formula site:gsap.com"
],
"used_in_tasks": [],
"trigger_condition": "only if agent is not confident about ease parameter syntax"
}
},
"expected_final_state": {
"total_phases": 6,
"phase_ids": [
"P0",
"P1",
"P2",
"P3",
"P4",
"P5"
],
"estimated_total_duration_seconds": 2.2,
"exit_direction": "top of viewport (negative y)",
"ambient_idle_animation": true,
"sibling_behavior": "two-step: float up then settle + gap close",
"3d_perspective": "900px (tighter, more dramatic vertical depth)",
"accessibility_fallback": "instant opacity:0, no tween fires",
"files_modified": [
"src/animations/bookGrab.config.js",
"src/animations/bookGrab.js",
"src/animations/bookGrab.css"
],
"files_unchanged": [
"src/components/BookCard.jsx",
"src/utils/motionUtils.js"
]
}
}
