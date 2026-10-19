// THE BACKUP AND RESTORE SECTION (Round d). FICTIONAL data. The component is mounted with the REAL engine (fake IndexedDB) wherever possible; only the share sheet, the document, the size of a "large" backup, a slow restore and
// the reload are injected. Every state in the approved mockups is reached; the rules are proved: two-step confirms (no window.confirm / alert / prompt), words never colour alone, 4.5:1 contrast, 44 px buttons, the built backup
// dropped when you leave, the share sheet called inside the tap, the Modules pill rule, no technical words on screen and the technical text only in the log.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within, configure, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupRestoreSection, GlobalSettingsView, BACKUP_UI, backupDeliver, backupBuild, backupUndoConfirmText, backupUndoInfo, backupUndo, backupLastBackupText, backupLargeWarning, backupRestore, BACKUP_LARGE_BYTES, RESTORE_KEY, BACKUP_LAST_KEY, zipWriter } from './App.jsx';
import { lsSnapshot, idbSnapshot, seedPhone, seedModule, FM, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const MB = 1024 * 1024;
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const newGate = () => ({ current: { busy: false, reloadPending: false, reveal: null, reload: null } });
const fakeDownload = () => { const clicks = []; const doc = { createElement: () => { const a = { click() { clicks.push({ href: a.href, download: a.download }); } }; return a; }, body: { appendChild() {}, removeChild() {} } }; return { doc, urlApi: { createObjectURL: b => 'blob:fake/' + b.size, revokeObjectURL() {} }, clicks }; };
// The test setup wraps Storage.prototype.setItem (stamps dateDay on meta), so the engine is given the raw-writing adapter S, exactly as the engine tests do. The app itself passes no deps.
const deps = (over = {}) => ({ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), lastText: () => backupLastBackupText(S, NOW), ...over });
const shareDeps = (nav, over = {}) => { const dl = fakeDownload(); return deps({ deliver: (b, f, o) => backupDeliver(b, f, { ...o, nav, doc: dl.doc, urlApi: dl.urlApi }), ...over }); };
const mount = (d = deps(), gate = newGate()) => { const user = userEvent.setup(); const r = render(<BackupRestoreSection gate={gate} deps={d} />); return { user, gate, ...r }; };
const text = () => screen.getByTestId('backup-section').textContent;
const T = id => screen.getByTestId(id);
const fileOf = (blob, name = 'SparkCheck-backup-2026-10-05.zip') => new File([blob], name, { type: 'application/zip' });
const upload = async (user, blob) => { await user.upload(screen.getByTestId('backup-file-input'), fileOf(blob)); };
const target = async () => { seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('cal-events-v1', JSON.stringify([{ id: 'eL', type: 'TAT', site: 'Local Site', dueDate: '2026-11-11' }])); };
let warn;
beforeEach(async () => { await wipe(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('idle', () => {
  it('the intro, the client names / ABN / photos warning under Make backup, Last backup: never, the photos box ticked, Make backup, Choose backup file; no cards, no Undo', () => {
    mount();
    expect(text()).toContain('Save a copy of your sites, results, History, calendar events, photos, logos, business details, lists and settings.'); expect(text()).toContain('Adds what is in a backup file and is not already on this phone. If a site here differs from the backup\x27s version, the backup\x27s version is added as a separate copy and the site on this phone is not changed.'); expect(text()).toContain('Creates one file. Then tap Share backup to save it. The file includes client names, ABNs, licence numbers, logos and photos, so store it somewhere safe.');
    expect(T('backup-last').textContent).toBe('Last backup: never'); expect(screen.getByLabelText(/Include photos/)).toBeChecked(); expect(T('backup-make').textContent).toBe('Make backup'); expect(T('backup-choose').textContent).toBe('Choose backup file…');
    expect(screen.queryAllByRole('alert')).toEqual([]); expect(screen.queryAllByRole('status')).toEqual([]); expect(screen.queryByText('Undo')).toBeNull(); expect(screen.queryByTestId('backup-problem')).toBeNull();
  });
  it('the file picker offers .zip files and is labelled', () => { mount(); const i = T('backup-file-input'); expect(i.getAttribute('accept')).toMatch(/\.zip/); expect(i.getAttribute('aria-label')).toBe('Choose backup file'); });
});

describe('making a backup', () => {
  it('Make backup -> Backup ready (size, file name, "not saved yet") with Share backup and Discard; Last backup is unchanged until it is shared', async () => {
    await seedSourceFull(); const { user } = mount(); await user.click(T('backup-make'));
    const card = await screen.findByTestId('backup-card-ready'); expect(card.textContent).toContain('Backup ready, under 1 MB'); expect(card.textContent).toContain('SparkCheck-backup-2026-10-09.zip'); expect(card.textContent).toContain('Not saved yet. Tap Share backup, then choose Save to Files or another location.');
    expect(T('backup-share').textContent).toBe('Share backup'); expect(T('backup-discard').textContent).toBe('Discard this backup'); expect(T('backup-last').textContent).toBe('Last backup: never');
  });
  it('the progress shows the size and disables the button, in words', async () => {
    let release; const d = deps({ measure: async () => ({ estimatedBytes: 42 * MB }), inspect: async () => ({ ok: true }), build: () => new Promise(r => { release = () => r({ blob: new Blob(['x']), filename: 'f.zip' }); }) }); const { user } = mount(d); await user.click(T('backup-make'));
    await screen.findByText('Making your backup, about 42 MB. Keep this screen open.'); expect(T('backup-make')).toBeDisabled(); expect(T('backup-make').getAttribute('aria-disabled')).toBe('true'); release(); await screen.findByTestId('backup-card-ready');
  });
  it('unticking "Include photos" makes the small file (no photo records in it) ', async () => {
    await seedSourceFull(); const build = vi.fn(backupBuild); const { user } = mount(deps({ build })); await user.click(screen.getByLabelText(/Include photos/)); expect(screen.getByLabelText(/Include photos/)).not.toBeChecked(); await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready');
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ includePhotos: false }));
  });
  it('a failure while making: a plain card and Try again; the technical reason goes to the log only', async () => {
    const { user } = mount(deps({ build: async () => { throw new Error('disk error'); } })); await user.click(T('backup-make'));
    const card = await screen.findByTestId('backup-card-err'); expect(card.textContent).toBe('The backup could not be madeNothing was changed. Please try again.'); expect(card.getAttribute('role')).toBe('alert');
    expect(warn).toHaveBeenCalledWith('[SparkCheck backup]', 'build-failed', 'Error'); await user.click(T('backup-retry')); expect(T('backup-make')).toBeEnabled();
  });
});

