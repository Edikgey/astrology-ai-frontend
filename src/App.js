import ProductAnalyticsObserver from './components/ProductAnalyticsObserver';
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { UsageProvider } from "./context/UsageContext";
import CookiePreferences from './components/CookiePreferences';
import AnalyticsRouteGuard from './components/AnalyticsRouteGuard';
import PublicBehavior from './components/PublicBehavior';
import ErrorBoundary from './components/ErrorBoundary';

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
  const { user, loading, authError } = useAuth();
  const { pathname } = useLocation();
  if (authError) return null; // the check failed: neither let in nor sent away — AuthNotice explains
  if (loading) return <LoadingState text="Проверка аккаунта..." />;
  // replace: «Назад» from the sign-in page does not loop back here.
  return user ? children : <Navigate to="/authorization" replace state={{ returnTo: pathname }} />;
}

const SIGNED_OUT_TEXT = {
  expired: "Сессия истекла. Войдите снова, чтобы вернуться к своим картам и разговорам.",
  elsewhere: "Вход в аккаунт завершён в другой вкладке. Войдите снова, чтобы продолжить.",
};

// Why the sign-in state changed, under the header on every page.
function AuthNotice() {
  const { authError, authChecking, retryAuth, signedOutReason } = useAuth();
  const { pathname } = useLocation();
  if (authError) return <div className="notice shell button-row auth-notice" role="alert">
    <span>Не удалось проверить вход: нет связи с сервером. Мы не вывели вас из аккаунта — проверьте интернет или подождите минуту и нажмите «Повторить».</span>
    <button type="button" className="button-secondary" disabled={authChecking} onClick={retryAuth}>{authChecking ? "Проверяем…" : "Повторить"}</button>
  </div>;
  if (!SIGNED_OUT_TEXT[signedOutReason]) return null;
  return <div className="notice shell button-row auth-notice" role="status">
    <span>{SIGNED_OUT_TEXT[signedOutReason]}</span>
    {pathname !== "/authorization" && <Link to="/authorization" state={{ returnTo: pathname }}>Войти</Link>}
  </div>;
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
      <AuthNotice />
      <FreeBetaNotice />
      <main id="main-content" tabIndex={-1}>
      <ErrorBoundary key={pathname}>
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
      </ErrorBoundary>
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
