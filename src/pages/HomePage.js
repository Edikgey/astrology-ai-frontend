import React from 'react';
import { Link } from 'react-router-dom';
import NatalChart from '../components/NatalChart';
import { PLANS } from '../config/plans';
import exampleChart from '../components/natal/fixtures/api-placidus.json';
import './HomePage.css';

const faqs = [
  ['Что такое натальная карта?', 'Это схема положения планет, знаков и домов на момент рождения. В Lunaria она становится основой для персонального разговора о вас.'],
  ['Нужно ли знать точное время рождения?', 'Да: время, включая минуты, важно для домов и углов карты. Используйте местное время рождения; часовой пояс определяется по выбранному месту. Если время неизвестно, интерпретации домов могут быть неточными.'],
  ['Чем Lunaria отличается от обычного гороскопа?', 'Разговор опирается на вашу натальную карту, а не только на знак Солнца. Вы можете уточнить ответ и связать его со своей ситуацией.'],
  ['Запоминает ли Lunaria предыдущие разговоры?', 'В аккаунте сохраняется история каждой карты. Lunaria учитывает контекст разговора внутри этой карты, в том числе его краткое резюме, но это не безошибочная память обо всех деталях.'],
  ['Можно ли обсуждать отношения и карьеру?', 'Да. Исследуйте эмоциональные потребности, привычные реакции, мотивацию и рабочий стиль. Lunaria помогает сформулировать вопросы и направления для размышления, а решения остаются за вами.'],
  ['Что входит в бесплатный аккаунт?', `До ${PLANS.free.chartLimit} сохранённых карт и ${PLANS.free.gptLimit} успешных AI-вопросов за всё время аккаунта, с историей разговора для каждой карты.`],
];