describe('the large-file warning (100 MB)', () => {
  const sized = (withPhotos, withoutPhotos) => deps({ measure: vi.fn(async ({ includePhotos }) => ({ estimatedBytes: includePhotos ? withPhotos : withoutPhotos })), inspect: async () => ({ ok: true }), build: vi.fn(async () => ({ blob: new Blob(['x']), filename: 'f.zip' })) });
  it('at exactly 100 MB: the warning (the engine\'s exact text) and the two choices; nothing is built yet', async () => {
    const d = sized(BACKUP_LARGE_BYTES, 4 * MB); const { user } = mount(d); await user.click(T('backup-make')); const card = await screen.findByTestId('backup-card-large');
    expect(card.textContent).toBe('This is a large backup' + backupLargeWarning(BACKUP_LARGE_BYTES, { includesPhotos: true })); expect(T('backup-make-small').textContent).toBe('Make it without photos (about 4.0 MB)'); expect(T('backup-make-big').textContent).toBe('Continue with photos (100 MB)'); expect(d.build).not.toHaveBeenCalled();
  });
  it('one byte under 100 MB: no warning, it is built straight away', async () => { const d = sized(BACKUP_LARGE_BYTES - 1, 4 * MB); const { user } = mount(d); await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready'); expect(screen.queryByTestId('backup-card-large')).toBeNull(); expect(d.build).toHaveBeenCalledTimes(1); });
  it('"Make it without photos" builds the small file and unticks the box; "Continue with photos" builds the full one', async () => {
    let d = sized(120 * MB, 4 * MB); let { user, unmount } = mount(d); await user.click(T('backup-make')); await user.click(await screen.findByTestId('backup-make-small')); await screen.findByTestId('backup-card-ready');
    expect(d.build).toHaveBeenCalledWith(expect.objectContaining({ includePhotos: false })); unmount(); cleanup();
    d = sized(120 * MB, 4 * MB); ({ user } = mount(d)); await user.click(T('backup-make')); await user.click(await screen.findByTestId('backup-make-big')); await screen.findByTestId('backup-card-ready'); expect(d.build).toHaveBeenCalledWith(expect.objectContaining({ includePhotos: true }));
  });
  it('already without photos and still large: it says so and offers just Make backup', async () => {
    const d = sized(120 * MB, 120 * MB); const { user } = mount(d); await user.click(screen.getByLabelText(/Include photos/)); await user.click(T('backup-make')); const card = await screen.findByTestId('backup-card-large');
    expect(card.textContent).toContain('already without photos'); expect(screen.queryByTestId('backup-make-small')).toBeNull(); await user.click(T('backup-make-big')); await screen.findByTestId('backup-card-ready');
  });
});

describe('sharing: the share sheet first, the download as the fallback', () => {
  const ready = async (d) => { await seedSourceFull(); const m = mount(d); await m.user.click(T('backup-make')); await screen.findByTestId('backup-card-ready'); return m; };
  it('Share backup hands THE FILE to the share sheet, then: "Backup shared", Last backup: today with the time, the built file dropped (Make another backup)', async () => {
    const share = vi.fn(async () => {}); const { user } = await ready(shareDeps({ canShare: () => true, share })); await user.click(T('backup-share'));
    await screen.findByTestId('backup-note-ok'); expect(share).toHaveBeenCalledTimes(1); expect(share.mock.calls[0][0].files[0].name).toBe('SparkCheck-backup-2026-10-09.zip'); expect(T('backup-note-ok').textContent).toBe('Backup sharedIf you chose Save to Files, it is in the folder you picked.');
    await waitFor(() => expect(T('backup-last').textContent).toBe('Last backup: today, 12:00 pm')); expect(screen.queryByTestId('backup-share')).toBeNull(); expect(T('backup-make').textContent).toBe('Make another backup'); expect(JSON.parse(localStorage.getItem(BACKUP_LAST_KEY))).toMatchObject({ method: 'share' });
  });
  it('the share sheet is called INSIDE the tap: synchronously, before anything is awaited', async () => {
    const deliver = vi.fn(() => new Promise(() => {})); await ready(deps({ deliver })); fireEvent.click(T('backup-share')); expect(deliver).toHaveBeenCalledTimes(1);
  });
  it('the share sheet closed: an info card, nothing recorded, the backup stays ready to try again', async () => {
    const { user } = await ready(shareDeps({ canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } })); await user.click(T('backup-share'));
    const n = await screen.findByTestId('backup-note-info'); expect(n.textContent).toBe('The share sheet was closed, so no backup was saved.Your backup is still ready. Tap Share backup to try again.'); expect(T('backup-share')).toBeEnabled(); expect(T('backup-last').textContent).toBe('Last backup: never'); expect(localStorage.getItem(BACKUP_LAST_KEY)).toBeNull();
  });
  it('no share sheet: a download; "Backup download started", "This phone ...", "Find it in the Files app." and the file name', async () => {
    const { user } = await ready(shareDeps({})); await user.click(T('backup-share')); const n = await screen.findByTestId('backup-note-info');
    expect(n.textContent).toBe('Backup download startedThis phone could not open the share sheet, so the backup was downloaded. Find it in the Files app.SparkCheck-backup-2026-10-09.zip'); await waitFor(() => expect(T('backup-last').textContent).toBe('Last backup: today, 12:00 pm')); expect(JSON.parse(localStorage.getItem(BACKUP_LAST_KEY))).toMatchObject({ method: 'download' });
  });
  it('the date could not be recorded: the file is saved, a warning says what that means', async () => {
    const real = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { if (k === BACKUP_LAST_KEY) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); return real.call(this, k, v); });
    const { user } = await ready(shareDeps({ canShare: () => true, share: async () => {} })); await user.click(T('backup-share')); const w = await screen.findByTestId('backup-note-warn');
    expect(w.textContent).toBe('Backup saved, but the date could not be recordedYour backup is fine, but this phone has no room to record today\'s date, so "Last backup" may show an older one. See Storage above.'); expect(screen.getByTestId('backup-note-ok')).toBeTruthy();
  });
  it('both the share and the download fail: a plain error card; the backup stays ready; the technical text goes to the log', async () => {
    const dl = fakeDownload(); dl.urlApi.createObjectURL = () => { throw new Error('no memory'); }; const d = deps({ deliver: (b, f, o) => backupDeliver(b, f, { ...o, nav: {}, doc: dl.doc, urlApi: dl.urlApi }) }); const { user } = await ready(d); await user.click(T('backup-share'));
    const n = await screen.findByTestId('backup-note-err'); expect(n.textContent).toBe('The backup could not be savedNothing was recorded as saved. Please try again.'); expect(n.getAttribute('role')).toBe('alert'); expect(T('backup-share')).toBeEnabled();
    expect(warn.mock.calls.some(c => c[1] === 'share-failed' && /detail withheld/.test(c[2]) && !/no memory/.test(c[2]))).toBe(true); expect(localStorage.getItem(BACKUP_LAST_KEY)).toBeNull();
  });
  it('a share that throws or a promise that rejects: the same plain error', async () => { const { user } = await ready(deps({ deliver: () => Promise.reject(new Error('boom')) })); await user.click(T('backup-share')); expect((await screen.findByTestId('backup-note-err')).textContent).toContain('The backup could not be saved'); });
  it('Discard drops the built file at once', async () => { const { user } = await ready(shareDeps({ canShare: () => true, share: async () => {} })); await user.click(T('backup-discard')); expect(screen.queryByTestId('backup-card-ready')).toBeNull(); expect(screen.queryByTestId('backup-share')).toBeNull(); expect(T('backup-make')).toBeEnabled(); });
  it('LEAVING SETTINGS drops it: unmount, mount again -> idle, no ready card, no Share button, and the share sheet is never reachable', async () => {
    const share = vi.fn(); const d = shareDeps({ canShare: () => true, share }); const m = await ready(d); m.unmount(); cleanup(); mount(d); expect(screen.queryByTestId('backup-card-ready')).toBeNull(); expect(screen.queryByTestId('backup-share')).toBeNull(); expect(share).not.toHaveBeenCalled();
  });
});

