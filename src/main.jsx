import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@fontsource/permanent-marker/400.css' // sharpie / marker handwriting
import '@fontsource/caveat/400.css'            // casual handwriting
import '@fontsource/caveat/700.css'            // bold handwriting - loud call-outs
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
