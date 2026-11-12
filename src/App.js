import ProductAnalyticsObserver from './components/ProductAnalyticsObserver';
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { UsageProvider } from "./context/UsageContext";
import CookiePreferences from './components/CookiePreferences';
import AnalyticsRouteGuard from './components/AnalyticsRouteGuard';
import PublicBehavior from './components/PublicBehavior';

import Header from "./components/Header";
import FreeBetaNotice from "./components/FreeBetaNotice";
import { ServiceConfigProvider } from "./context/ServiceConfigContext";
import Footer from "./components/Footer";
import FeedbackWidget from "./components/FeedbackWidget";
import { TermsPage, PrivacyPage, RefundPage, SupportPage } from "./pages/LegalPages";

import HomePage from "./pages/HomePage";
import AuthorizationPage from "./pages/AuthorizationPage";
import TryFreePage from "./pages/TryFreePage";
import PricingPage from "./pages/PricingPage";
import MyCharts from "./pages/MyCharts";
import NatalChartResultPage from "./pages/NatalChartResultPage";
import RelationshipNewPage from "./pages/RelationshipNewPage";
import RelationshipResultPage from "./pages/RelationshipResultPage";
import { LoadingState } from "./components/UI";
import NotFoundPage from "./pages/NotFoundPage";
import PasswordResetPage from './pages/PasswordResetPage';

// 🔹 Приватные маршруты
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState text="Проверка аккаунта..." />;
  return user ? children : <Navigate to="/authorization" />;
}

// 🔸 Основное содержимое приложения
function AppContent() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash && document.getElementById(hash.slice(1))) {
      document.getElementById(hash.slice(1)).scrollIntoView();
    } else window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <>
      <CookiePreferences />
      <ProductAnalyticsObserver />
      <PublicBehavior />

      <a className="skip-link" href="#main-content">К содержимому</a>
      <Header />
      <FreeBetaNotice />
      <main id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/try-free" element={<TryFreePage />} />
        <Route path="/authorization" element={<AuthorizationPage />} />
        <Route path="/reset-password" element={<PasswordResetPage />} />
        <Route path="/natal-chart-result" element={<NatalChartResultPage />} />
        <Route path="/natal-chart-result/:chartId" element={<NatalChartResultPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refunds" element={<RefundPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/my-charts" element={<MyCharts />} />
        <Route path="/relationships/new" element={<ProtectedRoute><RelationshipNewPage /></ProtectedRoute>} />
        <Route path="/relationships/:relationshipId" element={<ProtectedRoute><RelationshipResultPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/my-charts" replace /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </main>
      <Footer />
      <FeedbackWidget />

      
    </>
  );
}

// 🔧 Обёртка приложения с провайдером
function App() {
  return (
    <Router>
    <AnalyticsRouteGuard>
    <AuthProvider>
      <ServiceConfigProvider>
      <UsageProvider>
        <AppContent />
      </UsageProvider>
      </ServiceConfigProvider>
    </AuthProvider>
    </AnalyticsRouteGuard>
    </Router>
  );
}

export default App;
