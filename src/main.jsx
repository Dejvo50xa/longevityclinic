import './index.css'

async function start() {
  if (new URLSearchParams(window.location.search).has('sauna')) {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.replaceChildren(root)
    const [{ default: React }, { createRoot }, { default: Sauna }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./Sauna.jsx'),
    ])
    createRoot(root).render(<React.StrictMode><Sauna /></React.StrictMode>)
  } else {
    await import('./App.jsx')
  }
}
start()
