import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as ChartPreview } from './landing-chart-preview.svg';
import { ReactComponent as SynastryPreview } from './landing-synastry-preview.svg';
import { OrbitMark } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useUsage } from '../context/UsageContext';
import { LANDING_USE_CASES, LANDING_RELATIONSHIP_INTENT, landingIntent } from './landingIntent';
import '../components/natal/ChartWheel.css';
import '../components/synastry/SynastryChart.css';
import './HomePage.css';

const demoBranches = [
  ['Меня привлекают похожие люди', 'Тогда можно внимательнее посмотреть не только на качества этих людей, но и на знакомое чувство, которое возникает рядом с ними. Что обычно привлекает вас в самом начале: интенсивность, ощущение близости или желание быть понятой?'],
  ['Мне сложно доверять', 'Недоверие может быть способом защитить важную для вас эмоциональную глубину. В каких ситуациях оно возникает сильнее: когда человек отдаляется, когда становится слишком близко или когда вам не хватает ясности?'],
  ['Я отдаляюсь, когда становится серьёзно', 'Возможно, близость одновременно важна для вас и делает уязвимой. Что чаще появляется перед желанием отдалиться: тревога, потеря свободы или сомнение в чувствах другого человека?'],
];

function ArrowIcon() {
  return <svg className="landing-arrow" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6h15M11 1l5 5-5 5" /></svg>;
}

function CreationLink({ className = '', children }) {
  return <Link className={className} to="/try-free">{children} <ArrowIcon /></Link>;
}

function ConversationDemo({ compact = false }) {
  const [selected, setSelected] = useState(null);
  return <div className={`landing-demo${compact ? ' landing-demo-mini' : ''}`}>
    <div className="landing-demo-bar"><span><OrbitMark /> Lunaria</span><small>{compact ? 'Пример разговора' : 'Демонстрация · без запросов к AI'}</small></div>
    <div className="landing-demo-thread" aria-live={compact ? 'off' : 'polite'}>
      <div className="landing-message landing-message-user"><span>Вы</span><p>Почему у меня повторяются похожие проблемы в отношениях?</p></div>
      <div className="landing-message"><span>Lunaria</span><p>{compact
        ? 'Карта становится отправной точкой для вопроса о близости, доверии и вашем реальном опыте.'
        : 'В этой карте Луна в Скорпионе может быть интересной отправной точкой для разговора о близости и доверии. Но сама карта не расскажет, что именно повторяется в вашей жизни.\n\nЧто вам знакомо больше: вас привлекают похожие люди, становится сложно доверять или хочется отдалиться, когда отношения становятся серьёзнее?'}</p></div>
      {!compact && selected !== null && <>
        <div className="landing-message landing-message-user landing-demo-next"><span>Вы</span><p>{demoBranches[selected][0]}</p></div>
        <div className="landing-message landing-demo-next"><span>Lunaria</span><p>{demoBranches[selected][1]}</p></div>
      </>}
    </div>
    {!compact && <>
      <div className="landing-demo-options" role="group" aria-label="Продолжения демонстрации">{demoBranches.map(([text], index) => <button key={text} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{text} <ArrowIcon /></button>)}</div>
      <div className="landing-demo-cta"><p>Хотите задать такой вопрос на основе своей карты?</p><CreationLink className="button">Создать мою карту</CreationLink></div>
    </>}
  </div>;
}

