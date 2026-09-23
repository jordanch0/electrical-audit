import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
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

try {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(React.createElement(React.Fragment, null,
    React.createElement(App),
    React.createElement(UpdateToast)
  ))
  if (window.__hideLoading) window.__hideLoading()
} catch (e) {
  document.body.style.overflow = 'auto'
  document.body.innerHTML =
    '<div style="color:#991b1b;padding:30px;font-family:sans-serif;background:#e8e6e2;min-height:100vh">' +
    '<h2 style="color:#a3530f">Mount Error</h2><b>' + e.message + '</b><br><br>' +
    '<pre style="font-size:10px;color:#52525b;white-space:pre-wrap">' + e.stack + '</pre></div>'
}