describe('restoring a file', () => {
  it('Choose file -> checking -> the summary (added / already here / not restored), and NOTHING changes on the phone until the second tap', async () => {
    const file = await backupOf(seedSourceFull); await target(); const before = { ls: lsSnapshot(), idb: await idbSnapshot() }; const { user } = mount(deps({ plan: (f, o) => import('./App.jsx').then(m => m.backupPlan(f, { ...o, estimate: async () => ({ quota: 1e9, usage: 0 }) })) }));
    await upload(user, file); const card = await screen.findByTestId('backup-summary'); const t = card.textContent;
    expect(t).toMatch(/^This backup, made \d{2}\/\d{2}\/\d{4} \(under 1 MB\)/); expect(t).toContain('✓ Will be added'); expect(t).toContain('11 sites, 11 History snapshots, 2 calendar events, 3 photos and 1 logo');
    expect(t).toContain('and 1 more'); expect(t).toContain('There is enough free space.'); expect(t).not.toContain('Nothing already on this phone is changed or deleted.'); expect(T('backup-restore').textContent).toBe('Restore…');      // the add-only sentence is stated ONCE, in the restore question (pinned below)
    expect({ ls: lsSnapshot(), idb: await idbSnapshot() }).toEqual(before);
  });
  it('Restore… opens the inline two-step IN PLACE (no pop-up); "Cancel" closes it and nothing changed; "Yes, add them" restores', async () => {
    const file = await backupOf(seedSourceFull); await target(); const before = { ls: lsSnapshot(), idb: await idbSnapshot() }; const confirm = vi.spyOn(window, 'confirm'); const { user } = mount();
    await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); const box = T('backup-restore-confirm');
    expect(box.textContent).toContain('Add these to this phone? Nothing you have already set here is changed or removed. Keep this screen open while it works.'); expect(within(box).getByText('Yes, add them')).toBeTruthy(); expect(within(box).getByText('Cancel')).toBeTruthy();
    await user.click(T('backup-restore-confirm-no')); expect(screen.queryByTestId('backup-restore-confirm')).toBeNull(); expect(T('backup-restore')).toBeTruthy(); expect({ ls: lsSnapshot(), idb: await idbSnapshot() }).toEqual(before);
    await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); const ok = await screen.findByTestId('backup-result-ok');
    expect(ok.textContent).toMatch(/^Restore completeAdded: 11 sites and 11 History snapshots, 2 calendar events, 3 photos and 1 logo\.\d+ already on this phone, left as they are\.You can undo this until \d{2}\/\d{2}\/\d{4}\.$|^Restore completeAdded: .*You can undo this until/);
    expect(JSON.parse(localStorage.getItem('swb-projects-v1')).map(p => p.id)).toEqual(['local', 's1', 's2']); expect(confirm).not.toHaveBeenCalled();
  });
  it('an outside tap collapses the two-step', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(); await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); T('backup-restore-confirm'); await user.click(T('backup-last')); await waitFor(() => expect(screen.queryByTestId('backup-restore-confirm')).toBeNull());
  });
  it('the progress line follows the engine ("photos 3 of 6"), the pill gate is held while it runs and released after', async () => {
    const file = await backupOf(seedSourceFull); const gate = newGate(); let finish; const d = deps({ restore: (f, o) => { o.onProgress({ phase: 'photos', done: 3, total: 6 }); return new Promise(r => { finish = async () => r(await backupRestore(f, { ...o, storage: S })); }); } }); const { user } = mount(d, gate);
    await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes'));
    await screen.findByText('Restoring… photos 3 of 6.'); expect(text()).toContain('Keep this screen open. If the app closes, everything is put back the next time you open it.'); expect(gate.current.busy).toBe(true); expect(T('backup-restore')).toBeDisabled(); expect(T('backup-make')).toBeDisabled();
    await act(async () => { await finish(); }); await screen.findByTestId('backup-result-ok'); expect(gate.current.busy).toBe(false); expect(gate.current.reloadPending).toBe(true);
  });
  it('Done reloads the app; before that, nothing reloads', async () => {
    const file = await backupOf(seedSourceFull); const d = deps(); const { user } = mount(d); await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok');
    expect(d.reload).not.toHaveBeenCalled(); await user.click(T('backup-done')); expect(d.reload).toHaveBeenCalledTimes(1);
  });
  it('the summary leaves out the file and the plan once the restore is done (dropped)', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(); await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok'); expect(screen.queryByTestId('backup-summary')).toBeNull();
  });
});

