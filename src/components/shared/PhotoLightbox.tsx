"use client";

/**
 * PhotoLightbox — an in-page, Airbnb-style full-screen photo viewer. Replaces
 * "open the image in a new tab" with a proper gallery: a large stage, prev/next
 * (click + ← / → keys), an `n / total` counter, Esc-to-close, and a thumbnail
 * carousel that scrolls and highlights the current photo (click a thumb to jump).
 *
 * Portals to `document.body` at z-10000 (the overlay convention — see the
 * guided-tour overlays) so it escapes any transformed/overflow-clipped ancestor.
 * Presigned S3 URLs are `unoptimized` (the Next optimizer can't remote-pattern a
 * short-lived signed URL — same idiom as the inline chat media).
 */

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

export interface LightboxImage {
  url: string;
  alt: string;
}

export function PhotoLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}): React.ReactElement | null {
  const count = images.length;
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (count === 0) return;
      onIndexChange((index + delta + count) % count);
    },
    [index, count, onIndexChange],
  );

  // Keyboard: Esc closes, ← / → navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Lock background scroll while open.
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  // Keep the active thumbnail in view as the selection moves.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index]);

  if (count === 0 || typeof document === "undefined") return null;
  const current = images[Math.max(0, Math.min(index, count - 1))];
  const hasMany = count > 1;

  const node = (
    <div
      className="photo-lightbox fixed inset-0 z-[10000] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      {/* Top bar — close + counter. */}
      <header className="photo-lightbox-bar flex items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          className="photo-lightbox-close flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white/10"
          onClick={onClose}
          aria-label="Close"
        >
          <span aria-hidden>✕</span> Close
        </button>
        <span className="photo-lightbox-counter text-sm tabular-nums">
          {index + 1} / {count}
        </span>
        <span className="photo-lightbox-bar-spacer w-16" aria-hidden />
      </header>

      {/* Stage — the current photo, with prev/next overlaid. */}
      <div className="photo-lightbox-stage relative min-h-0 flex-1">
        <Image
          key={current.url}
          className="photo-lightbox-image object-contain"
          src={current.url}
          alt={current.alt}
          fill
          sizes="100vw"
          unoptimized
          priority
        />

        {hasMany && (
          <>
            <button
              type="button"
              className="photo-lightbox-prev absolute left-3 inset-y-0 my-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-black shadow hover:bg-white"
              onClick={() => go(-1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="photo-lightbox-next absolute right-3 inset-y-0 my-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-black shadow hover:bg-white"
              onClick={() => go(1)}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail carousel. */}
      {hasMany && (
        <div className="photo-lightbox-thumbs flex gap-2 overflow-x-auto px-4 py-3">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              ref={i === index ? activeThumbRef : undefined}
              type="button"
              className={`photo-lightbox-thumb relative h-16 w-16 shrink-0 overflow-hidden rounded border-2 transition ${
                i === index
                  ? "border-white"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              onClick={() => onIndexChange(i)}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === index}
            >
              <Image
                className="photo-lightbox-thumb-img object-cover"
                src={img.url}
                alt=""
                fill
                sizes="64px"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(node, document.body);
}
