import React from "react";
import ChartReadingPage from "../components/ChartReadingPage";
import { ASPECT_TYPES, SIGNS_IN } from "../components/natal/model";
import { PHASE_TEXTS, POINT_MEANINGS, SIGN_ADVICE, TONE_ADVICE } from "../components/moon/meanings";
import "./MoonTodayPage.css";

// LUNAR-1 DESIGN §6: sign-in and chart choice live in ChartReadingPage; the day itself is a read-only GET without AI (§3),
// the server decides access and the day; the page only turns codes into words.
const DESCRIPTION = "Фаза и знак Луны на сегодня и то, как она касается вашей карты.";
const WAXING = new Set(["new_moon", "waxing_crescent", "first_quarter", "waxing_gibbous"]);
// Main aspect of the day: the point of the smallest group wins (ai_chart_context.py POINT_GROUPS), then the earlier one —
// the server already sends aspects in time order; "HH:MM" strings are not compared (a 25-hour day has "01:30" twice).
const POINT_GROUP = { "☉": 0, "☽": 0, AS: 0, MC: 0, "☿": 1, "♀": 1, "♂": 1, "♃": 2, "♄": 2, "♅": 3, "♆": 3, "♇": 3 };
const percent = value => `${value} %`;

// Lit part of the disc as seen from the Northern hemisphere: a waxing Moon is lit on the right.
function MoonPicture({ code, illumination, label }) {
  const lit = Math.min(Math.max(illumination / 100, 0), 1);
  const waxing = WAXING.has(code);
  const rx = (50 * Math.abs(1 - 2 * lit)).toFixed(2);
  const terminatorSweep = waxing === (lit > 0.5) ? 1 : 0;
  const path = `M60 10A50 50 0 0 ${waxing ? 1 : 0} 60 110A${rx} 50 0 0 ${terminatorSweep} 60 10Z`;
  return <svg className="moon-picture" viewBox="0 0 120 120" role="img" aria-label={label}>
    <circle className="moon-picture-dark" cx="60" cy="60" r="50" />
    {lit >= 0.995 ? <circle className="moon-picture-lit" cx="60" cy="60" r="50" /> :
      lit > 0.005 && <path className="moon-picture-lit" d={path} />}
    <circle className="moon-picture-rim" cx="60" cy="60" r="50" />
  </svg>;
}

function mainAspect(aspects) {
  return aspects.reduce((best, item) => !best || (POINT_GROUP[item.point] ?? 9) < (POINT_GROUP[best.point] ?? 9) ? item : best, null);
}

function DayView({ data: day, sentZone }) {
  const phase = PHASE_TEXTS[day.phase.code];
  const { index, ingress } = day.sign;
  // Advice follows the sign at local noon: a change before 12:00 already counts.
  const noonSign = ingress && ingress.at < "12:00" ? ingress.index : index;
  const main = mainAspect(day.aspects);
  const signLine = `Луна в ${SIGNS_IN[index]}${ingress ? `, с ${ingress.at} — в ${SIGNS_IN[ingress.index]}` : ""}`;
  return <div className="moon-day">
    <section className="moon-sky">
      <MoonPicture code={day.phase.code} illumination={day.phase.illumination}
        label={`${phase.name}, освещено ${percent(day.phase.illumination)}`} />
      <div className="moon-sky-text">
        <h2>{day.phase.exact_at ? `${phase.name} в ${day.phase.exact_at}` : phase.name}</h2>
        <p className="moon-light">Освещено {percent(day.phase.illumination)}</p>
        <p className="moon-sign">{signLine}</p>
      </div>
    </section>
    <section className="moon-advice">
      <h2>Совет на день</h2>
      <p>{phase.advice} {SIGN_ADVICE[noonSign]}</p>
      {main && <p>{POINT_MEANINGS[main.point].theme} {TONE_ADVICE[ASPECT_TYPES[main.aspect].family]}</p>}
    </section>
    <section className="moon-aspects">
      <h2>Луна и ваша карта</h2>
      {day.aspects.length ? <ol>
        {day.aspects.map(item => <li key={`${item.at}${item.aspect}${item.point}`}>
          <time>{item.at}</time> — {ASPECT_TYPES[item.aspect].name} Луны и {POINT_MEANINGS[item.point].genitive}
        </li>)}
      </ol> : <p>Сегодня Луна не образует аспектов к вашей карте.</p>}
    </section>
    <div className="moon-footnotes">
      <p>{sentZone && day.timezone === sentZone ? "Время — по часовому поясу вашего устройства." : "Время — по часовому поясу места рождения."}</p>
      <p>Аспекты к Луне, Асценденту и Середине неба зависят от точного времени рождения.</p>
    </div>
  </div>;
}

const TEXTS = {
  signInHeading: "Войдите, чтобы увидеть свою Луну",
  signInText: "Луна на сегодня считается по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.",
  emptyText: "Луна на сегодня считается по вашей натальной карте — это займёт минуту.",
  loadingReading: "Считаем Луну...",
};

export default function MoonTodayPage() {
  return <ChartReadingPage prefix="moon" returnTo="/moon" endpoint="moon-day" View={DayView} texts={TEXTS}
    title="Луна сегодня" description={DESCRIPTION} />;
}