describe('refusals and failures: short plain sentences, the technical text in the log', () => {
  const zipBlob = (entries) => { const w = zipWriter(new Date(2026, 9, 5, 12)); entries.forEach(([n, b]) => w.add(n, new TextEncoder().encode(b))); return w.finish(); };
  const expectCard = async (kind, title, body) => { const c = await screen.findByTestId('backup-result-' + kind); expect(c.textContent).toBe(title + body); expect(c.getAttribute('role')).toBe(kind === 'err' ? 'alert' : 'status'); return c; };
  it('not a SparkCheck file', async () => { const { user } = mount(); await upload(user, new Blob([new Uint8Array(500)])); await expectCard('err', 'This file cannot be restored', 'This is not a SparkCheck backup file, or it is incomplete.'); expect(warn.mock.calls.some(c => c[1] === 'not-a-backup')).toBe(true); expect(screen.queryByTestId('backup-restore')).toBeNull(); });
  it('made by a newer version', async () => { const { user } = mount(); await upload(user, zipBlob([['manifest.json', JSON.stringify({ format: 'sparkcheck-backup', formatVersion: 2 })]])); await expectCard('err', 'This file cannot be restored', 'This backup was made by a newer version of SparkCheck. Update the app, then try again.'); });
  it('nothing to add (an info card, not an error) with "Choose a different file"', async () => { await seedSourceFull(); const { backupBuild: bb } = await import('./App.jsx'); const { blob } = await bb(); const { user } = mount(); await upload(user, blob); await expectCard('info', 'Nothing to add', 'Everything in this backup is already on this phone or already set here.'); expect(T('backup-ok').textContent).toBe('Choose a different file'); });
  it('not enough room: the numbers from the device', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(deps({ plan: (f, o) => import('./App.jsx').then(m => m.backupPlan(f, { ...o, estimate: async () => ({ quota: 30 * MB, usage: 29 * MB }) })) })); await upload(user, file);
    const c = await screen.findByTestId('backup-result-err'); expect(c.textContent).toMatch(/^Not enough roomThere is not enough free space for the photos\. About \d+(\.\d)? MB is needed and 1\.0 MB is free\. Free up some space, then try again\. Nothing was changed\.$/);
  });
  it('a restore that fails part-way: "did not finish ... put back exactly"; the engine\'s own text is only in the log', async () => {
    const file = await backupOf(seedSourceFull); await target(); const before = { ls: lsSnapshot(), idb: await idbSnapshot() }; let c = 0; const orig = IDBObjectStore.prototype.put; vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...a) { if (++c === 3) throw new Error('disk error'); return orig.apply(this, a); });
    const { user } = mount(); await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes'));
    await expectCard('err', 'The restore did not finish', 'Everything was put back exactly as it was.'); expect(warn.mock.calls.some(x => x[1] === 'failed' && /detail withheld/.test(x[2]) && !/disk error/.test(x[2]))).toBe(true); vi.restoreAllMocks(); expect({ ls: lsSnapshot(), idb: await idbSnapshot() }).toEqual(before);
    expect(screen.queryByTestId('backup-done')).toBeNull(); await user.click(T('backup-ok')); expect(T('backup-choose')).toBeEnabled();
  });
  it('nothing on screen after any failure contains a technical word', async () => {
    const { user } = mount(); await upload(user, new Blob([new Uint8Array(500)])); await screen.findByTestId('backup-result-err'); expect(text()).not.toMatch(/zip|format|checksum|stored correctly|json|-v\d|projects|manifest|\.bin/i);
  });
});

