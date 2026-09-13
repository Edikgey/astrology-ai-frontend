import React from 'react';
import { Link } from 'react-router-dom';
import NatalChart from '../components/NatalChart';
import { OrbitMark } from '../components/UI';
import './HomePage.css';

// Illustrative positions, clearly labelled in the UI; never used for a user's calculation.
const previewBodies = {
  '☉': { symbol: '☉', degree: 46, sign: 'Телец', house: 2 },
  '☽': { symbol: '☽', degree: 129, sign: 'Лев', house: 5 },
  'AS': { symbol: 'AS', degree: 8, sign: 'Овен', house: 1 },
  '♀': { symbol: '♀', degree: 74, sign: 'Близнецы', house: 3 },
  '♂': { symbol: '♂', degree: 213, sign: 'Скорпион', house: 8 },
  '♃': { symbol: '♃', degree: 300, sign: 'Водолей', house: 11 },
};
Object.values(previewBodies).forEach(body => { body.roundedDegree = body.degree % 30; body.sign = body.sign.toUpperCase(); });
const previewHouses = Array.from({ length: 12 }, (_, i) => ({ symbol: String(i + 1), degree: i * 30 + 8 }));
const previewAspects = [{ from: '☉', to: '♂', aspect: '☍' }, { from: '☽', to: '♀', aspect: '✶' }, { from: '♀', to: '♃', aspect: '△' }, { from: '♂', to: '♃', aspect: '□' }];

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
        <NatalChart bodies={previewBodies} houses={previewHouses} aspects={previewAspects} preview />
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
