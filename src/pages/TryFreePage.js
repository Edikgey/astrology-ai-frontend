// ...импорт как есть
import { API_URL } from "../config/api";
import { saveChartPresentation } from "../api/chartPresentation";
import { PageHeading, OrbitMark } from "../components/UI";
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { apiError } from "../api/apiError";
import UsageSummary from "../components/UsageSummary";
import { normalizeLandingIntent } from "./landingIntent";
import "./TryFreePage.css";

const years = Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) => 1900 + i);
const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const days = Array.from({ length: 31 }, (_, i) => i + 1);
const hours = Array.from({ length: 24 }, (_, i) => (i < 10 ? "0" + i : "" + i));
const minutes = Array.from({ length: 60 }, (_, i) => (i < 10 ? "0" + i : "" + i));

const chooseLocationMessage = "Выберите место рождения из списка подсказок — ввод текста сам по себе не выбирает место.";
const validZone = zone => {
  if (typeof zone !== "string" || (!zone.includes("/") && zone !== "UTC")) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; }
};
const validLocation = location => location && location.city && validZone(location.timezone) &&
  Number.isFinite(location.lat) && Math.abs(location.lat) <= 90 &&
  Number.isFinite(location.lon) && Math.abs(location.lon) <= 180;
const selectedLocationMatches = data => validLocation(data.selectedLocation) &&
  data.birthPlace === data.selectedLocation.city && data.latitude === data.selectedLocation.lat &&
  data.longitude === data.selectedLocation.lon && data.timezone === data.selectedLocation.timezone &&
  data.region === data.selectedLocation.region && data.country === data.selectedLocation.country;

const locationFromResult = item => {
  const parts = item.components || {};
  // Keep the provider's full label, adding administrative context it may omit.
  const region = parts.state || parts.region || parts.county || "";
  const country = parts.country || "";
  const name = item.formatted || parts.city || parts.town || parts.village || parts.hamlet || "";
  const city = [name, ...[region, country].filter(value => value && !name.includes(value))].join(", ");
  return { city, lat: item.geometry?.lat, lon: item.geometry?.lng,
    timezone: item.annotations?.timezone?.name || "", region, country };
};

// ✅ универсальный
export const calculateNatalChart = async (formData) => {
  if (!selectedLocationMatches(formData)) throw new Error(chooseLocationMessage);
  try {
    const months = [
      "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
      "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    const monthIndex = months.indexOf(formData.month) + 1;

    const payload = {
      year: parseInt(formData.year),
      month: monthIndex,
      day: parseInt(formData.day),
      hour: Number(formData.hour),
      minute: Number(formData.minute || 0),
      timezone: formData.timezone || null,
      time_fold: formData.timeFold === "" || formData.timeFold == null ? null : Number(formData.timeFold),
      lon: formData.longitude !== "" && formData.longitude != null ? Number(formData.longitude) : null,
      lat: formData.latitude !== "" && formData.latitude != null ? Number(formData.latitude) : null,
      city: formData.birthPlace,
      region: formData.region || "",
      country: formData.country || "",
      selected_location: formData.selectedLocation,
    };

    const headers = {
      "Content-Type": "application/json",
    };

    const jwt = localStorage.getItem("access_token");

    if (jwt && jwt !== "null") {
      headers["Authorization"] = `Bearer ${jwt}`;
    } else {
      let sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        sessionToken = crypto.randomUUID();
        localStorage.setItem("session_token", sessionToken);
      }
      headers["X-Session-Token"] = sessionToken; // ⬅️ теперь токен только в заголовке
    }


    const response = await fetch(`${API_URL}/natal-chart`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) throw apiError(response.status, data, "Произошла ошибка при расчёте натальной карты");

    localStorage.setItem("natalChart", JSON.stringify(data));
    localStorage.setItem("chart_id", data.chart_id);
    saveChartPresentation(data.chart_id, formData);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при расчёте натальной карты:", error);
    throw error;
  }
};



