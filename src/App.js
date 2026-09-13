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
import CookieConsent from "react-cookie-consent";

import Header from "./components/Header";
import Footer from "./components/Footer";

import HomePage from "./pages/HomePage";
import AuthorizationPage from "./pages/AuthorizationPage";
import TryFreePage from "./pages/TryFreePage";
import PricingPage from "./pages/PricingPage";
import MyCharts from "./pages/MyCharts";
import NatalChartResultPage from "./pages/NatalChartResultPage";
import { LoadingState } from "./components/UI";
import DailyHoroscopePage from "./pages/DailyHoroscopePage";

// 🔹 Приватные маршруты
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState text="Проверка аккаунта..." />;
  return user ? children : <Navigate to="/authorization" />;
}

// 🔸 Основное содержимое приложения
function AppContent() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <CookieConsent
        location="bottom"
        buttonText="Принять"
        declineButtonText="Отклонить"
        enableDeclineButton
        cookieName="userCookieConsent"
        disableStyles
        containerClasses="cookie-banner"
        buttonWrapperClasses="cookie-actions"
        declineButtonClasses="button-secondary"
        expires={365}
      >
        Разрешить необязательные cookie? Ваш выбор будет сохранён на этом устройстве.
      </CookieConsent>

      <a className="skip-link" href="#main-content">К содержимому</a>
      <Header />
      <main id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/try-free" element={<TryFreePage />} />
        <Route path="/authorization" element={<AuthorizationPage />} />
        <Route path="/natal-chart-result" element={<NatalChartResultPage />} />
        <Route path="/natal-chart-result/:chartId" element={<NatalChartResultPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/my-charts" element={<MyCharts />} />
        <Route path="/daily-horoscope" element={<DailyHoroscopePage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/my-charts" replace /></ProtectedRoute>} />
      </Routes>
      </main>
      <Footer />

      
    </>
  );
}

// 🔧 Обёртка приложения с провайдером
function App() {
  return (
    <AuthProvider>
      <UsageProvider>
      <Router>
        <AppContent />
      </Router>
      </UsageProvider>
    </AuthProvider>
  );
}

export default App;
