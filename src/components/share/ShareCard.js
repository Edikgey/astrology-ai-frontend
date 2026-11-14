import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DialogClose } from '../UI';
import { bigThree, canvasToBlob, cardDescription, drawShareCard, loadCardFonts } from './cardImage';
import './ShareCard.css';

const FILE_NAME = 'lunaria-bolshaya-troyka.png';
const EXPORT_ERROR = 'Не удалось подготовить картинку. Попробуйте ещё раз.';
const DRAW_ERROR = 'Не удалось подготовить картинку. Закройте окно и попробуйте ещё раз.';

function canShareFiles() {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([], FILE_NAME, { type: 'image/png' })] });
  } catch { return false; }
}

function SharePreview({ three, onClose }) {
  const dialog = useRef(null);
  const canvas = useRef(null);
  const drawn = useRef(false);
  const busy = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [canShare] = useState(canShareFiles);

  useEffect(() => {
    const element = dialog.current;
    let cancelled = false;
    if (typeof element?.showModal === 'function' && !element.open) element.showModal();
    loadCardFonts().then(() => {
      drawShareCard(canvas.current, three);
      drawn.current = true;
    }).catch(() => { if (!cancelled) setError(DRAW_ERROR); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [three]);

  // Close the native dialog first: while it is modal, the opener cannot take the focus back.
  const close = () => { if (dialog.current?.open) dialog.current.close?.(); onClose(); };

  // One export at a time: a second tap while the share sheet is open is ignored. Cancelling the sheet is not an error.
  const exportImage = action => async () => {
    if (busy.current) return;
    if (!drawn.current) { setError(DRAW_ERROR); return; }
    busy.current = true;
    setError('');
    try { await action(); } catch (err) { if (err?.name !== 'AbortError') setError(EXPORT_ERROR); } finally { busy.current = false; }
  };
  const download = exportImage(async () => {
    const url = URL.createObjectURL(await canvasToBlob(canvas.current));
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const share = exportImage(async () => {
    const file = new File([await canvasToBlob(canvas.current)], FILE_NAME, { type: 'image/png' });
    await navigator.share({ files: [file], text: 'Моя большая тройка — mylunariaai.com' });
  });

  return <dialog ref={dialog} className="share-card-dialog" aria-labelledby="share-card-title" onCancel={close}>
    <DialogClose onClose={close} />
    <h2 id="share-card-title">Карточка для сторис</h2>
    <p className="share-card-privacy">На картинке нет имени, даты, времени и места рождения.</p>
    <canvas ref={canvas} className="share-card-canvas" role="img" aria-label={cardDescription(three)} width="1080" height="1920" />
    <div className="share-card-actions">
      <button type="button" onClick={download} disabled={!ready}>Скачать картинку</button>
      {canShare && <button type="button" className="button-secondary" onClick={share} disabled={!ready}>Поделиться</button>}
    </div>
    {error && <p role="alert" className="share-card-error">{error}</p>}
  </dialog>;
}

// Share card with the big three. Reads signs from the already loaded chart; no requests, no analytics.
export default function ShareCard({ bodies, timeProvenance }) {
  const three = useMemo(() => bigThree(bodies, timeProvenance), [bodies, timeProvenance]);
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const closePreview = () => { setOpen(false); trigger.current?.focus(); };
  if (!three) return null;
  return <div className="share-card-entry">
    <button ref={trigger} type="button" className="button-secondary share-card-open" onClick={() => setOpen(true)}>Поделиться картой</button>
    {open && <SharePreview three={three} onClose={closePreview} />}
  </div>;
}
