"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

/**
 * Bir öğeyi yalnızca yatay eksende sürükletir. Öğe kapsayıcının içinde ortalı
 * durur; kaydırma miktarı kapsayıcının (iç boşluğu düşülmüş) sınırlarını aşamaz.
 * Sürükleme tutamaktan (handle) başlar; tutamaktaki düğme/bağlantılar sürüklemez.
 */
export function useHorizontalDrag({
  containerRef,
  targetRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
  targetRef: RefObject<HTMLElement | null>;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);

  /** Ortadan sağa/sola gidilebilecek en büyük mesafe */
  const limit = useCallback(() => {
    const container = containerRef.current;
    const target = targetRef.current;
    if (!container || !target) return 0;
    const style = window.getComputedStyle(container);
    const inner = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.max(0, (inner - target.offsetWidth) / 2);
  }, [containerRef, targetRef]);

  const clamp = useCallback(
    (value: number) => {
      const max = limit();
      return Math.min(max, Math.max(-max, value));
    },
    [limit]
  );

  // Pencere küçülürse öğe sınırların içine geri çekilir
  useEffect(() => {
    const onResize = () => setOffset((prev) => clamp(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const reset = useCallback(() => {
    drag.current = null;
    setDragging(false);
    setOffset(0);
  }, []);

  const end = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleProps = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
      drag.current = { pointerId: event.pointerId, startX: event.clientX, startOffset: offset };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      // Sürüklerken metin seçilmesin
      event.preventDefault();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      setOffset(clamp(state.startOffset + event.clientX - state.startX));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  return { offset, dragging, reset, handleProps };
}