describe('undo', () => {
  const restored = async () => { const file = await backupOf(seedSourceFull); await target(); await backupRestore(file, { storage: S, now: NOW }); };
  it('offered after a restore with the exact "Last restore" line; not offered when there is no restore', async () => {
    mount(); expect(screen.queryByTestId('backup-undo-open')).toBeNull(); cleanup(); await restored(); mount();
    expect(text()).toContain('Last restore: 11 sites, 11 History snapshots, 2 calendar events and 3 photos added on 09/10/2026. Undo is available until 23/10/2026.'); expect(T('backup-undo-open').textContent).toBe('Undo last restore…');
  });
  it('the confirm is the inline two-step with backupUndoConfirmText UNCHANGED, word for word; "No, keep them" changes nothing; "Yes, undo" removes exactly what was added', async () => {
    await restored(); const info = backupUndoInfo(S, NOW); const before = { ls: lsSnapshot(), idb: await idbSnapshot() }; const { user } = mount(); await user.click(T('backup-undo-open')); const box = T('backup-undo-confirm');
    expect(box.firstElementChild.textContent).toBe(backupUndoConfirmText(info)); expect(box.textContent).toContain('and any work you have done in them since'); expect(within(box).getByText('No, keep them')).toBeTruthy();
    await user.click(T('backup-undo-confirm-no')); expect(screen.queryByTestId('backup-undo-confirm')).toBeNull(); expect({ ls: lsSnapshot(), idb: await idbSnapshot() }).toEqual(before);
    await user.click(T('backup-undo-open')); await user.click(T('backup-undo-confirm-yes')); const ok = await screen.findByTestId('backup-undo-result-ok'); expect(ok.textContent).toBe('Restore undone11 sites, 11 History snapshots and 2 calendar events were removed, with 3 photos. The business details, lists and settings it filled in were taken out.');
    expect(JSON.parse(localStorage.getItem('swb-projects-v1')).map(p => p.id)).toEqual(['local']);
  });
  it('Done after an undo reloads; an undo that cannot run says so plainly', async () => {
    await restored(); const d = deps(); const { user } = mount(d); await user.click(T('backup-undo-open')); await user.click(T('backup-undo-confirm-yes')); await screen.findByTestId('backup-undo-result-ok'); await user.click(T('backup-undo-done')); expect(d.reload).toHaveBeenCalledTimes(1);
    cleanup(); await restored(); const d2 = deps({ undo: async () => ({ ok: false, code: 'expired', message: 'x' }) }); const m2 = mount(d2); await m2.user.click(T('backup-undo-open')); await m2.user.click(T('backup-undo-confirm-yes'));
    expect((await screen.findByTestId('backup-undo-result-err')).textContent).toBe('Undo is no longer availableThe undo period for the last restore has ended.');
  });
  it('after the undo window the section shows no Undo', async () => { await restored(); const d = deps({ undoInfo: () => backupUndoInfo(S, new Date(2026, 10, 20)) }); mount(d); expect(screen.queryByTestId('backup-undo-open')).toBeNull(); });
});

