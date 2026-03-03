import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PokerAgents from './PokerAgents'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PokerAgents />
  </StrictMode>,
)