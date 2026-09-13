import React from 'react';
import { Link } from 'react-router-dom';
import NatalChart from '../components/NatalChart';
import { OrbitMark } from '../components/UI';
import './HomePage.css';

// Fixed synthetic-input backend fixture; the UI explicitly labels this an example.
import exampleChart from '../components/natal/fixtures/api-placidus.json';

export default function HomePage() {
  return <div className="home-page">
    <section className="hero shell">
      <div className="hero-copy"><p className="eyebrow">Натальная карта · Персональный AI</p>
        <h1>Ваша карта.<br /><span>Разговор о вас.</span></h1>
        <p className="hero-description">Персональный AI-астролог, который знает вашу натальную карту и помнит разговор. Разбирайтесь в себе — вопрос за вопросом.</p>
        <div className="button-row"><Link className="button" to="/try-free">Создать свою карту <span aria-hidden="true">↗</span></Link><Link className="hero-login" to="/authorization">Уже есть аккаунт? Войти</Link></div>
        <p className="hero-note">Начните бесплатно. Карта без регистрации, разговор — в аккаунте.</p>
      </div>
      <div className="hero-preview"><div className="preview-top"><span>Ваша точка отсчёта</span><span className="preview-dot" /> <span>Пример карты</span></div>
        <NatalChart bodies={exampleChart.bodies_for_circle} houses={exampleChart.houses} aspects={exampleChart.aspects_for_circle} structuredAspects={exampleChart.aspects_structured} houseSystem={exampleChart.house_system} preview />
        <div className="preview-conversation"><span className="eyebrow">Пример разговора</span>
          <p className="preview-question">Почему мне так важно чувствовать свободу?</p>
          <div className="preview-answer"><OrbitMark /><p>Давайте посмотрим, как эта тема проявляется в вашей карте — и в вашей жизни.</p></div>
        </div>
      </div>
    </section>
    <section className="home-value shell"><div className="section-heading"><p className="eyebrow">От карты к пониманию</p><h2>Не просто прочитать.<br />Узнать себя в разговоре.</h2></div>
      <div className="value-grid">
        <article><span className="step-number">01 / Ваша карта</span><h3>Всё начинается с вас</h3><p>Дата, точное время и место рождения складываются в персональную натальную карту.</p></article>
        <article><span className="step-number">02 / Ваши вопросы</span><h3>Спросите о важном</h3><p>Характер, отношения, работа. AI опирается на вашу карту, а вы выбираете направление разговора.</p></article>
        <article><span className="step-number">03 / Продолжение</span><h3>Возвращайтесь к разговору</h3><p>Задавайте уточняющие вопросы. В аккаунте сохраняются ваши карты и история каждого разбора.</p></article>
      </div>
    </section>
    <section className="home-plans shell"><div><p className="eyebrow">В своём темпе</p><h2>Начните с любопытства.<br />Продолжайте с Premium.</h2><p>Free: 3 карты и 10 успешных AI-вопросов за всё время аккаунта.<br />Premium: 10 карт и 300 вопросов за расчётный период.</p></div><Link className="button button-secondary" to="/pricing">Сравнить планы <span aria-hidden="true">↗</span></Link></section>
  </div>;
}
