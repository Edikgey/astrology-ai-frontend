import React, { createContext, useState, useEffect, useContext } from "react";
import {
  requestRegister,
  verifyCode,
  login,
  getMe,
  googleLogin,
} from "../api/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [loading, setLoading] = useState(Boolean(token));
  const [activeGuestChart, setActiveGuestChart] = useState(null);

  // ⏱ Автоматическая подгрузка юзера по токену
  useEffect(() => {
    let active = true;
    if (token) {
      setLoading(true);
      getMe(token)
        .then((data) => { if (active) setUser(data); })
        .catch(() => { if (active) logout(); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [token]);

  const loginUser = async (email, password, guestChart) => {
    const data = await login(email, password, guestChart);
    localStorage.setItem("access_token", data.access_token);
    setUser(null);
    setLoading(true);
    setToken(data.access_token);
    return data;
  };

  const registerEmail = async (email, password) => {
    return await requestRegister(email, password);
  };

  const loginGoogle = async (credential, nonce, guestChart, password) => {
    const data = await googleLogin(credential, nonce, guestChart, password);
    localStorage.setItem("access_token", data.access_token);
    setUser(null);
    setLoading(true);
    setToken(data.access_token);
    return data;
  };

  const verifyRegistration = async (code, email, password, guestChart) => {
    const data = await verifyCode(code, email, password, guestChart);
    localStorage.setItem("access_token", data.access_token);
    setUser(null);
    setLoading(true);
    setToken(data.access_token);
    return data;
  };

  const fetchCurrentUser = async (token) => {
    const data = await getMe(token);
    setUser(data);
  };

  const logout = () => {
    setLoading(false);
    setUser(null);
    setToken(null);
    localStorage.removeItem("access_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        activeGuestChart,
        setActiveGuestChart,
        login: loginUser,
        loginGoogle,
        logout,
        registerEmail,
        verifyRegistration,
        fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
