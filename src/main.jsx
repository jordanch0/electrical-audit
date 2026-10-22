import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { backupRecoverAtStart, backupFinishRecovery, eraseStartup, eraseRuntime, requestPersistentStorage, AppErrorBoundary, installGlobalErrorNotice } from './App.jsx'
import { useRegisterSW } from 'virtual:pwa-register/react'

// A build lands as a new service worker in the background but does not take over
// until the user taps Refresh — avoids yanking the bundle out from under someone
// mid-audit the way an auto-activating update would.
function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return React.createElement('div', {
    style: {
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 99999,
      background: '#f7f6f3', border: '1px solid #d4d4d8', borderRadius: 12,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#18181b',
      fontFamily: 'sans-serif', fontSize: 13,
    },
  },
    React.createElement('span', { style: { flex: 1 } }, 'A new version of SparkCheck is available.'),
    React.createElement('button', {
      onClick: () => updateServiceWorker(true),
      style: {
        background: '#a3530f', color: '#fff', border: 'none', borderRadius: 8,
        padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
      },
    }, 'Refresh'),
    React.createElement('button', {
      onClick: () => setNeedRefresh(false),
      style: {
        background: 'transparent', color: '#52525b', border: 'none',
        fontSize: 13, cursor: 'pointer', flexShrink: 0,
      },
    }, 'Later')
  )
}

// An unfinished "Delete all data" is finished HERE, before anything renders (App.jsx: eraseStartup). Normally it is done in well under a tenth of a second; if it takes longer than 2 s the app starts on the
// Global Settings screen only and the erase carries on. Never throws: a problem here must not stop the app from starting.
const startApp = async () => {
try { await eraseStartup() } catch (_) {}

// An interrupted restore is put right HERE, synchronously, before anything renders (localStorage only: a few getItem / setItem calls); the photo / logo records it wrote are then deleted in the
// background. Never throws: a problem here must not stop the app from starting.
try { if (backupRecoverAtStart().recovered) backupFinishRecovery().catch(() => {}) } catch (_) {}

try {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  // The error screen wraps the app only: the update toast stays OUTSIDE it, so Refresh still works on the error screen (a new build may fix the crash).
  root.render(React.createElement(React.Fragment, null,
    React.createElement(AppErrorBoundary, null, React.createElement(App)),
    React.createElement(UpdateToast)
  ))
  if (window.__hideLoading) window.__hideLoading()
  // From here the app owns uncaught errors: index.html's inline handlers (a start-up net that replaces the page) go quiet, and one small notice replaces them. Never throws.
  window.__sparkcheckBooted = true
  try { installGlobalErrorNotice() } catch (_) {}
  // Ask the browser to keep this app's data (navigator.storage.persist; silent, no prompt). Only AFTER the first render has been handed to React, a tick later, and never while an unfinished erase has the app on the
  // Settings-only screen. It comes after the erase and the recovery above, never inside them. Never throws.
  setTimeout(() => { try { if (!eraseRuntime.state.settingsOnly) requestPersistentStorage() } catch (_) {} }, 0)
} catch (e) {
  document.body.style.overflow = 'auto'
  document.body.innerHTML =
    '<div style="color:#991b1b;padding:30px;font-family:sans-serif;background:#e8e6e2;min-height:100vh">' +
    '<h2 style="color:#a3530f">Mount Error</h2><b>' + e.message + '</b><br><br>' +
    '<pre style="font-size:10px;color:#52525b;white-space:pre-wrap">' + e.stack + '</pre></div>'
}
}
startApp()
