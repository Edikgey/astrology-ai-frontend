import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css"; // Убедись, что у тебя есть этот файл

const Footer = () => {
  return (
<section className="footer">
    <div className="footer-container">
        {/* Левая часть */}
        <div className="footer-info">
            <h3>АвторитетАстрология</h3>
            <p>
                Самый авторитетный источник по всем вопросам астрологии, включая гороскопы, 
                калькуляторы, совместимость и многое другое.
            </p>
            <div className="footer-socials">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"></a>
                <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" aria-label="Pinterest"></a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"></a>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok"></a>
            </div>
        </div>

        {/* Сетка ссылок */}
        <div className="footer-links">
            <div className="footer-column">
                <h4>КАЛЬКУЛЯТОРЫ</h4>
                <Link to="/birth-chart">Карта рождения</Link>
                <Link to="/synastry-chart">Синастрия Карта</Link>
                <Link to="/composite-chart">Композитная диаграмма</Link>
                <Link to="/transit-chart">Транзитная карта</Link>
                <Link to="/progression-chart">Прогрессивная диаграмма</Link>
                <Link to="/sun-moon">Солнце, Луна, Восход</Link>
            </div>
            <div className="footer-column">
                <h4>ПЛАНЕТЫ</h4>
                <Link to="/planets/sun">Солнечный знак</Link>
                <Link to="/planets/moon">Лунный знак</Link>
                <Link to="/planets/mercury">Знак Меркурия</Link>
                <Link to="/planets/venus">Знак Венеры</Link>
                <Link to="/planets/mars">Знак Марса</Link>
                <Link to="/planets/jupiter">Знак Юпитера</Link>
                <Link to="/planets/saturn">Знак Сатурна</Link>
                <Link to="/planets/uranus">Знак Урана</Link>
                <Link to="/planets/neptune">Знак Нептуна</Link>
                <Link to="/planets/pluto">Знак Плутона</Link>
            </div>
            <div className="footer-column">
                <h4>АСТЕРОИДЫ</h4>
                <Link to="/asteroids/chiron">Знак Хирона</Link>
                <Link to="/asteroids/ceres">Знак Цереры</Link>
                <Link to="/asteroids/juno">Знак Юноны</Link>
                <Link to="/asteroids/pallas">Знак Паллады</Link>
                <Link to="/asteroids/vesta">Знак Весты</Link>
                <Link to="/asteroids/pholus">Знак Фола</Link>
            </div>
            <div className="footer-column">
                <h4>ОЧКИ</h4>
                <Link to="/points/ascendant">Восходящий знак (Асцендент)</Link>
                <Link to="/points/descendant">Знак потомка</Link>
                <Link to="/points/north-node">Северный узел</Link>
                <Link to="/points/south-node">Южный узел</Link>
                <Link to="/points/black-moon">Чёрная Луна Лилит</Link>
                <Link to="/points/white-moon">Белая Луна Селена</Link>
                <Link to="/points/vertex">Вертексная Астрология</Link>
                <Link to="/points/part-of-fortune">Часть Фортуны</Link>
                <Link to="/points/midheaven">Знак середины неба</Link>
                <Link to="/points/ic">Знак Имуми Коэли</Link>
            </div>
        </div>
    </div>

    {/* Политика и права */}
    <div className="footer-bottom">
        <Link to="/privacy-policy">Политика конфиденциальности</Link>
        <Link to="/terms">Срок службы</Link>
        <Link to="/contact">Контакт</Link>
        
    </div>
</section>

  );
};

export default Footer;
