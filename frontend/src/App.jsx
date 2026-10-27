import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'

// Déclare les routes : 3 pages publiques, 2 pages protégées par la session.
export default function App() {
  return (
    <Routes>
      <Route path="/presentation" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/confidentialite" element={<PrivacyPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyses/:id" element={<AnalysisPage />} />
      </Route>
      {/* Adresse inconnue : retour à l'accueil. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
