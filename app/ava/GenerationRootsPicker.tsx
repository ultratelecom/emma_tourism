'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Anchor, Trees, Users, Infinity as InfinityIcon } from 'lucide-react';
import { AVA_PICKER_ROOTS } from '@/lib/ava-elicitation-messages';

type RootsId = (typeof AVA_PICKER_ROOTS)[number]['id'];

const ROOT_ICON: Record<RootsId, typeof Anchor> = {
  island: Anchor,
  parents: Users,
  grandparents: Trees,
  deep: InfinityIcon,
};

const ROOT_GRADIENT: Record<RootsId, string> = {
  island: 'from-teal-400 to-cyan-500',
  parents: 'from-violet-400 to-purple-600',
  grandparents: 'from-amber-400 to-orange-500',
  deep: 'from-rose-400 to-pink-600',
};

/** @deprecated use AVA_PICKER_ROOTS from lib */
export const ROOTS_OPTION_MESSAGES: Record<RootsId, string> = Object.fromEntries(
  AVA_PICKER_ROOTS.map((r) => [r.id, r.message]),
) as Record<RootsId, string>;

export type RootsPickCommit = {
  message: string;
  rect: { left: number; top: number; width: number; height: number };
};

type Props = {
  onCommitted: (commit: RootsPickCommit) => void;
  disabled: boolean;
};

export function GenerationRootsPicker({ onCommitted, disabled }: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useLayoutEffect(() => {
    const root = scopeRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const cards = cardsRef.current.filter(Boolean);
      gsap.set(root, { autoAlpha: 0, y: 12 });
      gsap.set(cards, { autoAlpha: 0, y: 20, scale: 0.92 });

      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to(root, { autoAlpha: 1, y: 0, duration: 0.38 })
        .to(
          cards,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.4,
            stagger: { each: 0.06, from: 'start' },
            ease: 'back.out(1.15)',
          },
          '-=0.18',
        );
    }, root);

    return () => ctx.revert();
  }, []);

  const handle = (id: RootsId) => {
    if (disabled || picked) return;
    setPicked(id);
    const row = AVA_PICKER_ROOTS.find((r) => r.id === id);
    const msg = row?.message ?? '';
    const idx = AVA_PICKER_ROOTS.findIndex((r) => r.id === id);
    const btn = cardsRef.current[idx];
    if (!btn) return;

    const others = AVA_PICKER_ROOTS.map((_, j) => cardsRef.current[j]).filter(
      (el, j) => el && j !== idx,
    ) as HTMLButtonElement[];

    const raw = btn.getBoundingClientRect();
    const r = {
      left: raw.left,
      top: raw.top,
      width: raw.width,
      height: raw.height,
    };

    const root = scopeRef.current;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => onCommitted({ message: msg, rect: r }),
    });

    tl.to(others, {
      autoAlpha: 0.32,
      scale: 0.94,
      duration: 0.2,
      stagger: { each: 0.03 },
    }).to(
      btn,
      {
        scale: 1.07,
        boxShadow:
          '0 0 0 3px rgba(251, 146, 60, 0.45), 0 12px 28px rgba(251, 146, 60, 0.2)',
        duration: 0.22,
      },
      0,
    );

    if (root) {
      tl.to(
        root,
        { y: 6, autoAlpha: 0, duration: 0.3, ease: 'power2.in' },
        '+=0.08',
      );
    }
  };

  return (
    <div
      ref={scopeRef}
      className="mx-auto max-w-md px-3 pb-1.5 pt-1 perspective-[800px]"
      role="group"
      aria-label="Pick how Tobago runs in your family"
    >
      <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-coral/30 bg-gradient-to-r from-coral/[0.06] via-white to-amber-50/40 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-coral">
          Roots
        </span>
        <span className="text-[11px] text-slate-600">Pick one</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-1.5">
        {AVA_PICKER_ROOTS.map((opt, i) => {
          const Icon = ROOT_ICON[opt.id];
          const gradient = ROOT_GRADIENT[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              disabled={disabled || !!picked}
              onClick={() => handle(opt.id)}
              className="group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border border-sand-200/90 bg-white px-2 py-2.5 text-center shadow-sm transition-shadow hover:border-coral/45 hover:shadow disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-200 group-hover:opacity-[0.09]`}
              />
              <div
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
              </div>
              <span className="relative max-w-[5.5rem] text-[11px] font-semibold leading-tight text-slate-800 sm:max-w-none sm:text-xs">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
