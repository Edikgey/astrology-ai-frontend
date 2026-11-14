import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DialogClose } from '../UI';
import { bigThree, canvasToBlob, cardDescription, drawShareCard, loadCardFonts } from './cardImage';
import './ShareCard.css';

const FILE_NAME = 'lunaria-bolshaya-troyka.png';
const EXPORT_ERROR = 'Не удалось подготовить картинку. Попробуйте ещё раз.';

function canShareFiles() {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([], FILE_NAME, { type: 'image/png' })] });
  } catch { return false; }
}

function SharePreview({ three, onClose }) {
  const dialog = useRef(null);
  const canvas = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [canShare] = useState(canShareFiles);

  useEffect(() => {
    const element = dialog.current;
    let cancelled = false;
    if (typeof element?.showModal === 'function' && !element.open) element.showModal();
    loadCardFonts().then(() => {
      if (cancelled) return;
      drawShareCard(canvas.current, three);
      setReady(true);
    });
    // close() hands the focus back to the button that opened the preview.
    return () => { cancelled = true; if (element?.open) element.close?.(); };
  }, [three]);

  const download = async () => {
    setError('');
    try {
      const url = URL.createObjectURL(await canvasToBlob(canvas.current));
      const link = document.createElement('a');
      link.href = url;
      link.download = FILE_NAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(EXPORT_ERROR); }
  };
  const share = async () => {
    setError('');
    try {
      const file = new File([await canvasToBlob(canvas.current)], FILE_NAME, { type: 'image/png' });
      await navigator.share({ files: [file], text: 'Моя большая тройка — mylunariaai.com' });
    } catch (err) {
      if (err?.name !== 'AbortError') setError(EXPORT_ERROR);
    }
  };

  return <dialog ref={dialog} className="share-card-dialog" aria-labelledby="share-card-title" onCancel={onClose}>
    <DialogClose onClose={onClose} />
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
  if (!three) return null;
  return <div className="share-card-entry">
    <button type="button" className="button-secondary share-card-open" onClick={() => setOpen(true)}>Поделиться картой</button>
    {open && <SharePreview three={three} onClose={() => setOpen(false)} />}
  </div>;
}
