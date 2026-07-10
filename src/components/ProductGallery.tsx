'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  images: { src: string; alt: string | null }[];
  /** Niche-specific alt for the primary image (from the content layer) */
  primaryAlt: string;
  title: string;
}

export default function ProductGallery({ images, primaryAlt, title }: ProductGalleryProps) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-square bg-[var(--surface)]" />;
  }

  const current = images[Math.min(active, images.length - 1)];
  const altFor = (img: { alt: string | null }, i: number) =>
    i === 0 ? primaryAlt : img.alt ?? `${title} view ${i + 1}`;

  return (
    <div>
      <div className="aspect-square bg-[var(--surface)] overflow-hidden">
        <Image
          src={current.src}
          alt={altFor(current, active)}
          width={900}
          height={900}
          priority
          className="w-full h-full object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
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
    </div>
  );
}
