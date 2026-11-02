import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import UserAdminPage from './pages/UserAdminPage.jsx'

// Déclare les routes : 4 pages publiques, 5 pages protégées par la session.
// L'adresse / est la présentation, pour tout le monde (D19) ; l'espace de
// chaque compte (envoi, historique) est à /analyse ; son profil à /compte ;
// la gestion des comptes (administrateur, D20 et D21) à /comptes.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route path="/confidentialite" element={<PrivacyPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/analyse" element={<HomePage />} />
        <Route path="/analyses/:id" element={<AnalysisPage />} />
        <Route path="/compte" element={<ProfilePage />} />
        <Route path="/comptes" element={<AdminPage />} />
        <Route path="/comptes/:id" element={<UserAdminPage />} />
      </Route>
      {/* Adresse inconnue (ou l'ancienne /presentation) : retour à la présentation. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
