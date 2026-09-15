import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as ChartPreview } from './landing-chart-preview.svg';
import PremiumPrice from '../components/PremiumPrice';
import { OrbitMark } from '../components/UI';
import { PLANS } from '../config/plans';
import '../components/natal/ChartWheel.css';
import './HomePage.css';

const followUps = [
  ['Почему меня тянет к таким людям?', 'Знакомое ощущение иногда кажется надёжным, даже когда приносит разочарование. Тема глубокой привязанности в этой карте помогает исследовать, что именно вас привлекает: сам человек, интенсивность чувств или надежда быть понятым.'],
  ['Что мне мешает доверять партнёру?', 'Доверие не обязательно возникает сразу. Через тему эмоциональной глубины этой карты можно посмотреть, в каких ситуациях вам особенно нужна ясность. Попробуйте отделить реальные действия партнёра от опасений, оставшихся после прошлого опыта.'],
  ['Какие отношения подходят мне больше?', 'В этой карте есть повод исследовать потребность в искренней, глубокой связи. Но карта не выбирает партнёра за вас. Полезная отправная точка — назвать, что помогает вам чувствовать себя спокойно и оставаться собой рядом с другим человеком.'],
];
const faqs = [
  ['Нужны ли мне знания астрологии?', 'Нет. Начните с обычного вопроса о том, что вас волнует. Lunaria связывает вашу ситуацию с картой и объясняет астрологические темы понятным языком.'],
  ['Что входит в бесплатный доступ?', `Карту можно создать без регистрации. Бесплатный аккаунт даёт до ${PLANS.free.chartLimit} сохранённых карт и ${PLANS.free.gptLimit} успешных AI-вопросов за всё время аккаунта.`],
  ['Сохраняет ли Lunaria мои карты и разговоры?', 'Да, в аккаунте сохраняются карты и история разговора для каждой из них. Откройте нужную карту в «Моих картах», чтобы вернуться к своей теме.'],
  ['Как Lunaria использует мою карту в разговоре?', 'Ответы опираются на рассчитанные положения и связи вашей карты, ваш вопрос и контекст диалога. Это помогает исследовать ситуацию с личной точки зрения, а не читать общий гороскоп.'],
  ['Чем Premium отличается от бесплатной версии?', `Premium даёт до ${PLANS.premium.chartLimit} сохранённых карт и ${PLANS.premium.gptLimit} AI-вопросов за оплаченный расчётный период. Лимит Free действует за всё время аккаунта. Подробности и текущая цена — на странице планов.`],
];

// Local demonstration only: no chat client, credentials or AI requests.
function ConversationDemo({ compact = false }) {
  const [selected, setSelected] = useState(null);
  const question = selected === null ? 'Почему у меня повторяются похожие проблемы в отношениях?' : followUps[selected][0];
  const answer = selected === null ? 'В этой карте Луна в Скорпионе — повод поговорить о глубине привязанности. Иногда желание близости соседствует со страхом оказаться уязвимым. Можно начать с того, что повторяется именно у вас: выбор партнёра, способ говорить о чувствах или реакция на дистанцию.' : followUps[selected][1];
  return <div className={`landing-demo${compact ? ' landing-demo-mini' : ''}`}>
    <div className="landing-demo-bar"><span><OrbitMark /> Lunaria</span><small>{compact ? 'Пример разговора' : 'Демонстрация · без запросов к AI'}</small></div>
    <div className="landing-demo-thread" aria-live={compact ? 'off' : 'polite'} aria-atomic="true">
      <p className="landing-bubble landing-bubble-user">{question}</p>
      <p className="landing-bubble">{compact ? 'Давайте посмотрим, что повторяется именно у вас — и что вам важно в близости. Ваша карта помогает исследовать эти темы в контексте вашей истории.' : answer}</p>
    </div>
    {compact ? <a className="landing-demo-teaser" href="#conversation-demo">От одного вопроса — к следующему <span aria-hidden="true">↗</span></a> : <>
      <div className="landing-demo-options" role="group" aria-label="Вопросы демонстрации">{followUps.map(([text], index) => <button key={text} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><span aria-hidden="true">↳ </span>{text}</button>)}</div>
      <p className="landing-demo-note">Выберите вопрос, чтобы посмотреть продолжение примера. В вашем разговоре ответы и подсказки будут персональными.</p>
    </>}
  </div>;
}

