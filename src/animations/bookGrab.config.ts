export const GRAB_CONFIG = {
  // Phase 0: Pre-ignition levitation field
  LEVITATION_PULSE_X: 4,
  LEVITATION_PULSE_REPEAT: 3,
  LEVITATION_PULSE_DURATION: 0.06,
  LEVITATION_PULSE_EASE: "none",
  LEVITATION_PULSE_YOYO: true,

  // Phase 1 : Pinch and Lift (FloatLift in AntiGravity)
  PINCH_SCALE_Y: 0.94, // Compresses via buoyancy grip
  PINCH_Y: -40,
  PINCH_DURATION: 0.3,
  PINCH_EASE: "back.out(1.7)",

  // Phase 2 : Forward Tilt 3D (GravityBreak)
  TILT_ROTATION_Y: -22,
  TILT_ROTATION_X: 15,
  TILT_DURATION: 0.35,
  TILT_EASE: "sine.inOut",
  TILT_DELAY: 0.04,

  // Phase 3 : AscendArc
  ARC_X: 80,
  ARC_Y: -320,
  ARC_ROT_Z: 8,
  ARC_SCALE: 1.1,
  ARC_DURATION: 0.65,
  ARC_EASE: "power2.in",
  ARC_DELAY: 0.08,

  // Phase 4 : VoidExit
  EXIT_X: 80,
  EXIT_Y: -680,
  EXIT_ROT_Z: 18,
  EXIT_ROT_X: -20,
  EXIT_DURATION: 0.55,
  EXIT_EASE: "expo.in",
  EXIT_DELAY: 0.04,

  // Phase 5 : SiblingLevitationWave
  SIBLING_FLOAT_Y: -10,
  SIBLING_FLOAT_DURATION: 0.28,
  SIBLING_FLOAT_EASE: "power2.out",
  SIBLING_SETTLE_Y: 0,
  SIBLING_SETTLE_DURATION: 0.38,
  SIBLING_SETTLE_EASE: "elastic.out(1, 0.3)",
  SIBLING_SHIFT: -22,
  SIBLING_DURATION: 0.4,
  SIBLING_EASE: "power2.out",
  SIBLING_STAGGER: 0.05,
  SIBLING_OVERLAP: "-=0.45",

  // Rendering
  PERSPECTIVE: "900px",
  PERSPECTIVE_ORIGIN: "50% 80%",

  // Ambient Levitation Loop
  AMBIENT_FLOAT_Y: -5,
  AMBIENT_FLOAT_DURATION: 1.8,
  AMBIENT_FLOAT_EASE: "sine.inOut",
  AMBIENT_FLOAT_REPEAT: -1,
  AMBIENT_FLOAT_YOYO: true
};