const TryFreePage = () => {
  const { user } = useAuth();
  const { refreshUsage, handleLimitError } = useUsage();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedIntent = normalizeLandingIntent(location.state?.landingIntent);
  const [formData, setFormData] = useState({
    name: "",
    year: "2000",
    month: "Январь",
    day: "1",
    hour: "00",
    minute: "00",
    birthPlace: "",
    latitude: "",
    longitude: "",
    region: "",
    country: "",
    timezone: "",
    timeFold: "",
    selectedLocation: null,
  });
  const [timeOptions, setTimeOptions] = useState([]);
  const cityRequest = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const savedData = localStorage.getItem("userData");
    if (savedData) {
      try {
        const saved = JSON.parse(savedData);
        // Profile text is not an OpenCage selection, even if it looks complete.
        setFormData(previous => ({ ...previous, ...saved, timeFold: "", selectedLocation: null,
          latitude: "", longitude: "", timezone: "", region: "", country: "" }));
      } catch { /* Invalid local profile data must not break location selection. */ }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(previous => ({ ...previous, [name]: value, timeFold: name === "timeFold" ? value : "",
      ...(name === "birthPlace" ? { latitude: "", longitude: "", timezone: "", region: "", country: "", selectedLocation: null } : {}),
    }));
    if (name !== "timeFold") setTimeOptions([]);
    if (name === "birthPlace") {
      cityRequest.current += 1; setSuggestions([]); setLocationError(""); setSubmitError("");
    }

    if (name === "birthPlace" && value.length > 2) {
      fetchCitySuggestions(value);
    }
  };

  const fetchCitySuggestions = async (city) => {
    const API_KEY = "98068be0e1294f02be4976598e187bb6";
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(city)}&key=${API_KEY}&language=ru`;

    const requestId = cityRequest.current;
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (requestId !== cityRequest.current) return;
      if (!response.ok || !Array.isArray(data.results)) throw new Error("Location lookup failed");
      if (data.results.length > 0) {
        const cityList = data.results.map(locationFromResult);
        setSuggestions(cityList);
      } else {
        setSuggestions([]);
        setLocationError("Место не найдено. Уточните город, область и страну.");
      }
    } catch {
      if (requestId !== cityRequest.current) return;
      setSuggestions([]);
      setLocationError("Не удалось загрузить места. Повторите поиск или уточните область и страну.");
    }
  };

  const selectCity = (city) => {
    cityRequest.current += 1;
    setTimeOptions([]);
    setSubmitError("");
    const valid = validLocation(city);
    setLocationError(valid ? "" : "У этого результата нет пригодных координат или IANA timezone. Выберите другой результат или уточните область и страну.");
    setFormData((prevData) => ({
      ...prevData,
      birthPlace: city.city,
      latitude: valid ? city.lat : "",
      longitude: valid ? city.lon : "",
      timezone: valid ? city.timezone : "",
      selectedLocation: valid ? city : null,
      timeFold: "",
      country: city.country || "",
      region: city.region || "",
    }));
    setSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!selectedLocationMatches(formData)) { setLocationError(chooseLocationMessage); return; }
    setSubmitting(true);
    setSubmitError("");

    const updatedFormData = {
      ...formData,
      year: formData.year || "2000",
      month: formData.month || "Январь",
      day: formData.day || "1",
      hour: formData.hour || "00",
      minute: formData.minute || "00",
    };

    const monthIndex = months.indexOf(updatedFormData.month) + 1;
    const selectedDate = `${String(updatedFormData.year).padStart(4, "0")}-${String(monthIndex).padStart(2, "0")}-${String(updatedFormData.day).padStart(2, "0")}`;
    const selectedTime = `${String(updatedFormData.hour).padStart(2, "0")}:${String(updatedFormData.minute).padStart(2, "0")}`;
    const finalData = {
      ...updatedFormData,
      birthDate: selectedDate,
      birthTime: selectedTime,
      region: formData.region,
      country: formData.country,
    };

    localStorage.setItem("tempUserData", JSON.stringify(finalData));

    try {
      const result = await calculateNatalChart(finalData);
      refreshUsage();
      const returnTo = location.state?.returnTo === "/relationships/new" ? location.state.returnTo : null;
      if (returnTo) {
        navigate(returnTo, { replace: true, state: {
          relationshipDraft: location.state?.relationshipDraft || null,
          createdChartId: result.chart_id,
        } });
      } else {
        if (selectedIntent) navigate(`/natal-chart-result/${result.chart_id}`, { state: { landingIntent: selectedIntent } });
        else navigate(`/natal-chart-result/${result.chart_id}`);
      }
    } catch (error) {
      if (error.code === "ambiguous_birth_time") setTimeOptions(error.detail.options || []);
      if (!handleLimitError(error)) setSubmitError(error.message || "Не удалось создать карту. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tryfree-container page">
      <aside className="create-intro">
        <PageHeading eyebrow="Начните с себя" title={selectedIntent
          ? "Создадим вашу карту, чтобы посмотреть на этот вопрос через неё"
          : "Ваша история начинается здесь."}>
          <p>{selectedIntent
            ? "Дата, время и место рождения помогут построить персональную точку отсчёта для разговора."
            : "Несколько деталей рождения — и перед вами ваша персональная натальная карта."}</p>
        </PageHeading>
        {selectedIntent && <div className="create-intent" aria-label="Выбранный вопрос">
          <span>Ваш вопрос</span><p>«{selectedIntent.question}»</p>
        </div>}
        <div className="create-note"><OrbitMark /><h3>Время имеет значение</h3><p>Укажите местное время рождения, включая минуты. Часовой пояс определится по выбранному месту.</p><p>Чем точнее исходные данные, тем полезнее разбор.</p></div>
        {user && <UsageSummary />}
      </aside>
      <div className="tryfree-form card">
        <div className="form-heading"><span className="eyebrow">Новая натальная карта</span><h2>Расскажите о себе</h2></div>
        <form onSubmit={handleSubmit} aria-busy={submitting}>
          <label htmlFor="chart-name">Имя или название карты <span className="muted">· необязательно</span></label>
          <input id="chart-name" name="name" value={formData.name} maxLength={80} onChange={handleChange} placeholder="Как назвать вашу карту?" autoComplete="given-name" aria-describedby="chart-name-hint" />
          <p className="field-hint" id="chart-name-hint">Подпись сохранится только на этом устройстве.</p>
          <div className="field-label" id="birth-date-label">Дата рождения</div>
          <div className="date-selects" role="group" aria-labelledby="birth-date-label">
            <select aria-label="Год рождения" name="year" value={formData.year} onChange={handleChange}>{years.map(y => <option key={y}>{y}</option>)}</select>
            <select aria-label="Месяц рождения" name="month" value={formData.month} onChange={handleChange}>{months.map(m => <option key={m}>{m}</option>)}</select>
            <select aria-label="День рождения" name="day" value={formData.day} onChange={handleChange}>{days.map(d => <option key={d}>{d}</option>)}</select>
          </div>

          <div className="field-label" id="birth-time-label">Местное время рождения</div>
          <div className="time-selects" role="group" aria-labelledby="birth-time-label">
            <select aria-label="Часы рождения" name="hour" value={formData.hour} onChange={handleChange}>{hours.map(h => <option key={h}>{h}</option>)}</select>
            <select aria-label="Минуты рождения" name="minute" value={formData.minute} onChange={handleChange}>{minutes.map(m => <option key={m}>{m}</option>)}</select>
          </div>

          <label className="field-label" htmlFor="birth-place">Место рождения</label>
          <input
            type="text"
            name="birthPlace"
            id="birth-place"
            placeholder="Введите город"
            value={formData.birthPlace}
            onChange={handleChange}
            autoComplete="off"
            aria-label="Место рождения"
            aria-describedby="location-status"
            onKeyDown={e => {
              if (e.key === "ArrowDown" && suggestions.length) {
                e.preventDefault(); document.getElementById("birth-location-option-0")?.focus();
              }
              if (e.key === "Enter" && !selectedLocationMatches(formData)) {
                e.preventDefault(); setLocationError(chooseLocationMessage);
              }
            }}
          />
          <p className="field-hint" id="location-status" role={locationError ? "alert" : undefined}>
            {locationError || (formData.selectedLocation ? "Место выбрано из подсказок." : "Введите город и выберите вариант с нужной областью и страной.")}
          </p>
          {formData.timezone && <p className="selected-timezone"><span aria-hidden="true">✓</span> Часовой пояс места рождения: <strong>{formData.timezone}</strong></p>}
          {timeOptions.length > 0 && <label>Вариант времени при переводе часов:
            <select name="timeFold" value={formData.timeFold} onChange={handleChange}>
              <option value="">Выберите UTC-смещение</option>
              {timeOptions.map(option => <option key={option.fold} value={option.fold}>UTC{option.offset}</option>)}
            </select>
          </label>}

          {suggestions.length > 0 && (
            <ul className="suggestions-list">
              {suggestions.map((city, index) => (
                <li key={index} id={`birth-location-option-${index}`} role="button" tabIndex={0}
                  onClick={() => selectCity(city)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCity(city); }
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const next = (index + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length;
                      document.getElementById(`birth-location-option-${next}`)?.focus();
                    }
                  }}>
                  {city.city}{!validLocation(city) && " — нет пригодного часового пояса или координат"}
                </li>
              ))}
            </ul>
          )}

          {submitError && <p role="alert">{submitError}</p>}
          <button className="calculate-button" type="submit" disabled={submitting}>{submitting ? "Расчёт..." : "Рассчитать карту"}</button>
          {submitting && <p className="field-hint" role="status">Рассчитываем положения планет и домов. Это займёт немного времени.</p>}
          {!user && <p className="form-footnote">Создание карты бесплатно. Сохранить её и начать AI-разговор можно после регистрации.</p>}
        </form>
      </div>
    </div>
  );
};

export default TryFreePage;
