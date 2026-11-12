// Часовой пояс рождения для человека: «UTC+4», смещение на дату рождения (исторически оно могло отличаться от нынешнего).
// Название зоны не показываем: ICU называет группу зон («Москва» для Киева 1985 или Минска), а не место рождения.
// Нет даты, зоны или смещения — возвращаем пустую строку, и строку на экране не рисуем.
export function timezoneLabel(zone, at) {
  if (!zone || !(at instanceof Date) || Number.isNaN(at.getTime())) return '';
  try {
    const offset = new Intl.DateTimeFormat('ru', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(at)
      .find(item => item.type === 'timeZoneName')?.value || '';
    return offset.replace('GMT', 'UTC');
  } catch { return ''; }
}