describe('the recorded problem', () => {
  it('is shown at the top with plain labels and a next step; a successful restore clears it', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6', 'gsd-items-v1'], at: '2026-10-05T01:00:00.000Z' } })); const { user } = mount(); const c = T('backup-problem');
    expect(c.textContent).toBe("A restore could not be fully put backOne part of this phone's saved data could not be read, so it was left exactly as it was: RCD Testing (list of sites) and General Site Defects (list of defects). The photos were kept and everything else was put back. Other modules are not affected.Next step: Make a backup now and contact support, quoting this message.This message goes away after the next successful restore.");
    expect(c.getAttribute('role')).toBe('alert'); expect(c.textContent).not.toMatch(/-v\d|projects-|items-/);
    cleanup(); const file = await backupOf(seedSourceFull); rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); const m = mount(); await upload(m.user, file); await screen.findByTestId('backup-summary'); await m.user.click(T('backup-restore')); await m.user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok');
    expect(screen.queryByTestId('backup-problem')).toBeNull();
  });
});

describe('the rules', () => {
  it('no window.confirm, alert or prompt is ever used, through every flow', async () => {
    const boom = vi.fn(() => { throw new Error('a browser dialog was used'); }); vi.stubGlobal('confirm', boom); vi.stubGlobal('alert', boom); vi.stubGlobal('prompt', boom); window.confirm = boom; window.alert = boom; window.prompt = boom;
    const file = await backupOf(seedSourceFull); await target(); const { user } = mount(deps({ deliver: async () => ({ ok: true, method: 'share', recorded: true }) }));
    await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready'); await user.click(T('backup-share')); await screen.findByTestId('backup-note-ok'); await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-no')); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok');
    await user.click(T('backup-undo-open').closest('div') ? T('backup-done') : T('backup-done')); expect(boom).not.toHaveBeenCalled();
  });
  it('every colour pair passes 4.5:1, and every card kind has an icon AND a title in words', () => {
    const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }; const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const U = BACKUP_UI; const pairs = [[U.white, U.slate], [U.slateText, U.page], [U.white, U.red], [U.disabledFg, U.disabledBg], [U.ink, U.page], [U.muted, U.page], [U.label, U.page], [U.label, U.twoStepBg], [U.ink, U.twoStepBg], [U.slateText, U.twoStepBg]];
    for (const k of Object.keys(U.card)) { pairs.push([U.card[k].title, U.card[k].bg], [U.card[k].body, U.card[k].bg]); expect(['info', 'check', 'warn', 'x']).toContain(U.card[k].icon); }
    for (const [fg, bg] of pairs) expect(ratio(fg, bg), fg + ' on ' + bg).toBeGreaterThanOrEqual(4.5);
  });
  it('through the flows: every button is at least 44 px tall; every card shows an icon and a title; errors are alerts, the rest status', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(deps({ deliver: async () => ({ ok: false, cancelled: true }) })); const check = () => { for (const b of screen.getByTestId('backup-section').querySelectorAll('button')) expect(parseInt(b.style.minHeight, 10), b.textContent).toBeGreaterThanOrEqual(44);
      for (const c of screen.getByTestId('backup-section').querySelectorAll('[role="alert"],[role="status"][data-testid^="backup-card"],[data-testid^="backup-result"],[data-testid^="backup-note"],[data-testid="backup-summary"]')) { expect(c.querySelector('svg'), c.dataset.testid).toBeTruthy(); expect(c.querySelector('div > div').textContent.length, c.dataset.testid).toBeGreaterThan(3); } };
    check(); await seedSourceFull(); await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready'); check(); await user.click(T('backup-share')); await screen.findByTestId('backup-note-info'); check(); await upload(user, new Blob([new Uint8Array(400)])); await screen.findByTestId('backup-result-err'); check();
    await user.click(T('backup-ok')); await wipe(); await upload(user, file); await screen.findByTestId('backup-summary'); check(); await user.click(T('backup-restore')); check();
  });
  it('real controls: the checkbox is a labelled input, the file input is labelled, buttons have text', () => { mount(); expect(screen.getByRole('checkbox', { name: /Include photos/ })).toBeTruthy(); expect(screen.getByLabelText('Choose backup file')).toBeTruthy(); for (const b of screen.getByTestId('backup-section').querySelectorAll('button')) expect(b.textContent.trim().length).toBeGreaterThan(2); });
});

