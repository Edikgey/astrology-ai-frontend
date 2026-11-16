import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

// Title and description of every route of App.js. `open` = reachable without signing in and shows no personal data:
// only such pages get their own description and a line in public/sitemap.xml. Closed pages get a title only
// and are covered by Disallow in public/robots.txt. Unknown addresses are left to NotFoundPage (its title and noindex).
export const PAGES = [
  { path: '/', open: true, title: 'Lunaria — Ваша карта. Разговор о вас.',
    description: 'Lunaria — ваша натальная карта и персональный AI-астролог. Задавайте вопросы, продолжайте разговор и сохраняйте свои открытия.' },
  { path: '/try-free', open: true, title: 'Натальная карта онлайн — Lunaria',
    description: 'Введите дату, время и место рождения — Lunaria построит вашу натальную карту и объяснит её простыми словами.' },
  { path: '/pricing', open: true, title: 'Тарифы — Lunaria',
    description: 'Бесплатный план и Premium: сколько карт и вопросов AI-астрологу входит в каждый.' },
  { path: '/moon', open: true, title: 'Луна сегодня — Lunaria',
    description: 'Фаза и знак Луны на сегодня и то, как она касается вашей карты.' },
  { path: '/my-year', open: true, title: 'Мой год — Lunaria',
    description: 'Карта года от вашего дня рождения: когда начался год и какие темы в нём главные.' },
  { path: '/my-month', open: true, title: 'Мой месяц — Lunaria',
    description: 'Ближайшие 30 дней по вашей карте: любовь, работа, силы и то, на что стоит обратить внимание.' },
  { path: '/topics', open: true, title: 'Разборы по темам — Lunaria',
    description: 'Готовый разбор вашей натальной карты по одной теме: призвание и работа, деньги, любовь.' },
  { path: '/terms', open: true, title: 'Условия использования — Lunaria',
    description: 'Как устроен Lunaria, что входит в подписку и как управлять продлением.' },
  { path: '/privacy', open: true, title: 'Политика конфиденциальности — Lunaria',
    description: 'Какие данные нужны Lunaria и как они используются при работе сервиса.' },
  { path: '/refunds', open: true, title: 'Возвраты и отмена — Lunaria',
    description: 'Куда обратиться по платежу и чем возврат отличается от отключения продления.' },
  { path: '/support', open: true, title: 'Поддержка — Lunaria',
    description: 'Поможем разобраться с аккаунтом, работой сервиса, подпиской или вопросами о данных.' },
  { path: '/authorization', open: false, title: 'Вход — Lunaria' },
  { path: '/reset-password', open: false, title: 'Новый пароль — Lunaria' },
  { path: '/my-charts', open: false, title: 'Мои карты — Lunaria' },
  { path: '/natal-chart-result', open: false, title: 'Ваша натальная карта — Lunaria' },
  { path: '/natal-chart-result/:chartId', open: false, title: 'Ваша натальная карта — Lunaria' },
  { path: '/relationships/new', open: false, title: 'Разбор отношений — Lunaria' },
  { path: '/relationships/:relationshipId', open: false, title: 'Разбор отношений — Lunaria' },
];

// Sets the title (and, for open pages, the description) while the route is shown and puts the previous ones back on leaving.
export function useRouteMeta() {
  const { pathname } = useLocation();
  const page = PAGES.find(item => matchPath(item.path, pathname));
  const title = page?.title;
  const description = page?.open ? page.description : undefined;
  useEffect(() => {
    if (!title) return undefined;
    const previousTitle = document.title;
    const tag = document.head.querySelector('meta[name="description"]');
    const previousDescription = tag?.getAttribute('content');
    document.title = title;
    if (tag && description) tag.setAttribute('content', description);
    return () => {
      document.title = previousTitle;
      if (tag && description) {
        if (previousDescription === null) tag.removeAttribute('content');
        else tag.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}
