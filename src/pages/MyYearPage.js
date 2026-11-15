import React from "react";
import ChartReadingPage from "../components/ChartReadingPage";
import { ASPECT_TYPES, SIGNS, SIGNS_IN } from "../components/natal/model";
import {
  ASCENDANT_TONES, ASPECT_TONES, HOUSE_SPHERES, MOON_SIGN_PHRASES, POINT_GENITIVES, SUN_HOUSE_PHRASES,
} from "../components/solar/meanings";
import "./MyYearPage.css";

// SOLAR-1 DESIGN §6: sign-in and chart choice live in ChartReadingPage; the year itself is a read-only GET without AI or
// quota (§3). The server decides access and the year; the page only turns codes into words.
const DESCRIPTION = "Карта года от вашего дня рождения: когда начался год и какие темы в нём главные.";
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// "2027-03-10" + "11:30" → «10 марта 2027 в 11:30». Built from the string: new Date("…") would shift the day by the browser zone.
function moment({ date, time }) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year} в ${time}`;
}

// The Sun goes the whole circle and comes back to the point where it stood at birth: that return opens the year.
function SunReturn() {
  return <svg className="year-orbit" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle className="year-orbit-track" cx="60" cy="60" r="46" />
    <path className="year-orbit-path" d="M64.8 14.25A46 46 0 1 1 55.2 14.25" />
    <path className="year-orbit-head" d="M51 10.5L57.2 14.25L51.6 18.8" />
    <circle className="year-orbit-sun" cx="60" cy="14" r="7" />
    <circle className="year-orbit-birth" cx="60" cy="60" r="3" />
    <line className="year-orbit-ray" x1="60" y1="57" x2="60" y2="24" />
  </svg>;
}

const SAME_SPHERE = "та же сфера, что у Солнца года: она в центре этого года.";
const aspectLine = item => `${ASPECT_TYPES[item.aspect].name} ${POINT_GENITIVES[item.a]} и ${POINT_GENITIVES[item.b]}`;

function YearView({ data: year, sentZone }) {
  const first = year.aspects[0];
  const overview = [
    ASCENDANT_TONES[year.ascendant_sign],
    SUN_HOUSE_PHRASES[year.sun_house - 1],
    MOON_SIGN_PHRASES[year.moon_sign],
    first && ASPECT_TONES[ASPECT_TYPES[first.aspect].family],
  ].filter(Boolean).join(" ");
  return <div className="year-view">
    <section className="year-span">
      <SunReturn />
      <p className="year-span-text">
        <span className="year-span-start">Ваш год начался <time dateTime={year.start.date}>{moment(year.start)}</time>.</span>{" "}
        <span className="year-span-next">Следующий начнётся <time dateTime={year.next.date}>{moment(year.next)}</time>.</span>
      </p>
    </section>
    <section className="year-themes">
      <h2>Главные темы</h2>
      <ul className="year-theme-list">
        <li><b>Асцендент года — {SIGNS[year.ascendant_sign]}</b> <span>{ASCENDANT_TONES[year.ascendant_sign]}</span></li>
        <li><b>Солнце года — в {year.sun_house}-м доме:</b> {HOUSE_SPHERES[year.sun_house - 1]}</li>
        <li><b>Луна года — в {SIGNS_IN[year.moon_sign]}, в {year.moon_house}-м доме:</b> {year.moon_house === year.sun_house ? SAME_SPHERE : HOUSE_SPHERES[year.moon_house - 1]}</li>
      </ul>
      <h3>Сильные аспекты</h3>
      {year.aspects.length ? <ol className="year-aspects">
        {year.aspects.map(item => <li key={`${item.a}${item.aspect}${item.b}`}>{aspectLine(item)}</li>)}
      </ol> : <p className="year-quiet">В этом году тесных аспектов нет.</p>}
    </section>
    <section className="year-overview">
      <h2>Обзор года</h2>
      <p>{overview}</p>
    </section>
    <div className="year-footnotes">
      <p>{sentZone && year.timezone === sentZone ? "Время — по часовому поясу вашего устройства." : "Время — по часовому поясу места рождения."}</p>
      <p>Карта года построена для места рождения.</p>
      <p>Асцендент, дома и аспекты к Асценденту и Середине неба зависят от точного времени рождения.</p>
      <p>Год начинается, когда Солнце возвращается туда, где было при вашем рождении, — на день раньше или позже дня рождения это нормально.</p>
    </div>
  </div>;
}

const TEXTS = {
  signInHeading: "Войдите, чтобы увидеть свой год",
  signInText: "Карта года строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.",
  emptyText: "Карта года строится по вашей натальной карте — это займёт минуту.",
  loadingReading: "Строим карту года...",
};

export default function MyYearPage() {
  return <ChartReadingPage prefix="year" returnTo="/my-year" endpoint="solar-return" View={YearView} texts={TEXTS}
    title="Мой год" description={DESCRIPTION} />;
}