export default function HomePage() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const needsFirstChart = !user || usage?.saved_charts_used === 0;
  const relationshipRoute = needsFirstChart ? '/try-free' : '/relationships/new';
  const relationshipState = needsFirstChart ? {
    landingRelationshipIntent: LANDING_RELATIONSHIP_INTENT,
    ...(user ? { returnTo: '/relationships/new' } : {}),
  } : undefined;
  return <div className="home-page landing-v2">
    <section className="landing-hero" aria-labelledby="landing-title"><div className="shell landing-hero-grid">
      <div className="landing-hero-copy"><p className="eyebrow">Персональный AI-астролог</p><h1 id="landing-title">Не просто прочитайте свою натальную карту.<br /><span>Поговорите с ней.</span></h1>
        <p className="landing-lead">Lunaria использует вашу натальную карту как основу разговора, чтобы вы могли задавать вопросы об отношениях, работе, внутренних противоречиях и других важных для вас темах.</p>
        <div className="button-row"><CreationLink className="button">Создать мою карту</CreationLink><a className="landing-text-link" href="#conversation-demo">Посмотреть пример разговора <span aria-hidden="true">↓</span></a></div>
        <p className="landing-note">Карта бесплатно и без регистрации. Аккаунт понадобится только для сохранения разговоров.</p>
      </div>
      <div className="landing-hero-product"><div className="landing-product-orbit" aria-hidden="true" /><ConversationDemo compact /></div>
    </div></section>

    <section id="conversation-demo" className="landing-section landing-conversation" aria-labelledby="conversation-title"><div className="shell landing-split">
      <div className="landing-section-intro"><p className="eyebrow">Как выглядит разговор</p><h2 id="conversation-title">Начните с вопроса, который действительно вас волнует</h2></div><ConversationDemo />
    </div></section>

    <section id="how-it-works" className="landing-section landing-process" aria-labelledby="how-title"><div className="shell">
      <div className="landing-section-intro"><p className="eyebrow">Как это работает</p><h2 id="how-title">От вашей карты до первого вопроса — три шага</h2></div>
      <ol className="landing-steps"><li><span className="landing-step-index">01</span><h3>Укажите данные рождения</h3><p>Дата, время и место нужны, чтобы построить натальную карту.</p></li><li><span className="landing-step-index">02</span><h3>Получите свою карту</h3><p>Lunaria использует её как основу для дальнейших разговоров.</p></li><li><span className="landing-step-index">03</span><h3>Задайте свой вопрос</h3><p>Начните с того, что волнует сейчас, а затем уточняйте ответы и продолжайте тему.</p></li></ol>
      <div className="landing-process-action"><CreationLink className="button">Создать мою карту</CreationLink><span>Без регистрации</span></div>
    </div></section>

    <section className="landing-section landing-relationships" aria-labelledby="relationships-title"><div className="shell landing-relationship-grid">
      <div className="landing-section-intro"><p className="eyebrow">Отношения</p><h2 id="relationships-title">Две карты. Один разговор о ваших отношениях.</h2>
        <p>Добавьте карту другого человека — Lunaria сопоставит две натальные карты и поможет исследовать динамику между вами: притяжение, различия, повторяющиеся конфликты и то, как вы понимаете друг друга.</p>
        <ul className="landing-relationship-questions">
          <li>Почему нас так сильно тянет друг к другу?</li>
          <li>Почему мы снова спорим об одном и том же?</li>
          <li>В чём мы понимаем друг друга лучше всего?</li>
        </ul>
        <Link className="button landing-relationship-cta" to={relationshipRoute} state={relationshipState}>Разобрать отношения <ArrowIcon /></Link>
      </div>
      <div className="landing-relationship-preview" role="img" aria-label="Демонстрация карты взаимодействия Анны и Максима: две натальные карты и несколько межкартовых аспектов">
        <div className="landing-relationship-preview-head"><OrbitMark /><div><strong>Карта взаимодействия</strong><span>Две карты · межкартовые аспекты</span></div></div>
        <div className="landing-relationship-legend"><span><i aria-hidden="true" />Анна · внутренний круг</span><span><i aria-hidden="true" />Максим · внешний круг</span></div>
        <div className="landing-relationship-wheel synastry-chart"><SynastryPreview /></div>
        <p>Демонстрационный пример на вымышленных данных</p>
      </div>
    </div></section>

    <section className="landing-section landing-situations" aria-labelledby="situations-title"><div className="shell"><div className="landing-section-intro"><p className="eyebrow">О чём можно спросить</p><h2 id="situations-title">С какого вопроса вы бы начали?</h2></div>
      <div className="landing-use-cases">{LANDING_USE_CASES.map(useCase => <article className="landing-case" key={useCase.topic}><p className="eyebrow">{useCase.label}</p><Link className="landing-case-question" to="/try-free" state={{ landingIntent: landingIntent(useCase) }}>{useCase.question} <ArrowIcon /></Link><p>{useCase.description}</p></article>)}</div>
    </div></section>

    <section className="landing-section landing-difference" aria-labelledby="difference-title"><div className="shell landing-split"><div className="landing-section-intro"><p className="eyebrow">Больше, чем готовый разбор</p><h2 id="difference-title">Одна карта — множество вопросов</h2><p>Обычный разбор заканчивается текстом. В Lunaria после ответа можно уточнить непонятное, углубиться в тему или перейти к следующему вопросу.</p><p>Создайте карту один раз — Lunaria будет учитывать её в следующих разговорах.</p></div><div className="landing-conversation-preview" aria-label="Пример разговора на основе натальной карты"><div className="landing-preview-context"><OrbitMark /><div><strong>Ваша натальная карта</strong><span>Контекст для разговора</span></div></div><div className="landing-preview-thread"><div className="landing-preview-question"><span>Вы</span><p>Почему мне так сложно решиться на перемены?</p></div><div className="landing-preview-answer"><span>Lunaria</span><p>Карта может помочь заметить напряжение между потребностью в стабильности и желанием действовать самостоятельно. А что в предстоящих переменах тревожит вас сильнее всего?</p></div></div><div className="landing-preview-follow-ups"><span>Продолжить</span><ul><li>Что именно меня останавливает?</li><li>Как отличить страх от сомнения?</li><li>Где этот конфликт проявляется сильнее?</li></ul></div></div></div></section>

    <section id="chart-showcase" className="landing-section landing-chart-section" aria-labelledby="chart-title"><div className="shell landing-split"><figure className="landing-chart-visual"><div className="chart-preview"><div className="chart-v2 is-preview"><ChartPreview /></div></div><figcaption>Демонстрационная карта</figcaption></figure><div className="landing-section-intro"><p className="eyebrow">Ваша натальная карта</p><h2 id="chart-title">Персональная точка отсчёта для разговора</h2><p>Lunaria учитывает положение планет, дома, аспекты и другие элементы натальной карты, когда отвечает на ваши вопросы.</p><p>Карта не определяет вас и не даёт готовых ответов — она становится отправной точкой для исследования интересующей вас темы.</p><CreationLink className="landing-text-link">Посмотреть мою карту</CreationLink></div></div></section>

    <section className="landing-section landing-memory" aria-labelledby="memory-title"><div className="shell landing-split"><div className="landing-section-intro"><p className="eyebrow">Продолжите, когда захотите</p><h2 id="memory-title">Вернитесь к разговору с того места, где остановились</h2><p>Бесплатный аккаунт позволяет сохранить карту и историю разговоров, чтобы позже продолжить предыдущую тему или начать новую.</p></div><div className="landing-continuity" aria-label="Пример продолжения разговора"><div><span>Первый вопрос</span><p>Почему мне так сложно решиться на смену работы?</p></div><div><span>Продолжение</span><p>Кажется, дело не только в работе. Мне вообще сложно выбирать, когда нет гарантии.</p></div><div><span>Когда вернётесь</span><p>Хотите продолжить тему выбора или посмотреть, что именно делает неопределённость такой сложной для вас?</p></div></div></div></section>

    <section className="landing-section landing-final landing-dark" aria-labelledby="final-title"><div className="shell"><OrbitMark /><p className="eyebrow">Начните со своего вопроса</p><h2 id="final-title">Что вы хотели бы спросить о себе прямо сейчас?</h2><p>Создайте натальную карту и начните разговор с Lunaria.</p><CreationLink className="button">Создать мою карту</CreationLink><small>Карта бесплатно и без регистрации</small></div></section>
  </div>;
}
