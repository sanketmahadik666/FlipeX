import gsap from "gsap";
import { GRAB_CONFIG as c } from "./bookGrab.config";
import { prefersReducedMotion } from "../utils/motionUtils";

export function grabBook(
  card: HTMLElement,
  siblings: HTMLElement[],
  onDone?: () => void
) {
  if (prefersReducedMotion()) {
    gsap.set(card, { opacity: 0 });
    gsap.killTweensOf(card);
    onDone?.();
    return;
  }

  // Kill ambient loop for grabbed card only
  gsap.killTweensOf(card);
  card.classList.add('is-grabbing');

  // GSAP 3.12+ Timeline setup
  const tl = gsap.timeline({
    onComplete: () => {
      card.style.willChange = 'auto'; // cleanup GPU optimization when done
      onDone?.();
    }
  });

  tl.call(() => { 
    card.style.willChange = 'transform, opacity'; 
    card.style.zIndex = '100'; // Target pops in front of everything

    // Cinematic dim scale on non-target siblings
    if (siblings.length > 0) {
      gsap.to(siblings, {
        opacity: 0.3,
        filter: 'blur(3px)',
        scale: 0.96,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  })
    // P0 — LevitationPulse (Pre-ignition field charge)
    .to(card, {
      x: c.LEVITATION_PULSE_X,
      duration: c.LEVITATION_PULSE_DURATION,
      ease: c.LEVITATION_PULSE_EASE,
      repeat: c.LEVITATION_PULSE_REPEAT,
      yoyo: c.LEVITATION_PULSE_YOYO,
    }, 'start')
    
    // P1 — FloatLift
    .to(card, {
      scaleY: c.PINCH_SCALE_Y,
      y: c.PINCH_Y,
      duration: c.PINCH_DURATION,
      ease: c.PINCH_EASE
    }, '+=0')
    
    // P2 — GravityBreak (Rotational escape)
    .to(card, {
      rotationY: c.TILT_ROTATION_Y,
      rotationX: c.TILT_ROTATION_X,
      duration: c.TILT_DURATION,
      ease: c.TILT_EASE
    }, `+=${c.TILT_DELAY}`)
    
    // P3 — AscendArc (Vertical escape velocity)
    .to(card, {
      x: c.ARC_X,
      y: c.ARC_Y,
      rotationZ: c.ARC_ROT_Z,
      scale: c.ARC_SCALE,
      duration: c.ARC_DURATION,
      ease: c.ARC_EASE
    }, `+=${c.ARC_DELAY}`)
    
    // P4 — VoidExit (Escape velocity achieved — exits top viewport)
    .to(card, {
      x: c.EXIT_X,
      y: c.EXIT_Y,
      opacity: 0,
      rotationZ: c.EXIT_ROT_Z,
      rotationX: c.EXIT_ROT_X,
      duration: c.EXIT_DURATION,
      ease: c.EXIT_EASE
    }, `+=${c.EXIT_DELAY}`);
    
  if (siblings.length > 0) {
    // P5a — Sibling float up (levitation pressure wave)
    tl.to(siblings, {
      y: c.SIBLING_FLOAT_Y,
      duration: c.SIBLING_FLOAT_DURATION,
      ease: c.SIBLING_FLOAT_EASE,
      stagger: c.SIBLING_STAGGER,
    }, c.SIBLING_OVERLAP)
    // P5b — Sibling settle + gap close
    .to(siblings, {
      y: c.SIBLING_SETTLE_Y,
      x: c.SIBLING_SHIFT,
      duration: c.SIBLING_SETTLE_DURATION,
      ease: c.SIBLING_SETTLE_EASE,
      stagger: c.SIBLING_STAGGER,
    });
  }
}
