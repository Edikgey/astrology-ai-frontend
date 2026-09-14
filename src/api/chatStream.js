import { apiError } from './apiError';

// POST SSE keeps the existing JWT and request body. Decode complete event frames,
// never partial model JSON; the backend sends only answer text deltas.
export async function readChatResponse(response, onDelta) {
  if (!response.headers?.get('content-type')?.includes('text/event-stream')) return response.json();
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Поток ответа недоступен. Обновите историю перед повторной отправкой.');
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.type === 'delta' && typeof event.text === 'string') onDelta(event.text);
        if (event.type === 'error') throw apiError(event.status || 502, { detail: event.detail });
        if (event.type === 'done') {
          if (typeof event.response !== 'string' || !event.response.trim()) throw new Error('AI не вернул завершённый ответ.');
          return event;
        }
      }
      if (done) throw new Error('Соединение прервалось. История будет обновлена; проверьте её перед повторной отправкой.');
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
