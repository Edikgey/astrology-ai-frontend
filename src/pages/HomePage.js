import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Контекст
import "./HomePage.css";

const HomePage = () => {
  const { user } = useAuth(); // 💡 Получаем пользователя из контекста
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    console.log("useAuth() вызван:", user);
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Ошибка выхода:", error);
    }
  };

  // ✅ Функция для обработки нажатия на кнопку оплаты
  const handlePaymentClick = (link) => {
    if (!user) {
      navigate("/authorization", { state: { from: "/pricing" } }); // Перенаправляем на вход
    } else {
      window.location.href = link; // Открываем оплату
    }
  };

  const setupVideos = () => {
    document.querySelectorAll(".video-item").forEach((item) => {
      const video = item.querySelector("video");
      let playButton = item.querySelector(".play-button");

      if (!playButton) {
        playButton = document.createElement("button");
        playButton.classList.add("play-button");
        playButton.innerHTML = "▶";
        item.appendChild(playButton);
      }

      playButton.addEventListener("click", () => {
        video.setAttribute("controls", "true");
        video.play();
        item.classList.add("playing");
        playButton.remove();
      });
    });
  };

  useEffect(() => {
    setupVideos();
  }, []);

  // ⬅️ Твой return(...) идёт дальше



    return (
        <div className="home-container">
            



















      {/* Герой-секция */}
      <section className="hero-section">
        <div className="hero">
          <h1>Ваш личный ИИ-Астролог</h1>
          <p>
            Преодолевайте жизненные трудности с уверенностью вместе с вашим персональным ИИ-Астрологом:  подробные отчёты и персонализированные чтения натальной карты.
          </p>
          <div className="buttons">
            <Link to="/try-free">
              <button className="start-button">Попробовать бесплатно</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Секция статистики */}
      <section className="stats-section">
  <h2 className="stats-title">
    Реальность <span className="highlight">современной</span> жизни
  </h2>
  <p className="stats-subtitle">
    Многие люди пытаются найти смысл, цель и счастье в своей жизни. Вот что показывают данные:
  </p>
  <div className="stats-grid">
    <div className="stats-card">
      <span className="stats-percentage">63%</span>
      <p className="stats-text">Чувствуют, что не реализуют весь свой потенциал.</p>
    </div>
    <div className="stats-card">
      <span className="stats-percentage">50%</span>
      <p className="stats-text">Чувствуют себя одинокими и оторванными от своих отношений.</p>
    </div>
    <div className="stats-card">
      <span className="stats-percentage">80%</span>
      <p className="stats-text">Недовольны своей работой.</p>
    </div>
    <div className="stats-card">
      <span className="stats-percentage">72%</span>
      <p className="stats-text">Чувствуют, что не живут жизнью своей мечты.</p>
    </div>
    <div className="stats-card">
      <span className="stats-percentage">67%</span>
      <p className="stats-text">Не считают себя «счастливыми».</p>
    </div>
  </div>
  <p className="stats-footer">
    Ты не одинок. Но так быть не должно. <br />
    А что, если бы существовала <span className="highlight">космическая дорожная карта</span>, созданная специально для вас?
  </p>
</section>



      {/*
<section className="pricing-section">
  <h2 className="pricing-title">Выберите ваш космический план</h2>
  <p className="pricing-subtitle">
    Доступные, персонализированные инструменты астрологии для вашего самопознания.
  </p>

  <div className="pricing-grid">
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

<section className="faq-section">
  <h2 className="faq-title">Frequently Asked Questions</h2>
  <div className="faq-container">
    {(() => {
      const [openIndex, setOpenIndex] = React.useState(null);
      const faqs = [
        {
          question: "What is an AI Astrologer?",
          answer: "An AI Astrologer is a sophisticated digital tool that combines artificial intelligence with astrological knowledge to provide personalized Чат gpt хватит совершать т"
        },
        {
          question: "How accurate are the AI Astrologer's readings?",
          answer: "AI Astrologers use advanced algorithms and vast datasets to offer high-accuracy readings, but interpretations remain subjective."
        },
        {
          question: "What's included in the monthly astrological report?",
          answer: "Each report includes personal predictions, planetary movements, and tailored guidance based on your astrological profile."
        },
        {
          question: "Can I choose which in-depth reports I receive?",
          answer: "Yes, you can customize the type of reports you receive based on your interests and needs."
        },
        {
          question: "Is my personal information safe?",
          answer: "We prioritize privacy and implement strong security measures to protect your personal data."
        }
      ];

      const toggleFAQ = (index) => {
        setOpenIndex(openIndex === index ? null : index);
      };

      return (
        <>
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <div className="faq-question" onClick={() => toggleFAQ(index)}>
                {faq.question}
              </div>
              {openIndex === index && <div className="faq-answer">{faq.answer}</div>}
            </div>
          ))}
        </>
      );
    })()}
  </div>
</section>

<section className="video-gallery">
  <div className="video-row">
    <div className="video-item">
      <video controls width="100%">
        <source src="https://res.cloudinary.com/dizmybqfl/video/upload/v1742055663/Download_3_folmdn.mp4" type="video/mp4" />
      </video>
      <p>Описание первого видео</p>
    </div>
    <div className="video-item">
      <video controls width="100%">
        <source src="https://res.cloudinary.com/dizmybqfl/video/upload/v1742055653/Download_2_jfkr1p.mp4" type="video/mp4" />
      </video>
      <p>Описание второго видео</p>
    </div>
    <div className="video-item">
      <video controls width="100%">
        <source src="https://res.cloudinary.com/dizmybqfl/video/upload/v1742055647/Download_1_crzg24.mp4" type="video/mp4" />
      </video>
      <p>Описание третьего видео</p>
    </div>
  </div>

  <div className="video-row">
    <div className="video-item">
      <video controls width="100%">
        <source src="https://res.cloudinary.com/dizmybqfl/video/upload/v1742056534/Download_4_jcv87d.mp4" type="video/mp4" />
      </video>
      <p>They dont know me son, Stay Hard, Nobody work like me in this house</p>
    </div>
    <div className="video-item">
      <video controls width="100%">
        <source src="https://res.cloudinary.com/dizmybqfl/video/upload/v1742057683/Download_5_iwjwzb.mp4" type="video/mp4" />
      </video>
      <p>Описание пятого видео</p>
    </div>
    <div className="video-item">
      <video controls width="100%">
        <source src="https://res.cloudinary.com/dizmybqfl/video/upload/v1742057682/Download_6_w6zvah.mp4" type="video/mp4" />
      </video>
      <p>Описание шестого видео</p>
    </div>
  </div>
</section>
*/}

    </div>
  );
};

export default HomePage; 
