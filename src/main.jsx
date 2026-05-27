import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

try {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(React.createElement(App))
  if (window.__hideLoading) window.__hideLoading()
} catch (e) {
  document.body.style.overflow = 'auto'
  document.body.innerHTML =
    '<div style="color:#ff6b6b;padding:30px;font-family:sans-serif;background:#111;min-height:100vh">' +
    '<h2 style="color:#e8731a">Mount Error</h2><b>' + e.message + '</b><br><br>' +
    '<pre style="font-size:10px;color:#888;white-space:pre-wrap">' + e.stack + '</pre></div>'
}