describe('the Modules pill (through the real Global Settings screen)', () => {
  const mountSettings = (backupDeps, onGoHome = vi.fn()) => { const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={onGoHome} backupDeps={backupDeps} />); return { user, onGoHome }; };
  const pill = () => screen.getByText('Modules').closest('button') || screen.getByText('Modules');
  it('idle: the pill goes Home exactly as before', async () => { const { user, onGoHome } = mountSettings(deps()); await screen.findByTestId('backup-section'); await user.click(screen.getByRole('tab', { name: 'Backup & Data' })); await user.click(pill()); expect(onGoHome).toHaveBeenCalledTimes(1); });
  it('while a restore runs the pill does NOTHING (no Home, no reload) except bring the work into view; after it succeeds the pill RELOADS instead of going Home; after a failure it goes Home', async () => {
    Element.prototype.scrollIntoView = vi.fn(); const file = await backupOf(seedSourceFull); let finish; const reload = vi.fn();
    const d = deps({ reload, restore: (f, o) => new Promise(r => { finish = async () => r(await backupRestore(f, { ...o, storage: S })); }) }); const { user, onGoHome } = mountSettings(d); await screen.findByTestId('backup-section'); await user.click(screen.getByRole('tab', { name: 'Backup & Data' }));
    await user.upload(screen.getByTestId('backup-file-input'), fileOf(file)); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByText('Restoring…');
    await user.click(pill()); expect(onGoHome).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled(); expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    await act(async () => { await finish(); }); await screen.findByTestId('backup-result-ok'); await user.click(pill()); expect(reload).toHaveBeenCalledTimes(1); expect(onGoHome).not.toHaveBeenCalled();
  });
  it('after a FAILED restore the pill goes Home (nothing to reload)', async () => {
    const file = await backupOf(seedSourceFull); const reload = vi.fn(); const d = deps({ reload, restore: async () => ({ ok: false, code: 'failed', message: 'x' }) }); const { user, onGoHome } = mountSettings(d); await screen.findByTestId('backup-section'); await user.click(screen.getByRole('tab', { name: 'Backup & Data' }));
    await user.upload(screen.getByTestId('backup-file-input'), fileOf(file)); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-err'); await user.click(pill()); expect(onGoHome).toHaveBeenCalledTimes(1); expect(reload).not.toHaveBeenCalled();
  });
  it('after an UNDO the pill reloads too', async () => {
    const file = await backupOf(seedSourceFull); await backupRestore(file, { storage: S, now: NOW }); const reload = vi.fn(); const { user, onGoHome } = mountSettings(deps({ reload })); await user.click(await screen.findByRole('tab', { name: 'Backup & Data' })); await user.click(await screen.findByTestId('backup-undo-open')); await user.click(T('backup-undo-confirm-yes')); await screen.findByTestId('backup-undo-result-ok'); await user.click(pill()); expect(reload).toHaveBeenCalledTimes(1); expect(onGoHome).not.toHaveBeenCalled();
  });
});

