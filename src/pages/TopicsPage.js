import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeading } from "../components/UI";
import OwnChartPicker from "../components/OwnChartPicker";
import AskGptForm from "../components/AskGptForm";
import "./MyMonthPage.css";
import "./TopicsPage.css";

// TOPICS-1 DESIGN §3.1: OwnChartPicker picks the chart, the page picks the topic; the reading itself lives in AskGptForm view="topic".
// The question texts are the server's markers (DESIGN §2.1, TOPIC_QUESTIONS): change them only together with the backend.
const DESCRIPTION = "Готовый разбор вашей натальной карты по одной теме — по планетам и домам. Разбор сохраняется, его можно перечитать.";
const TOPICS = [
  { key: "career", label: "Призвание и работа", question: "Призвание и работа: разбор моей карты",
    line: "Какие занятия и условия работы вам подходят, ваши сильные стороны и что может мешать." },
  { key: "money", label: "Деньги", question: "Деньги: разбор моей карты",
    line: "Как вы зарабатываете, тратите и бережёте деньги — склонности и стиль, без советов по вложениям." },
  { key: "love", label: "Любовь", question: "Любовь: разбор моей карты",
    line: "Что для вас важно в любви, как вы проявляете чувства и каким видите партнёра." },
];
const CHAT_TEXTS = {
  subtitle: "Разбор сохраняется в разговоре этой карты.",
  intro: "Соберу разбор вашей карты по этой теме — по планетам, домам и аспектам.",
};

const PICKER_TEXTS = {
  signInHeading: "Войдите, чтобы получить разбор",
  signInText: "Разбор строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.",
  emptyText: "Разбор строится по вашей натальной карте — это займёт минуту.",
};

export default function TopicsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Only one of the three topics reaches the server; a chart change keeps the chosen topic.
  const topic = TOPICS.find(item => item.key === searchParams.get("topic")) || TOPICS[0];
  return <div className="page my-month-page topics-page">
    <PageHeading title="Разборы по темам"><p>{DESCRIPTION}</p></PageHeading>
    <OwnChartPicker prefix="my-month" returnTo="/topics" texts={PICKER_TEXTS} params={{ topic: topic.key }}>
      {chart => <>
        <div className="topics-choice" role="group" aria-label="Тема разбора">
          {TOPICS.map(item => <button key={item.key} type="button" aria-pressed={item.key === topic.key}
            onClick={() => setSearchParams({ chart: String(chart.chart_id), topic: item.key }, { replace: true })}>{item.label}</button>)}
        </div>
        <p className="topics-line">{topic.line}
          {topic.key === "love" && <> <Link to="/relationships/new">Совместимость с конкретным человеком — в разборе отношений</Link></>}
        </p>
        <p className="topics-accuracy">Дома карты зависят от точного времени рождения. Если время было примерным, части о домах могут не совпасть.</p>
        <AskGptForm chartId={chart.chart_id} view="topic" topicQuestion={topic.question} heading={topic.label} {...CHAT_TEXTS} />
      </>}
    </OwnChartPicker>
  </div>;
}
