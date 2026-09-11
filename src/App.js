import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import CookieConsent from "react-cookie-consent";

import Header from "./components/Header";
import Footer from "./components/Footer";

import HomePage from "./pages/HomePage";
import AuthorizationPage from "./pages/AuthorizationPage";
import TryFreePage from "./pages/TryFreePage";
import PricingPage from "./pages/PricingPage";
import MyCharts from "./pages/MyCharts";
import NatalChartResultPage from "./pages/NatalChartResultPage";
import Dashboard from "./pages/Dashboard";
import DailyHoroscopePage from "./pages/DailyHoroscopePage";

// 🔹 Приватные маршруты
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/authorization" />;
}

// 🔸 Основное содержимое приложения
function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 🔙 Возврат на returnTo, если был редирект
  React.useEffect(() => {
    const returnTo = localStorage.getItem("returnTo");
    if (user && returnTo) {
      navigate(returnTo);
      localStorage.removeItem("returnTo");
    }
  }, [user, navigate]);

  return (
    <>
      <CookieConsent
        location="bottom"
        buttonText="Принять"
        declineButtonText="Отклонить"
        enableDeclineButton
        cookieName="userCookieConsent"
        style={{ background: "#222", color: "#fff" }}
        buttonStyle={{ background: "#4caf50", color: "#fff", fontSize: "14px" }}
        declineButtonStyle={{ background: "#f44336", color: "#fff", fontSize: "14px" }}
        expires={365}
      >
        Мы используем файлы cookie, чтобы улучшить ваш опыт. Приняв, вы соглашаетесь с нашей политикой.
      </CookieConsent>

      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/try-free" element={<TryFreePage />} />
        <Route path="/authorization" element={<AuthorizationPage />} />
        <Route path="/natal-chart-result" element={<NatalChartResultPage />} />
        <Route path="/natal-chart-result/:chartId" element={<NatalChartResultPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/my-charts" element={<MyCharts />} />
        <Route path="/daily-horoscope" element={<DailyHoroscopePage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>

      
    </>
  );
}

// 🔧 Обёртка приложения с провайдером
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
