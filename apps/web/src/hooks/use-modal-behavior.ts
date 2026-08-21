'use client';

import { useEffect, useRef } from 'react';

interface UseModalBehaviorOptions {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
}

export function useModalBehavior({
  open,
  disabled = false,
  onClose,
}: UseModalBehaviorOptions): void {
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || disabledRef.current) {
        return;
      }

      event.preventDefault();
      onCloseRef.current();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);
}