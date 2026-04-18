import gsap from "gsap";
import { GRAB_CONFIG as c } from "./bookGrab.config";
import { prefersReducedMotion } from "../utils/motionUtils";

export function grabBook(
  card: HTMLElement,
  siblings: HTMLElement[],
  onDone?: () => void
) {
  if (prefersReducedMotion() || c.A11Y_SKIP_PHASES.length === 6) {
    gsap.set(card, { opacity: c.A11Y_REDUCED_OPACITY_TARGET });
    gsap.killTweensOf(card);
    onDone?.();
    return;
  }

  // Calculate dynamic scale factor based on viewport (Mobile/Tablet/Desktop)
  const ww = window.innerWidth;
  const isMobile = ww <= c.BREAKPOINT_MOBILE_MAX;
  const isTablet = ww <= c.BREAKPOINT_TABLET_MAX && ww > c.BREAKPOINT_MOBILE_MAX;
  
  const scaleYFactor = isMobile ? c.MOBILE_Y_SCALE : isTablet ? c.TABLET_Y_SCALE : 1;
  const scaleXFactor = isMobile ? c.MOBILE_X_SCALE : isTablet ? c.TABLET_X_SCALE : 1;
  const durationFactor = isMobile ? c.MOBILE_DURATION_SCALE : isTablet ? c.TABLET_DURATION_SCALE : 1;

  // Kill ambient loop for grabbed card only
  gsap.killTweensOf(card);
  card.classList.add(c.CLASS_GRABBING);

  // Apply origin states
  gsap.set(card, {
    transformOrigin: c.LEVITATION_PULSE_TRANSFORM_ORIGIN,
    transformStyle: c.CARD_TRANSFORM_STYLE
  });

  const tl = gsap.timeline({
    defaults: { overwrite: c.TIMELINE_DEFAULTS_OVERWRITE },
    onComplete: () => {
      setTimeout(() => {
        card.style.willChange = 'auto'; // cleanup GPU optimization
      }, c.WILL_CHANGE_REMOVE_DELAY * 1000);
      onDone?.();
    }
  });

  tl.call(() => { 
    card.style.willChange = c.PINCH_WILL_CHANGE; 
    card.style.zIndex = '100'; // Target pops in front of everything

    // Cinematic dim scale on non-target siblings
    if (siblings.length > 0) {
      gsap.to(siblings, {
        opacity: c.GLOW_IDLE_OPACITY || 0.3,
        filter: 'blur(3px)',
        scale: 0.96,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  })
    // P0 — LevitationPulse
    .to(card, {
      x: c.LEVITATION_PULSE_X,
      y: c.LEVITATION_PULSE_Y,
      scale: c.LEVITATION_PULSE_SCALE,
      rotationZ: c.LEVITATION_PULSE_ROT_Z,
      duration: c.LEVITATION_PULSE_DURATION * durationFactor,
      ease: c.LEVITATION_PULSE_EASE,
      repeat: c.LEVITATION_PULSE_REPEAT,
      yoyo: c.LEVITATION_PULSE_YOYO,
    }, c.LEVITATION_PULSE_DELAY)
    
    // P1 — FloatLift
    .to(card, {
      transformOrigin: c.PINCH_TRANSFORM_ORIGIN,
      scaleY: c.PINCH_SCALE_Y,
      scaleX: c.PINCH_SCALE_X,
      y: c.PINCH_Y * scaleYFactor,
      z: c.PINCH_Z,
      rotationZ: c.PINCH_ROT_Z,
      rotationX: c.PINCH_ROT_X,
      duration: c.PINCH_DURATION * durationFactor,
      ease: c.PINCH_EASE,
      opacity: c.PINCH_OPACITY
    }, c.PHASE_OVERLAP_P0_P1)
    
    // P2 — GravityBreak
    .to(card, {
      transformOrigin: c.TILT_TRANSFORM_ORIGIN,
      rotationY: c.TILT_ROTATION_Y,
      rotationX: c.TILT_ROTATION_X,
      rotationZ: c.TILT_ROTATION_Z,
      scale: c.TILT_SCALE,
      y: c.TILT_Y * scaleYFactor,
      z: c.TILT_Z,
      duration: c.TILT_DURATION * durationFactor,
      ease: c.TILT_EASE,
      opacity: c.TILT_OPACITY
    }, c.PHASE_OVERLAP_P1_P2)
    
    // P3 — AscendArc
    .to(card, {
      transformOrigin: c.ARC_TRANSFORM_ORIGIN,
      x: c.ARC_X * scaleXFactor,
      y: c.ARC_Y * scaleYFactor,
      z: c.ARC_Z,
      rotationZ: c.ARC_ROT_Z,
      rotationX: c.ARC_ROT_X,
      rotationY: c.ARC_ROT_Y,
      scaleX: Math.min(c.ARC_SCALE_X, isMobile ? c.MOBILE_SCALE_MAX : 99),
      scaleY: Math.min(c.ARC_SCALE_Y, isMobile ? c.MOBILE_SCALE_MAX : 99),
      duration: c.ARC_DURATION * durationFactor,
      ease: c.ARC_EASE,
      opacity: c.ARC_OPACITY
    }, c.PHASE_OVERLAP_P2_P3)
    
    // P4 — VoidExit
    .to(card, {
      transformOrigin: c.EXIT_TRANSFORM_ORIGIN,
      x: c.EXIT_X * scaleXFactor,
      y: c.EXIT_Y * scaleYFactor,
      z: c.EXIT_Z,
      rotationZ: c.EXIT_ROT_Z,
      rotationX: c.EXIT_ROT_X,
      rotationY: c.EXIT_ROT_Y,
      scale: c.EXIT_SCALE,
      duration: c.EXIT_DURATION * durationFactor,
      ease: c.EXIT_EASE
    }, c.PHASE_OVERLAP_P3_P4)
    // Separate opacity schedule for P4
    .to(card, {
       opacity: c.EXIT_OPACITY,
       duration: c.EXIT_DURATION * durationFactor - c.EXIT_OPACITY_DELAY,
       ease: c.EXIT_OPACITY_EASE
    }, `+=${c.EXIT_OPACITY_DELAY}`);
    
  if (siblings.length > 0 && !c.A11Y_SIBLING_SHIFT_INSTANT) {
    // Determine closest siblings (index-based approximation for now)
    const maxSiblings = c.SIBLING_MAX_AFFECTED;
    const affectedSiblings = c.SIBLING_STAGGER_DIRECTION === 'start' ? siblings.slice(0, maxSiblings) : siblings;

    const getDecayScale = (index: number) => Math.pow(c.SIBLING_WAVE_DECAY, index);

    // P5a — Sibling float up
    tl.to(affectedSiblings, {
      y: (i) => c.SIBLING_FLOAT_Y * getDecayScale(i),
      scale: (i) => 1 + ((c.SIBLING_FLOAT_SCALE - 1) * getDecayScale(i)),
      rotationZ: (i) => c.SIBLING_FLOAT_ROT_Z * getDecayScale(i),
      duration: c.SIBLING_FLOAT_DURATION,
      ease: c.SIBLING_FLOAT_EASE,
      opacity: c.SIBLING_FLOAT_OPACITY,
      stagger: c.SIBLING_STAGGER,
    }, c.SIBLING_OVERLAP)
    // P5b — Sibling settle + gap close
    .to(affectedSiblings, {
      y: c.SIBLING_SETTLE_Y,
      x: c.SIBLING_SHIFT,
      scale: c.SIBLING_SETTLE_SCALE,
      rotationZ: c.SIBLING_SETTLE_ROT_Z,
      duration: c.SIBLING_SETTLE_DURATION,
      ease: c.SIBLING_SETTLE_EASE,
      stagger: c.SIBLING_STAGGER,
    });
  } else if (siblings.length > 0 && c.A11Y_SIBLING_SHIFT_INSTANT) {
    gsap.set(siblings, { x: c.SIBLING_SHIFT });
  }

  if (c.DEBUG_LOG_TIMELINE) {
    console.log(`[bookGrab] Timeline built. Est duration: ${c.TOTAL_DURATION_ESTIMATE}s`);
  }
}
