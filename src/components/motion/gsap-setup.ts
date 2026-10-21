// gsap-setup.ts — registers GSAP plugins exactly once and exposes the
// shared luxe easing. No @gsap/react dependency: cleanup is done manually
// with gsap.context() + useEffect return ctx.revert().
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";

let registered = false;

/** Signature luxe easing, usable as `ease: EASE_LUXE`. */
export const EASE_LUXE = "luxe";

/** Idempotent: registers ScrollTrigger + CustomEase and creates the luxe ease. */
export function ensureGsap(): void {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create(EASE_LUXE, "0.16,1,0.3,1");
  registered = true;
}

export { gsap, ScrollTrigger };
