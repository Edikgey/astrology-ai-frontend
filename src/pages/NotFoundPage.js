import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../components/UI';

export default function NotFoundPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Страница не найдена — Lunaria';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => { document.title = previous; robots.remove(); };
  }, []);
  return <section className="page">
    <PageHeading title="Страница не найдена">
      <p>Возможно, адрес набран с ошибкой или страница переехала. Вернитесь на главную и продолжите оттуда.</p>
    </PageHeading>
    <div className="button-row"><Link className="button" to="/">На главную</Link></div>
  </section>;
}
