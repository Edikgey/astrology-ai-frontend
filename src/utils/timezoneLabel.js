// Часовой пояс для человека: «Москва, UTC+3». Сырой идентификатор (Europe/Moscow) на экран не выводим.
// Смещение берём на дату рождения: исторически оно могло отличаться от нынешнего.
// Если названия или смещения нет (старый браузер, неизвестная зона), показываем то, что есть, а не идентификатор.
export function timezoneLabel(zone, at) {
  if (!zone) return '';
  const when = at instanceof Date && !Number.isNaN(at.getTime()) ? at : null;
  const part = (timeZoneName, date) => {
    try {
      return new Intl.DateTimeFormat('ru', { timeZone: zone, timeZoneName }).formatToParts(date)
        .find(item => item.type === 'timeZoneName')?.value || '';
    } catch { return ''; }
  };
  const name = part('longGeneric', when || new Date());
  const offset = when ? part('shortOffset', when).replace('GMT', 'UTC') : '';
  // Браузер может дописать «, стандартное время» (зависит от даты) — это шум, оставляем название.
  // У зон без русского названия он отдаёт «GMT+3» вместо имени; это не название.
  const clean = name.replace(/,\s*(стандартное|летнее) время$/i, '');
  return [/^GMT/.test(clean) ? '' : clean, offset].filter(Boolean).join(', ');
}