describe('wording: "about" only before a number; the recorded problem names are grouped by module', () => {
  it('a backup under 1 MB: the building row and the without-photos button say "under 1 MB", never "about under 1 MB"; a number still gets "about"', async () => {
    let release; const d = deps({ measure: vi.fn(async ({ includePhotos }) => ({ estimatedBytes: includePhotos ? BACKUP_LARGE_BYTES : 100 * 1024 })), inspect: async () => ({ ok: true }), build: vi.fn(() => new Promise(r => { release = () => r({ blob: new Blob(['x']), filename: 'f.zip' }); })) });
    const { user } = mount(d); await user.click(T('backup-make')); await screen.findByTestId('backup-card-large'); expect(T('backup-make-small').textContent).toBe('Make it without photos (under 1 MB)');
    await user.click(T('backup-make-small')); await screen.findByText('Making your backup, under 1 MB. Keep this screen open.'); expect(text()).not.toContain('about under'); release(); await screen.findByTestId('backup-card-ready');
  });
  it('the recorded problem: one module with several parts reads "General Site Defects (list of sites, list of defects, audit details)", the name once', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['gsd-projects-v1', 'gsd-items-v1', 'gsd-meta-v1'], at: 'x' } })); mount(); const c = T('backup-problem');
    expect(c.textContent).toContain('so it was left exactly as it was: General Site Defects (list of sites, list of defects, audit details). The photos were kept'); expect(c.textContent.split('General Site Defects').length - 1).toBe(1);
  });
  it('the recorded problem: one module with one part keeps "RCD Testing, list of sites"', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); mount(); expect(T('backup-problem').textContent).toContain('so it was left exactly as it was: RCD Testing, list of sites. The photos were kept');
  });
});

describe('a rollback: the instruction is said ONCE on the screen, by the note at the top', () => {
  it('after a restore that cannot be put back: the recorded-problem card (top of Backup & Data) carries "Make a backup now and contact support, quoting this message."; the result card only points to it', async () => {
    const file = await backupOf(seedSourceFull); let rec = null;
    const d = deps({ problem: () => rec, restore: async () => { rec = { keys: ['rcd-projects-v6', 'gsd-items-v1'], at: 'x' }; return { ok: false, code: 'rollback', message: 'technical text, never shown' }; } });
    const { user } = mount(d); await upload(user, file); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes'));
    const result = await screen.findByTestId('backup-result-err'); const problem = await screen.findByTestId('backup-problem');
    expect(result.textContent).toBe("The restore did not finishOne part of this phone's saved data could not be read, so it was left as it was. The note at the top of this screen says what to do next.");
    expect(problem.textContent).toContain('Next step: Make a backup now and contact support, quoting this message.');
    expect(text().split('Make a backup now and contact support, quoting this message.').length - 1).toBe(1);        // once on the whole screen
    expect(problem.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();                // the note really IS above the result card, as the words say
    expect(text()).not.toMatch(/below/);
  });
});
