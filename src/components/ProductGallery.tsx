'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  images: { src: string; alt: string | null }[];
  /** Niche-specific alt for the primary image (from the content layer) */
  primaryAlt: string;
  title: string;
}

export default function ProductGallery({ images, primaryAlt, title }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [zoomed]);

  if (images.length === 0) {
    return <div className="aspect-square bg-[var(--surface)]" />;
  }

  const current = images[Math.min(active, images.length - 1)];
  const altFor = (img: { alt: string | null }, i: number) =>
    i === 0 ? primaryAlt : img.alt ?? `${title} view ${i + 1}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label={`Zoom into ${title}`}
        className="block w-full aspect-square bg-[var(--surface)] overflow-hidden cursor-zoom-in"
      >
        <Image
          src={current.src}
          alt={altFor(current, active)}
          width={1100}
          height={1100}
          priority
          className="w-full h-full object-cover"
          sizes="(max-width: 768px) 100vw, 55vw"
        />
      </button>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.slice(0, 5).map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1} of ${title}`}
              className={`aspect-square overflow-hidden border transition-colors ${
                i === active ? 'border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--text-muted)]'
              }`}
            >
              <Image
                src={img.src}
                alt={altFor(img, i)}
                width={160}
                height={160}
                loading="lazy"
                className="w-full h-full object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-label={`${title} enlarged`}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={altFor(current, active)}
            className="max-w-full max-h-full object-contain"
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close zoom"
            className="absolute top-4 right-5 text-white/90 text-3xl leading-none"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
