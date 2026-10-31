import { BrowserRouter } from 'react-router'
import { AppRoutes } from './app/AppRoutes'
import { PlayerGate } from './app/PlayerGate'

export default function App() {
  return (
    <BrowserRouter>
      <PlayerGate>
        <AppRoutes />
      </PlayerGate>
    </BrowserRouter>
  )
}
