import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

const Header = () => {
  const { user, logout } = useAuth(); // ✅ заменили signOut на logout
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/">Главная</Link>
        
      </div>

      <div className="nav-right">
        {user ? (
          <div className="user-menu">
            <div
              className="avatar-container"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="User Avatar"
                  className="user-avatar"
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div className="user-avatar-placeholder">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}

              {menuOpen && (
                <div
                  className="dropdown-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to="/my-charts">My Charts</Link>
                  <Link to="/my-reports">My Reports</Link>
                  <Link to="/my-calendar">My Calendar</Link>
                  <Link to="/daily-horoscope">Daily Horoscope</Link>
                  <Link to="/settings">User Settings</Link>
                  <hr />
                  <button
                    onClick={() => {
                      logout();              // ✅ работает корректно
                      setMenuOpen(false);
                      navigate("/");
                    }}
                    className="logout-btn"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button className="login-btn" onClick={() => navigate("/authorization")}>
            Войти / Регистрация
          </button>
        )}
      </div>
    </nav>
  );
};

export default Header;

