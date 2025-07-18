import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './Root.js'

const rootEl = document.getElementById('react-app')
if (!rootEl) throw new Error('Missing #react-app')
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
