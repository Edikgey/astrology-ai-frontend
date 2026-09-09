import React, { createContext, useState, useEffect, useContext } from "react";
import {
  requestRegister,
  verifyCode,
  login,
  getMe,
} from "../api/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));

  // ⏱ Автоматическая подгрузка юзера по токену
  useEffect(() => {
    if (token) {
      getMe(token)
        .then((data) => setUser(data))
        .catch(() => logout());
    }
  }, [token]);

  const loginUser = async (email, password) => {
    const sessionToken = localStorage.getItem("session_token");

    const data = await login(email, password, sessionToken);
    localStorage.setItem("access_token", data.access_token);
    localStorage.removeItem("session_token"); // 🧼 Удаляем временный токен

    setToken(data.access_token);

    const userData = await getMe(data.access_token);
    setUser(userData);
  };

  const registerEmail = async (email, password) => {
    return await requestRegister(email, password);
  };

  const verifyRegistration = async (code, email, password) => {
    const sessionToken = localStorage.getItem("session_token");

    const data = await verifyCode(code, email, password, sessionToken);
    localStorage.setItem("access_token", data.access_token);
    localStorage.removeItem("session_token");

    setToken(data.access_token);

    const userData = await getMe(data.access_token);
    setUser(userData);
  };

  const fetchCurrentUser = async (token) => {
    const data = await getMe(token);
    setUser(data);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("access_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login: loginUser,
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