export default function HomePage() {
  return <div className="home-page landing-v2">
    <section className="landing-hero" aria-labelledby="landing-title"><div className="shell landing-hero-grid">
      <div className="landing-hero-copy"><p className="eyebrow">Ваша карта. Разговор о вас.</p><h1 id="landing-title">Lunaria — ваш персональный <span>AI-астролог</span></h1>
        <p className="landing-lead">Лучше поймите себя, разберитесь в отношениях и исследуйте то, что действительно вас волнует.</p><p className="landing-hero-support">Ваша натальная карта и контекст разговора помогают посмотреть на ситуацию глубже.</p>
        <div className="button-row"><Link className="button" to="/try-free">Создать мою карту <span aria-hidden="true">↗</span></Link><a className="landing-text-link" href="#how-it-works">Как это работает <span aria-hidden="true">↓</span></a></div><p className="landing-note">Карта без регистрации. Разговор и сохранение — в бесплатном аккаунте.</p>
      </div>
      <div className="landing-hero-product"><div className="landing-product-orbit" aria-hidden="true" /><ConversationDemo compact /><p className="landing-product-caption">Не готовый ответ на всю жизнь.<br />Место для вашего следующего вопроса.</p></div>
    </div></section>

    <section id="how-it-works" className="landing-section landing-process" aria-labelledby="how-title"><div className="shell">
      <div className="landing-section-intro"><p className="eyebrow">Начать проще, чем кажется</p><h2 id="how-title">Как это работает</h2></div>
      <ol className="landing-steps">
        <li><span className="landing-step-index" aria-hidden="true">01</span><h3>Ваши данные рождения</h3><p>Введите дату, время и место рождения.</p></li>
        <li><span className="landing-step-index" aria-hidden="true">02</span><h3>Ваша персональная карта</h3><p>Lunaria строит карту — основу для разговора о вас.</p></li>
        <li><span className="landing-step-index" aria-hidden="true">03</span><h3>Ваш настоящий вопрос</h3><p>Расскажите, что волнует. Уточняйте, возвращайтесь к важному, находите новые стороны темы.</p><Link to="/try-free">Начать с моей карты <span aria-hidden="true">↗</span></Link></li>
      </ol>
    </div></section>

    <section className="landing-section landing-situations" aria-labelledby="situations-title"><div className="shell landing-situations-grid">
      <div className="landing-section-intro"><p className="eyebrow">Для того, что важно сейчас</p><h2 id="situations-title">Когда хочется понять, что происходит</h2><p>Необязательно сразу находить точные слова. Начните с мысли, которая не отпускает.</p><span className="landing-editorial-mark" aria-hidden="true">?</span></div>
      <div className="landing-use-cases">
        <article className="landing-case landing-case-love"><span className="landing-case-symbol" aria-hidden="true">♡</span><div><h3>Отношения и любовь</h3><p>Замечайте повторяющиеся паттерны и лучше понимайте, что для вас значит близость.</p><blockquote>«Что мне действительно нужно от партнёра?»</blockquote></div></article>
        <article className="landing-case"><span className="landing-case-symbol" aria-hidden="true">◐</span><div><h3>Я и мои внутренние противоречия</h3><p>Исследуйте свои реакции, потребности и сильные стороны, которые привыкли недооценивать.</p><blockquote>«Почему я хочу перемен — и всё время сомневаюсь?»</blockquote></div></article>
        <article className="landing-case"><span className="landing-case-symbol" aria-hidden="true">↗</span><div><h3>Карьера и направление</h3><p>Посмотрите на свой рабочий стиль и на среду, в которой вам легче раскрыться.</p><blockquote>«Почему эта работа меня истощает?»</blockquote></div></article>
      </div>
    </div></section>

    <section id="conversation-demo" className="landing-section landing-conversation landing-dark" aria-labelledby="conversation-title"><div className="shell landing-split">
      <div className="landing-section-intro"><p className="eyebrow">Больше пространства для мысли</p><h2 id="conversation-title">Не просто прочитайте свою карту.<br /><em>Поговорите с ней.</em></h2><p>Задайте свой вопрос. Уточните ответ. Смените тему или вернитесь к предыдущей мысли — карта остаётся личным контекстом разговора.</p><p className="landing-conversation-path">Один ответ <span aria-hidden="true">→</span> следующий вопрос <span aria-hidden="true">→</span> глубже в тему</p><a className="landing-text-link" href="#chart-showcase">Что стоит за разговором <span aria-hidden="true">↓</span></a></div>
      <ConversationDemo />
    </div></section>

    <section id="chart-showcase" className="landing-section landing-chart-section" aria-labelledby="chart-title"><div className="shell landing-split">
      <figure className="landing-chart-visual"><div className="chart-preview"><div className="chart-v2 is-preview"><ChartPreview /></div></div><figcaption>Демонстрационная карта</figcaption></figure>
      <div className="landing-section-intro"><p className="eyebrow">Персональная точка отсчёта</p><h2 id="chart-title">Ваша карта — основа каждого разговора</h2><p>Lunaria рассматривает вопрос через вашу карту, а не только через знак зодиака.</p><p>Планеты, дома, аспекты и углы ASC/MC складываются в систему взаимосвязей. В разговоре это становится поводом исследовать ваши реакции, стремления и привычные сценарии.</p><Link className="landing-text-link" to="/try-free">Посмотреть мою карту <span aria-hidden="true">↗</span></Link></div>
    </div></section>

    <section className="landing-section landing-memory" aria-labelledby="memory-title"><div className="shell landing-split">
      <div className="landing-section-intro"><p className="eyebrow">Можно вернуться к важному</p><h2 id="memory-title">Разговор, который не начинается заново</h2><p>Карты и история сохраняются в аккаунте. Откройте ту же карту, чтобы продолжить тему с учётом предыдущего разговора.</p><p className="landing-note">Lunaria учитывает недавние сообщения и краткий контекст прошлой беседы. Важные детали всегда можно напомнить.</p></div>
      <div className="landing-continuity" aria-label="Иллюстрация продолжения разговора"><div><span>Первый разговор</span><p>«Мне сложно решиться на смену работы»</p></div><div><span>Уточнение</span><p>«Кажется, мне не хватает самостоятельности»</p></div><div><span>Когда вернётесь</span><p>«Давай продолжим про самостоятельность. Я заметила кое-что ещё…»</p></div></div>
    </div></section>

    <section className="landing-section landing-journey" aria-labelledby="journey-title"><div className="shell"><div className="landing-section-intro"><p className="eyebrow">Ваш темп. Ваши решения.</p><h2 id="journey-title">От «что со мной происходит?»<br />к более ясному вопросу</h2><p>Lunaria помогает увидеть другие стороны ситуации. Куда двигаться дальше, решаете вы.</p></div><ol className="landing-journey-track"><li><span>Что-то беспокоит</span><p>Вы рассказываете о своей ситуации.</p></li><li><span>Появляется другой взгляд</span><p>Lunaria рассматривает её через вашу карту.</p></li><li><span>Вопрос становится глубже</span><p>Вы замечаете новую тему и продолжаете разговор.</p></li></ol></div></section>

    <section className="landing-section landing-pricing" aria-labelledby="plans-title"><div className="shell"><div className="landing-section-intro"><p className="eyebrow">Место для ваших открытий</p><h2 id="plans-title">Начните бесплатно.<br />Продолжайте в своём темпе.</h2></div><div className="landing-plan-grid">
      <article className="landing-plan"><p className="eyebrow">Первое знакомство</p><h3>Free</h3><p className="landing-free-price">Бесплатно</p><ul><li>До {PLANS.free.chartLimit} сохранённых карт</li><li>{PLANS.free.gptLimit} AI-вопросов за всё время аккаунта</li><li>История разговора для каждой карты</li></ul><Link className="button button-secondary" to="/try-free">Начать бесплатно <span aria-hidden="true">↗</span></Link></article>
      <article className="landing-plan landing-plan-premium"><p className="eyebrow">Для глубокого разговора</p><h3>Premium</h3><PremiumPrice /><ul><li>До {PLANS.premium.chartLimit} сохранённых карт</li><li>{PLANS.premium.gptLimit} AI-вопросов за расчётный период</li><li>Больше пространства для уточнений</li></ul><Link className="button" to="/pricing">Подробнее о Premium <span aria-hidden="true">↗</span></Link></article>
    </div><p className="landing-pricing-note">Считаются успешные AI-ответы. Удаление карты или истории не возвращает вопросы. <Link to="/pricing">Все условия планов</Link></p></div></section>

    <section className="landing-section landing-faq" aria-labelledby="faq-title"><div className="shell landing-faq-grid"><div className="landing-section-intro"><p className="eyebrow">Перед первым разговором</p><h2 id="faq-title">Остались вопросы?</h2></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>

    <section className="landing-section landing-final landing-dark" aria-labelledby="final-title"><div className="shell"><OrbitMark /><p className="eyebrow">Начните с любопытства</p><h2 id="final-title">Узнайте, что ваша карта может рассказать именно о вас</h2><p>Создайте карту и начните персональный разговор — с вопроса, который важен вам сейчас.</p><Link className="button" to="/try-free">Создать мою карту <span aria-hidden="true">↗</span></Link><small>Пространство для саморефлексии. Решения остаются за вами.</small></div></section>
  </div>;
}
