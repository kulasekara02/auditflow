import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Simple CSS reset and base styles
const style = document.createElement('style')
style.textContent = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background-color: #f3f4f6;
    color: #1f2937;
    line-height: 1.5;
  }
  button {
    cursor: pointer;
  }
  input, button {
    font-family: inherit;
  }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
