import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
const Sauna = React.lazy(() => import('./Sauna.jsx'))
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has('sauna') ? <React.Suspense fallback={<p>Načítám lesní saunu…</p>}><Sauna /></React.Suspense> : <App />}
  </React.StrictMode>
)
