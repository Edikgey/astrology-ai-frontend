import React from "react";
import { PageHeading } from "../components/UI";
import OwnChartPicker from "../components/OwnChartPicker";
import AskGptForm from "../components/AskGptForm";
import "./MyMonthPage.css";

// MY-MONTH-PAGE DESIGN §3: OwnChartPicker picks the chart; the month chat itself lives in AskGptForm view="month".
const DESCRIPTION = "Ближайшие 30 дней по вашей карте: любовь, работа, силы и то, на что стоит обратить внимание.";
const CHAT_TEXTS = {
  heading: "Обзор месяца",
  subtitle: "Строится по транзитам — тому, как планеты сейчас стоят относительно вашей карты. Обзор и ответы сохраняются в разговоре этой карты.",
  intro: "Соберу обзор ваших ближайших 30 дней: любовь и отношения, работа и деньги, силы и самочувствие, на что обратить внимание. Потом можно спросить подробнее.",
};

const PICKER_TEXTS = {
  signInHeading: "Войдите, чтобы увидеть свой месяц",
  signInText: "Обзор строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.",
  emptyText: "Обзор месяца строится по вашей натальной карте — это займёт минуту.",
};

export default function MyMonthPage() {
  return <div className="page my-month-page">
    <PageHeading title="Мой месяц"><p>{DESCRIPTION}</p></PageHeading>
    <OwnChartPicker prefix="my-month" returnTo="/my-month" texts={PICKER_TEXTS}>
      {chart => <AskGptForm chartId={chart.chart_id} view="month" {...CHAT_TEXTS} />}
    </OwnChartPicker>
  </div>;
}