export default function HomePage() {
  return <div className="home-page">
    <section className="hero shell">
      <div className="hero-copy"><p className="eyebrow">Ваша карта. Ваш разговор.</p>
        <h1><span>Lunaria</span> — ваш персональный AI-астролог</h1>
        <p className="hero-description">Создайте натальную карту и обсуждайте с Lunaria отношения, характер, карьеру и повторяющиеся жизненные сценарии. Ваша карта и контекст разговора помогают сделать ответы персональными.</p>
        <div className="button-row"><Link className="button" to="/try-free">Создать натальную карту <span aria-hidden="true">↗</span></Link><Link className="hero-login" to="/authorization">Войти в аккаунт</Link></div>
        <p className="hero-note">Карта без регистрации. Сохранение карт и разговор — в бесплатном аккаунте.</p>
      </div>
      <div className="hero-preview"><div className="preview-top"><span>Ваша точка отсчёта</span><span className="preview-dot" /><span>Пример карты</span></div>
        <NatalChart bodies={exampleChart.bodies_for_circle} houses={exampleChart.houses} aspects={exampleChart.aspects_for_circle} structuredAspects={exampleChart.aspects_structured} houseSystem={exampleChart.house_system} preview />
        <div className="preview-conversation"><span className="eyebrow">Больше, чем ваш знак зодиака</span><p className="preview-question">Целая карта, чтобы увидеть больше связей.</p><p className="preview-caption">Планеты, знаки, дома, ASC и MC, аспекты и сохранённые конфигурации. Выберите точку на своей карте, чтобы узнать её положение, или начните с вопроса к Lunaria.</p></div>
      </div>
    </section>
    <section className="home-value shell" aria-labelledby="how-title"><div className="section-heading"><p className="eyebrow">Три простых шага</p><h2 id="how-title">От данных рождения — к разговору о себе.</h2></div>
      <div className="value-grid">
        <article><span className="step-number">01 / Данные</span><h3>Расскажите, где всё началось</h3><p>Введите дату, местное время и место рождения. Выберите свой город из подсказок.</p></article>
        <article><span className="step-number">02 / Карта</span><h3>Увидьте свою натальную карту</h3><p>Изучите положения планет, дома и связи между ними. Точные значения доступны прямо на карте.</p></article>
        <article><span className="step-number">03 / Разговор</span><h3>Задайте Lunaria свой вопрос</h3><p>Выберите тему, которая важна сейчас. Уточняйте ответы и возвращайтесь к обсуждению в сохранённой карте.</p></article>
      </div>
    </section>
    <section className="home-value shell" aria-labelledby="topics-title"><div className="section-heading"><p className="eyebrow">С чего начать разговор</p><h2 id="topics-title">Вопросы, в которых хочется разобраться.</h2><p>Астрология как язык самопознания — с вниманием к вашей реальной жизни.</p></div>
      <div className="home-topics">
        <article className="topic-card"><span className="step-number">Самопонимание</span><h3>Замечайте свои привычные реакции</h3><p>Исследуйте характер, сильные стороны и внутренние противоречия. Обсудите сценарии, которые повторяются, и то, что стоит за вашей реакцией.</p><blockquote>«Почему я долго обдумываю перемены, даже когда очень их хочу?»</blockquote></article>
        <article className="topic-card topic-relationships"><span className="step-number">Отношения и любовь</span><h3>Поймите, что для вас значит близость</h3><p>Чего вы ищете в отношениях? Какие эмоциональные потребности и качества партнёра для вас особенно важны? Рассмотрите повторяющиеся модели поведения и причины сложных переживаний.</p><blockquote>«Мне важны и близость, и свобода. Как понять свои потребности?»</blockquote><p className="topic-note">Не поиск «идеального партнёра», а пространство для осмысления своего опыта.</p></article>
        <article className="topic-card"><span className="step-number">Карьера и направление</span><h3>Найдите вопросы для следующего шага</h3><p>Обсудите рабочий стиль, мотивацию и склонности. Посмотрите, какие сильные стороны хочется развивать и какие направления можно исследовать.</p><blockquote>«В какой работе я могу чаще использовать свои сильные стороны?»</blockquote></article>
      </div>
    </section>
    <section className="home-dialogue shell" aria-labelledby="dialogue-title"><div className="section-heading"><p className="eyebrow">Карту можно обсудить</p><h2 id="dialogue-title">Ответ — начало следующего вопроса.</h2><p>Статичный отчёт заканчивается на интерпретации. С Lunaria можно уточнить её, рассказать о своей ситуации и продолжить мысль.</p><div className="home-memory"><h3>Lunaria помнит контекст разговора</h3><p>Внутри сохранённой карты Lunaria учитывает вашу карту и предыдущие сообщения. Вернитесь к той же карте — и вам не придётся заново объяснять основную тему разговора.</p></div></div>
      <div className="conversation-example card"><p className="eyebrow">Иллюстрация диалога</p><div className="example-message example-user"><strong>Вы</strong><p>Почему мне так трудно отпускать отношения?</p></div><div className="example-message"><strong>Lunaria</strong><p>Луна в Скорпионе в этой карте может быть поводом поговорить о глубине привязанности. Что сейчас труднее отпустить: самого человека или ощущение близости, которое было рядом с ним?</p></div><div className="example-message example-user"><strong>Вы · уточнение</strong><p>Скорее ощущение близости. А как это может проявляться в новых отношениях?</p></div><p className="example-caption">Пример по демонстрационной карте выше. Ваш разговор будет опираться на ваши данные и вопросы.</p></div>
    </section>
    <section className="home-plans shell" aria-labelledby="plans-title"><div className="section-heading"><p className="eyebrow">В своём темпе</p><h2 id="plans-title">Начните бесплатно.<br />Продолжайте, когда захотите.</h2></div><div className="home-plan-grid"><article><h3>Free</h3><p className="home-plan-price">Бесплатно</p><ul><li>До {PLANS.free.chartLimit} сохранённых карт</li><li>{PLANS.free.gptLimit} AI-вопросов за всё время аккаунта</li><li>История разговора для каждой карты</li></ul></article><article><h3>Premium</h3><p className="home-plan-price">$9.99 <span>USD / месяц</span></p><ul><li>До {PLANS.premium.chartLimit} сохранённых карт</li><li>До {PLANS.premium.gptLimit} AI-вопросов за расчётный период</li><li>Больше пространства для уточнений</li></ul><p className="plan-local-note">Базовая цена. Итоговая цена в вашей валюте — в checkout.</p></article></div><Link className="button button-secondary" to="/pricing">Сравнить планы <span aria-hidden="true">↗</span></Link></section>
    <section className="home-faq shell" aria-labelledby="faq-title"><div className="section-heading"><p className="eyebrow">Перед первым вопросом</p><h2 id="faq-title">О Lunaria — коротко.</h2></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="home-final shell"><p className="eyebrow">Начните с любопытства</p><h2>Узнайте свою карту и начните разговор с Lunaria</h2><p>Один вопрос о себе может стать началом нового понимания.</p><Link className="button" to="/try-free">Создать натальную карту <span aria-hidden="true">↗</span></Link></section>
  </div>;
}
