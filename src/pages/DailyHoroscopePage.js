import React, { useEffect, useState } from "react";
import "./DailyHoroscopePage.css";

const DailyHoroscopePage = () => {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHoroscope();
  }, []);

  const getHoroscope = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem("userData"));

      if (
        !userData ||
        !userData.name ||
        !userData.birthDate ||
        !userData.birthTime ||
        !userData.birthPlace
      ) {
        setError("Пожалуйста, заполните свой профиль перед получением гороскопа.");
        setLoading(false);
        return;
      }

      console.log("📤 Отправляем данные:", userData);

      const response = await fetch("http://localhost:5000/horoscope/daily-horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userData.name,
          birthDate: userData.birthDate,
          birthTime: userData.birthTime,
          birthPlace: userData.birthPlace,
          latitude: userData.latitude || "",
          longitude: userData.longitude || "",
          julianDate: userData.julianDate || "",
        }),
      });

      const result = await response.json();
      console.log("🪐 Ответ от сервера:", result);

      if (response.ok && result?.horoscope?.message) {
        setPrediction(result.horoscope.message);
      } else {
        setError(result?.message || "Не удалось получить гороскоп.");
      }
    } catch (err) {
      console.error("❌ Ошибка при получении гороскопа:", err);
      setError("Произошла ошибка при запросе гороскопа.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="daily-horoscope-container">
      {loading ? (
        <div className="loader">Загрузка...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="horoscope-result">
          <h2>Твой гороскоп на сегодня</h2>
          <p>{prediction}</p>
        </div>
      )}
    </div>
  );
};

export default DailyHoroscopePage;

