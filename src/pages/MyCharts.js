import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./MyCharts.css"; // Стили

const MyCharts = () => {
  const [formData, setFormData] = useState({
    name: "",
    birthDate: "",
    birthTime: "",
    birthPlace: "",
  });

  const navigate = useNavigate();

  // Загружаем данные из localStorage при загрузке страницы
  useEffect(() => {
    const savedData = localStorage.getItem("userData");
    if (savedData) {
      setFormData(JSON.parse(savedData));
    }
  }, []);

  // Обновляем state при изменении полей
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Сохранение данных в localStorage
  const handleSave = () => {
    localStorage.setItem("userData", JSON.stringify(formData));
    alert("Данные сохранены!");
  };

  return (
    <div className="charts-container">
      <h2>Редактирование данных натальной карты</h2>
      <form>
        <input type="text" name="name" placeholder="Имя" value={formData.name} onChange={handleChange} />
        <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
        <input type="time" name="birthTime" value={formData.birthTime} onChange={handleChange} />
        <input type="text" name="birthPlace" placeholder="Место рождения" value={formData.birthPlace} onChange={handleChange} />
        <button type="button" onClick={handleSave}>Сохранить изменения</button>
      </form>
      <button onClick={() => navigate("/")}>Вернуться на главную</button>
    </div>
  );
};

export default MyCharts;
