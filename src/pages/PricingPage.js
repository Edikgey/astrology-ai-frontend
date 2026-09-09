import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./PricingPage.css";

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePaymentClick = (link) => {
    if (!user) {
      navigate("/authorization", { state: { returnTo: "/pricing" } });
    } else {
      window.location.href = link;
    }
  };

  return (
    <>
      <section className="pricing-section">
        <h2 className="pricing-title">Выберите ваш космический план</h2>
        <p className="pricing-subtitle">
          Доступные, персонализированные инструменты астрологии для вашего самопознания.
        </p>

        <div className="pricing-grid">
          {/* Еженедельно */}
          <div className="pricing-card">
            <h3 className="plan-name">Еженедельно</h3>
            <p className="price">$9.97 <span>/ неделя</span></p>
            <button
              className="outline-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Начать пробовать
            </button>
            <p className="cancel-text">Вы можете отменить в любое время</p>
            <ul className="features-list">
              <li>Персонализированные ежедневные идеи</li>
              <li>Неограниченные диаграммы</li>
              <li>Базовый ИИ-астролог</li>
            </ul>
          </div>

          {/* Ежемесячно */}
          <div className="pricing-card">
            <h3 className="plan-name">Ежемесячно</h3>
            <p className="price">$19.97 <span>/ месяц</span></p>
            <button
              className="outline-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Присоединяйтесь к ежемесячному плану
            </button>
            <p className="cancel-text">Вы можете отменить в любое время</p>
            <ul className="features-list">
              <li>Всё в недельном плане</li>
              <li>Ежемесячный прогнозный отчёт</li>
              <li>Расширенный ИИ-астролог</li>
            </ul>
          </div>

          {/* Полугодовой */}
          <div className="pricing-card popular">
            <p className="purple-text">Самый популярный</p>
            <h3 className="plan-name">Полугодовой</h3>
            <p className="price">$16.66 <span>/ месяц</span></p>
            <p className="discount">Сэкономьте $20</p>
            <button
              className="filled-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Обновите сейчас
            </button>
            <p className="cancel-text">Вы можете отменить в любое время</p>
            <ul className="features-list">
              <li>Всё в ежемесячном плане</li>
              <li>Неограниченный ИИ-астролог</li>
              <li>2 специализированных отчёта</li>
              <li>Приоритетная поддержка по email</li>
            </ul>
          </div>

          {/* Годовой */}
          <div className="pricing-card best-value">
            <p className="green-text">Лучшее соотношение цены и качества</p>
            <h3 className="plan-name">Ежегодно</h3>
            <p className="price">$12.50 <span>/ месяц</span></p>
            <p className="discount">Сэкономьте $90</p>
            <button
              className="outline-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Получите лучшую сделку
            </button>
            <p className="cancel-text">Вы можете отменить в любое время</p>
            <ul className="features-list">
              <li>Всё в полугодовом плане</li>
              <li>4 специализированных отчёта</li>
              <li>Ранний доступ к новым функциям</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Сравнение тарифов */}
      <section className="comparison-section">
  <h2 className="comparison-title">Сравнение тарифов</h2>
  <div className="comparison-table">
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Еженедельно</th>
          <th>Ежемесячно</th>
          <th className="highlight">Полугодовой</th>
          <th className="highlight best">Ежегодно</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Ежедневные персонализированные идеи</td>
          <td>✓</td>
          <td>✓</td>
          <td>✓</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Неограниченные астрологические карты</td>
          <td>✓</td>
          <td>✓</td>
          <td>✓</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Доступ к ИИ-астрологу</td>
          <td>Базовый (100/нед)</td>
          <td>Расширенный (250/нед)</td>
          <td>Без ограничений</td>
          <td>Без ограничений</td>
        </tr>
        <tr>
          <td>Ежемесячный прогнозный отчёт</td>
          <td>✗</td>
          <td>✓</td>
          <td>✓</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Специализированные отчёты</td>
          <td>✗</td>
          <td>✗</td>
          <td>2 за цикл</td>
          <td>4 за цикл</td>
        </tr>
        <tr>
          <td>Приоритетная поддержка по email</td>
          <td>✗</td>
          <td>✗</td>
          <td>✓</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Ранний доступ к новым функциям</td>
          <td>✗</td>
          <td>✗</td>
          <td>✗</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Экономия</td>
          <td>✗</td>
          <td>✗</td>
          <td>Сэкономьте $20</td>
          <td>Сэкономьте $90</td>
        </tr>
        {/* Кнопки под таблицей */}
        <tr className="plan-buttons">
          <td></td>
          <td><button
              className="outline-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Начать пробовать
            </button></td>
          <td><button
              className="outline-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Начать пробовать
            </button></td>
          <td> <button
              className="filled-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Обновите сейчас
            </button></td>
          <td><button
              className="outline-button"
              onClick={() => handlePaymentClick("https://app.lava.top/1363349239?subscriptionOfferId=108385b3-604f-4888-901b-6f8339614f78")}
            >
              Получите лучшую сделку
            </button></td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

    </>
  );
};

export default PricingPage;
