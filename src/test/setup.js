import '@testing-library/jest-dom/vitest';

// SEED HELPER for the Home-date follow (2026-10). Every module's Home date follows the device's local date (meta.dateDay = the day it was last set automatically). A test that seeds a
// *-meta-v* record with a fixed past date would see it jump to today the moment its module loads, so a NEW record written WITHOUT a dateDay is stamped "already followed today" here —
// it stays exactly as seeded (and, because a meta with dateDay is "already through the follow", the item-date backfill leaves that site's results alone). A record that was already
// stored keeps what it had, so the app re-saving an unstamped record (e.g. an old orphan) does not change it. Records the app writes already carry dateDay.
// The tests of the follow / the backfill themselves seed old-format data with rawSetItem (no stamp).
const localToday = () => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const realSetItem = Storage.prototype.setItem;
globalThis.rawSetItem = (key, value) => realSetItem.call(window.localStorage, key, value);
Storage.prototype.setItem = function (key, value) {
  if (typeof key === 'string' && /-meta-v\d+$/.test(key)) {
    try {
      const o = JSON.parse(value);
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const day = localToday(); let prev = {}; try { prev = JSON.parse(window.localStorage.getItem(key)) || {}; } catch (_) {}
        Object.keys(o).forEach(id => { if (o[id] && typeof o[id] === 'object' && o[id].dateDay === undefined) { if (!prev[id]) o[id].dateDay = day; else if (prev[id].dateDay !== undefined) o[id].dateDay = prev[id].dateDay; } });
        value = JSON.stringify(o);
      }
    } catch (_) { /* not JSON: stored as given */ }
  }
  return realSetItem.call(this, key, value);
};
