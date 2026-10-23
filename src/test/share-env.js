// Shared setup for the release t share tests. jsdom has no navigator.share, no matchMedia and no touch points, so a "phone" is built by hand: touch points above 0, a coarse primary pointer,
// navigator.share and navigator.canShare. Downloads are counted (URL.createObjectURL and the hidden link click are stubbed, nothing is written). FICTIONAL file names only.
import { vi } from 'vitest';

export const abortError = () => Object.assign(new Error('closed'), { name: 'AbortError' });
export const named = name => Object.assign(new Error('x'), { name });

// Makes this jsdom window behave like a phone (or, with other options, like another kind of computer). Returns the share mock. Call restore() (or phoneOff) in afterEach.
export function phoneOn({ share = vi.fn(async () => {}), canShare = () => true, touch = 5, coarse = true, hasShare = true, hasCanShare = true, hasMatchMedia = true } = {}) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true });
  if (hasShare) navigator.share = share; else delete navigator.share;
  if (hasCanShare) navigator.canShare = canShare; else delete navigator.canShare;
  if (hasMatchMedia) window.matchMedia = q => ({ matches: q === '(pointer: coarse)' ? coarse : false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); else delete window.matchMedia;
  return share;
}
export function phoneOff() { delete navigator.share; delete navigator.canShare; delete window.matchMedia; try { delete navigator.maxTouchPoints; } catch (_) {} delete window.webkit; }

// Counts the downloads: createObjectURL calls, hidden-link clicks (with the file name), revokes. failClick makes the click throw (the download itself fails).
export function downloadsOn({ failClick = false } = {}) {
  const d = { created: [], clicks: [], revoked: [] };
  URL.createObjectURL = b => { d.created.push(b); return 'blob:zq' + d.created.length; };
  URL.revokeObjectURL = u => { d.revoked.push(u); };
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { if (failClick) throw new Error('blocked'); d.clicks.push(this.download); });
  return d;
}
export const SAMPLE_B64 = 'QUJD';
