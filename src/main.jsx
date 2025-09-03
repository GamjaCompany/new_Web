import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import P1 from './P1'
import P2 from './P2'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<P1 />} />
        <Route path="/p2" element={<P2 />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)