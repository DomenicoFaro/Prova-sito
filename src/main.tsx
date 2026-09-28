import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErroreAvvio } from './components/ErroreAvvio'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroreAvvio>
      <App />
    </ErroreAvvio>
  </StrictMode>,
)
