{
"document": {
"title": "LOW-LEVEL DESIGN — Book Slot Grab Animation",
"subtitle": "Physics-Inspired GSAP 3 Timeline | Production Implementation Guide",
"version": "1.0.0",
"meta": {
"document_type": "LLD — Animation Subsystem",
"animation_engine": "GSAP v3.12+",
"target_fps": 60,
"trigger": "click on .book-card",
"total_duration_seconds": 1.95,
"gpu_transforms_only": true,
"requires_plugins": []
}
},
"sections": [
{
"id": "s1",
"title": "Overview & Goals",
"feature_description": "When a user clicks a book card inside #drawer .book-grid, the card is extracted from the bookshelf with a realistic physics-driven motion — grip resistance, 3D pivot, arc release, momentum carry, and adaptive slot refill.",
"design_objectives": [
"Simulate real-world book-grab ergonomics (static friction → kinetic release → inertia)",
"GPU-only transforms — no layout-thrashing (no width/height/top/left changes)",
"Safe to re-trigger: kill previous timeline before starting new one",
"Accessible: full no-animation fallback for prefers-reduced-motion",
"Framework-agnostic: plain JS module, works in React / Vue / Vanilla"
],
"scope": {
"in_scope": [
"click-triggered extraction",
"sibling reflow",
"DOM cleanup after exit"
],
"out_of_scope": [
"drag-and-drop",
"shelf reorder",
"keyboard-only navigation (future iterations)"
]
}
},
{
"id": "s2",
"title": "Physics & Mathematics Foundation",
"summary": "Each animation phase maps to a real physics concept. Understanding the math behind GSAP eases helps fine-tune feel without guesswork.",
"phases": [
{
"phase_id": "P1",
"name": "PinchAndLift",
"physics_concept": "Static Friction",
"formula": "Fs = μs · N",
"formula_variables": {
"μs": "static friction coefficient",
"N": "normal force (book weight)"
},
"css_model": {
"scaleY": 1.12,
"y": -12,
"unit": "px"
},
"gsap": {
"ease": "power1.in",
"ease_formula": "f(t) = t²",
"ease_type": "quadratic acceleration",
"duration": 0.25
},
"rationale": "power1.in is quadratic: the value accelerates from zero. Mimics how grip force builds before the object yields — slow at first, then sudden release.",
"timeline_window": {
"start": 0.0,
"end": 0.25
}
},
{
"phase_id": "P2",
"name": "ForwardTilt3D",
"physics_concept": "Rotational Torque",
"formula": "τ = r × F",
"formula_variables": {
"τ": "torque",
"r": "moment arm",
"F": "applied force"
},
"css_model": {
"rotationY": 28,
"unit": "deg",
"transformOrigin": "left center",
"pivot_description": "left spine edge — hinge point in slot"
},
"gsap": {
"ease": "sine.inOut",
"ease_formula": "f(t) = (1 - cos(πt)) / 2",
"ease_derivative": "f′(t) = π/2 · sin(πt)",
"duration": 0.4,
"delay_from_previous": 0.05
},
"rationale": "Symmetric ease — slow at both ends, maximum velocity at midpoint. Represents tipping motion where resistance is high at start and as the book clears the slot edge.",
"timeline_window": {
"start": 0.3,
"end": 0.7
}
},
{
"phase_id": "P3",
"name": "PullOutArc",
"physics_concept": "Projectile Arc & Kinetic Energy",
"formula": "x(t) = v₀·t·cos(θ), y(t) = v₀·t·sin(θ) - ½g·t²",
"css_model": {
"x": 320,
"y": -110,
"rotationZ": -15,
"rotationY": 0,
"scale": 1.18,
"unit_x_y": "px",
"unit_rotation": "deg",
"scale_note": "simulates book coming closer — depth perspective"
},
"gsap": {
"ease": "power3.out",
"ease_formula": "f(t) = 1 - (1-t)³",
"ease_derivative": "f′(t) = 3(1-t)²",
"duration": 0.7,
"delay_from_previous": 0.1
},
"rationale": "Cubic deceleration. Derivative starts at 3 (maximum velocity) and decays to 0. Gives the 'snap out then settle' feel of releasing something with wrist momentum.",
"timeline_window": {
"start": 0.8,
"end": 1.5
}
},
{
"phase_id": "P4",
"name": "ReleaseAndExit",
"physics_concept": "Momentum, Drag & Inertia",
"formula": "Fd = ½ · ρ · v² · Cd · A",
"formula_variables": {
"ρ": "fluid density",
"v": "velocity",
"Cd": "drag coefficient",
"A": "cross-sectional area"
},
"css_model": {
"x": 650,
"opacity": 0,
"rotationZ": -35,
"unit_x": "px",
"unit_rotation": "deg"
},
"gsap": {
"ease": "power4.out",
"ease_formula": "f(t) = 1 - (1-t)⁴",
"ease_derivative": "f′(t) = 4(1-t)³",
"duration": 0.5,
"delay_from_previous": 0.05
},
"rationale": "Very high initial velocity, extremely rapid deceleration. Models drag dominating after release — book exits viewport with aggressive momentum then halts.",
"timeline_window": {
"start": 1.55,
"end": 2.05
}
},
{
"phase_id": "P5",
"name": "SlotRefillPhysics",
"target": "siblings — all .book-card except active",
"physics_concept": "Spring-Damper Settlement (Hooke's Law)",
"formula": "F = -k · x",
"formula_variables": {
"k": "spring constant",
"x": "displacement from equilibrium"
},
"css_model": {
"x": "-=28",
"unit": "px",
"x_note": "relative shift — each sibling moves 28px leftward"
},
"gsap": {
"ease": "power2.out",
"ease_formula": "f(t) = 1 - (1-t)²",
"ease_derivative": "f′(t) = 2(1-t)",
"duration": 0.45,
"stagger": 0.04,
"stagger_note": "40ms wave propagation delay — simulates displacement pulse through adjacent spines",
"position": "-=0.50",
"position_note": "overlaps P4 by 0.5s — books shift while grabbed book is still mid-arc"
},
"rationale": "Damped oscillation with no overshoot. Stagger propagates like a domino wave, but driven by spring restoring force rather than impact.",
"timeline_window": {
"start": 1.55,
"end": 2.0
}
}
],
"ease_function_reference": [
{
"ease": "power1.in",
"formula": "t²",
"derivative": "2t",
"physical_meaning": "Grip force builds until yield"
},
{
"ease": "sine.inOut",
"formula": "(1−cos πt)/2",
"derivative": "π/2·sin(πt)",
"physical_meaning": "Smooth symmetric torque arc"
},
{
"ease": "power3.out",
"formula": "1−(1−t)³",
"derivative": "3(1−t)²",
"physical_meaning": "Snap-out, rapid decelerate"
},
{
"ease": "power4.out",
"formula": "1−(1−t)⁴",
"derivative": "4(1−t)³",
"physical_meaning": "Explosive start, heavy drag"
},
{
"ease": "power2.out",
"formula": "1−(1−t)²",
"derivative": "2(1−t)",
"physical_meaning": "Spring settle, no overshoot"
}
]
},
{
"id": "s3",
"title": "GSAP Timeline Architecture",
"timeline_defaults": {
"ease": "power2.inOut",
"kill_previous": true,
"active_ref_variable": "\_activeTimeline"
},
"position_parameter_map": [
{
"token": "'start'",
"resolves_to_seconds": 0.0,
"note": "absolute label"
},
{
"token": "'+=0.05'",
"resolves_to_seconds": 0.3,
"note": "0.25 (end of P1) + 0.05 = P2 start"
},
{
"token": "'+=0.10'",
"resolves_to_seconds": 0.8,
"note": "0.70 (end of P2) + 0.10 = P3 start"
},
{
"token": "'+=0.05'",
"resolves_to_seconds": 1.55,
"note": "1.50 (end of P3) + 0.05 = P4 start"
},
{
"token": "'-=0.50'",
"resolves_to_seconds": 1.55,
"note": "2.05 (end P4) - 0.50 = P5 overlaps P4 start"
}
],
"code_modules": {
"timeline_factory": "import { gsap } from 'gsap';\n\nlet activeTimeline = null;\n\nfunction createGrabTimeline(card, siblings) {\n if (activeTimeline) activeTimeline.kill();\n const tl = gsap.timeline({\n defaults: { ease: 'power2.inOut' },\n onComplete: () => removeAndRerender(card),\n });\n activeTimeline = tl;\n return tl;\n}",
"full_timeline": "function grabBook(card, siblings) {\n if (prefersReducedMotion()) { instantRemove(card); return; }\n const tl = createGrabTimeline(card, siblings);\n\n // P1\n tl.to(card, { scaleY: 1.12, y: -12, transformOrigin: 'top center', duration: 0.25, ease: 'power1.in' }, 'start')\n // P2\n .to(card, { rotationY: 28, transformOrigin: 'left center', duration: 0.40, ease: 'sine.inOut' }, '+=0.05')\n // P3\n .to(card, { x: 320, y: -110, rotationZ: -15, rotationY: 0, scale: 1.18, duration: 0.70, ease: 'power3.out' }, '+=0.10')\n // P4\n .to(card, { x: 650, opacity: 0, rotationZ: -35, duration: 0.50, ease: 'power4.out' }, '+=0.05')\n // P5\n .to(siblings, { x: '-=28', duration: 0.45, ease: 'power2.out', stagger: 0.04 }, '-=0.50');\n\n return tl;\n}"
}
},
{
"id": "s4",
"title": "CSS & 3D Rendering Configuration",
"container_css": {
"selector": "#drawer .book-grid",
"properties": {
"perspective": "1200px",
"perspective-origin": "50% 60%",
"transform-style": "preserve-3d",
"position": "relative",
"overflow": "visible"
},
"notes": {
"perspective": "Camera distance — lower value = more dramatic 3D effect",
"perspective-origin": "Viewer eye point",
"transform-style": "Must propagate 3D space to children",
"overflow": "Required to allow card to travel outside shelf bounds"
}
},
"book_card_css": {
"selector": ".book-card",
"properties": {
"transform-style": "preserve-3d",
"backface-visibility": "hidden",
"will-change": "auto",
"position": "relative",
"isolation": "isolate"
},
"notes": {
"backface-visibility": "Hides back face during rotationY — prevents ghost render",
"will-change": "Managed dynamically by animation module, not hardcoded",
"isolation": "Creates own stacking context"
}
},
"active_card_css": {
"selector": ".book-card.is-grabbing",
"properties": {
"z-index": 100,
"pointer-events": "none"
}
},
"gpu_only_properties": {
"rule": "Only animate transform and opacity. Never animate layout properties.",
"allowed": [
{
"css": "translateX(px)",
"gsap_shorthand": "x",
"example": "x: 320"
},
{
"css": "translateY(px)",
"gsap_shorthand": "y",
"example": "y: -110"
},
{
"css": "scaleX(n)",
"gsap_shorthand": "scaleX",
"example": "scaleX: 1.18"
},
{
"css": "scaleY(n)",
"gsap_shorthand": "scaleY",
"example": "scaleY: 1.12"
},
{
"css": "scale(n)",
"gsap_shorthand": "scale",
"example": "scale: 1.18"
},
{
"css": "rotateZ(deg)",
"gsap_shorthand": "rotationZ",
"example": "rotationZ: -35"
},
{
"css": "rotateY(deg)",
"gsap_shorthand": "rotationY",
"example": "rotationY: 28"
},
{
"css": "opacity",
"gsap_shorthand": "opacity",
"example": "opacity: 0"
}
],
"forbidden": [
"width",
"height",
"top",
"left",
"margin",
"padding",
"border-width",
"font-size"
]
},
"will_change_lifecycle": {
"set_before_animation": "card.style.willChange = 'transform, opacity'",
"remove_after_animation": "card.style.willChange = 'auto'",
"note": "Promotes GPU layer early; freeing after animation releases VRAM"
},
"transform_origin_per_phase": [
{
"phase": "P1 — PinchAndLift",
"value": "top center",
"reason": "Book elongates upward from its top, not downward"
},
{
"phase": "P2 — ForwardTilt3D",
"value": "left center",
"reason": "Rotates around left spine edge — hinge point in slot"
},
{
"phase": "P3-P4 — Arc & Exit",
"value": "center center",
"reason": "Default — free rotation around book's own center"
},
{
"phase": "Siblings P5",
"value": "center center",
"reason": "Default — simple x-translation, no rotation needed"
}
]
},
{
"id": "s5",
"title": "Component Architecture",
"module_structure": {
"src/animations/bookGrab.js": "Main animation module (export)",
"src/animations/bookGrab.css": "Required CSS for 3D setup",
"src/animations/bookGrab.config.js": "All tunable constants",
"src/components/BookCard.jsx": "React consumer component",
"src/utils/motionUtils.js": "prefers-reduced-motion helper"
},
"config": {
"file": "bookGrab.config.js",
"export": "GRAB_CONFIG",
"phase_1_pinch": {
"PINCH_SCALE_Y": 1.12,
"PINCH_Y": -12,
"PINCH_DURATION": 0.25,
"PINCH_EASE": "power1.in"
},
"phase_2_tilt": {
"TILT_ROTATION_Y": 28,
"TILT_DURATION": 0.4,
"TILT_EASE": "sine.inOut",
"TILT_DELAY": 0.05
},
"phase_3_arc": {
"ARC_X": 320,
"ARC_Y": -110,
"ARC_ROT_Z": -15,
"ARC_SCALE": 1.18,
"ARC_DURATION": 0.7,
"ARC_EASE": "power3.out",
"ARC_DELAY": 0.1
},
"phase_4_exit": {
"EXIT_X": 650,
"EXIT_ROT_Z": -35,
"EXIT_DURATION": 0.5,
"EXIT_EASE": "power4.out",
"EXIT_DELAY": 0.05
},
"phase_5_refill": {
"SIBLING_SHIFT": -28,
"SIBLING_DURATION": 0.45,
"SIBLING_EASE": "power2.out",
"SIBLING_STAGGER": 0.04,
"SIBLING_OVERLAP": "-=0.50"
},
"rendering_3d": {
"PERSPECTIVE": "1200px",
"PERSPECTIVE_ORIGIN": "50% 60%"
}
},
"modules": {
"bookGrab_js": {
"exports": [
"grabBook"
],
"signature": "grabBook(card: HTMLElement, siblings: HTMLElement[], onDone: Function): void",
"responsibilities": [
"Checks prefers-reduced-motion and falls back to instant remove",
"Kills any existing _activeTimeline before starting",
"Adds .is-grabbing class to elevate z-index and block pointer events",
"Manages will-change lifecycle (set before, clear in onComplete)",
"Runs the 5-phase GSAP timeline",
"Calls onDone callback after completion for DOM cleanup"
]
},
"motionUtils_js": {
"exports": [
"prefersReducedMotion",
"onReducedMotionChange"
],
"code": "const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');\nexport function prefersReducedMotion() { return mql?.matches ?? false; }\nexport function onReducedMotionChange(cb) {\n mql?.addEventListener('change', cb);\n return () => mql?.removeEventListener('change', cb);\n}"
}
}
},
{
"id": "s6",
"title": "Framework Integration",
"react": {
"file": "BookCard.jsx",
"hooks_used": [
"useRef",
"useCallback"
],
"pattern": "cardRef passed to grabBook; onRemove triggers state update to re-render shelf",
"code": "export function BookCard({ book, allCards, onRemove }) {\n const cardRef = useRef(null);\n const handleClick = useCallback(() => {\n const siblings = allCards.filter(c => c !== cardRef.current);\n grabBook(cardRef.current, siblings, () => onRemove(book.id));\n }, [allCards, book.id, onRemove]);\n return <div ref={cardRef} className='book-card' onClick={handleClick}>{book.title}</div>;\n}"
},
"vanilla_js": {
"pattern": "querySelectorAll on container, addEventListener on each card",
"code": "function initShelf(shelfEl) {\n const cards = [...shelfEl.querySelectorAll('.book-card')];\n cards.forEach(card => {\n card.addEventListener('click', () => {\n const siblings = cards.filter(c => c !== card);\n grabBook(card, siblings, () => {\n card.remove();\n gsap.set(siblings, { x: 0 });\n });\n });\n });\n}\ndocument.querySelectorAll('#drawer .book-grid').forEach(initShelf);"
}
},
{
"id": "s7",
"title": "Timeline Diagram — Phase Overlap Visualization",
"playhead_seconds_total": 2.05,
"phases_on_playhead": [
{
"phase": "P1 PinchAndLift",
"start": 0.0,
"end": 0.25,
"overlap_with": null
},
{
"phase": "P2 ForwardTilt3D",
"start": 0.3,
"end": 0.7,
"overlap_with": null
},
{
"phase": "P3 PullOutArc",
"start": 0.8,
"end": 1.5,
"overlap_with": null
},
{
"phase": "P4 ReleaseAndExit",
"start": 1.55,
"end": 2.05,
"overlap_with": "P5"
},
{
"phase": "P5 SlotRefillPhysics",
"start": 1.55,
"end": 2.0,
"overlap_with": "P4"
}
]
},
{
"id": "s8",
"title": "Performance Checklist",
"target_metrics": {
"fps": 60,
"platform": "mid-tier mobile",
"layout_reflow": false,
"paint_outside_layer": false,
"memory_freed_after_animation": true
},
"preflight_checks": [
"Only animate transform and opacity — verified in config",
"perspective set on container, not on card itself",
"will-change: transform, opacity set before tween starts, removed on onComplete",
"transform-style: preserve-3d on both container and each card",
"backface-visibility: hidden prevents ghost render during rotationY",
"overflow: visible on container — allows card to exit bounds",
"z-index: 100 on .is-grabbing — prevents sibling clipping",
"activeTimeline.kill() called before new timeline starts"
],
"common_pitfalls": [
{
"problem": "3D tilt looks flat",
"cause": "perspective missing on parent",
"fix": "Add perspective: 1200px to .book-grid container"
},
{
"problem": "Book clips under siblings during arc",
"cause": "z-index not set on active card",
"fix": "Add z-index: 100 to .is-grabbing class"
},
{
"problem": "Siblings jump instead of stagger",
"cause": "stagger not passed to .to(siblings,...)",
"fix": "Confirm stagger: 0.04 in P5 config"
},
{
"problem": "Animation replays on DOM re-render",
"cause": "activeTimeline.kill() not called before rebuild",
"fix": "Kill before rebuilding DOM"
},
{
"problem": "Janky at 30fps on mobile",
"cause": "will-change not set, or non-GPU properties animated",
"fix": "Audit GRAB_CONFIG for forbidden properties"
},
{
"problem": "rotationY has no effect",
"cause": "transform-style: preserve-3d missing on card or parent",
"fix": "Apply transform-style: preserve-3d to both container and .book-card"
},
{
"problem": "Book flickers at end",
"cause": "backface-visibility not set",
"fix": "Add backface-visibility: hidden to .book-card"
},
{
"problem": "onComplete fires too early",
"cause": "DOM removal inside onComplete removes sibling nodes mid-P5",
"fix": "Defer DOM removal to after P5 fully completes"
}
]
},
{
"id": "s9",
"title": "Installation",
"cdn": {
"url": "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js",
"html_tag": "<script src=\"https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js\"></script>"
},
"npm": {
"install_command": "npm install gsap",
"import_statement": "import { gsap } from 'gsap';"
},
"plugins_required": [],
"core_bundle_eases_included": [
"power1",
"power2",
"power3",
"power4",
"sine"
]
}
],
"appendices": [
{
"id": "appendix_a",
"title": "Quick Ease Tuning Guide",
"tuning_table": [
{
"symptom": "P1 too sudden / not grippy",
"fix": "Increase PINCH_DURATION to 0.35, switch to 'power2.in'"
},
{
"symptom": "P2 tilt too dramatic",
"fix": "Reduce TILT_ROTATION_Y from 28 to 18–20"
},
{
"symptom": "P3 arc too fast / floaty",
"fix": "Reduce ARC_X to 200, change ease to 'power2.out'"
},
{
"symptom": "Exit too abrupt",
"fix": "Increase EXIT_DURATION to 0.65, use 'power3.out'"
},
{
"symptom": "Siblings shift too far",
"fix": "Reduce SIBLING_SHIFT from -28 to -18"
},
{
"symptom": "Siblings stagger feels like domino",
"fix": "Reduce SIBLING_STAGGER from 0.04 to 0.02"
},
{
"symptom": "Overall too fast",
"fix": "Multiply all durations by 1.2 — edit GRAB_CONFIG centrally"
}
]
},
{
"id": "appendix_b",
"title": "GSAP Reference Links",
"links": {
"cheatsheet": "https://gsap.com/cheatsheet/",
"ease_visualizer": "https://gsap.com/docs/v3/Eases/",
"timeline_api": "https://gsap.com/docs/v3/GSAP/gsap.timeline()/",
"performance": "https://gsap.com/resources/"
}
}
]
}
