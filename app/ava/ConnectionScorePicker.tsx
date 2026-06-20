'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Signal } from 'lucide-react';
import { AVA_PICKER_CONNECTION } from '@/lib/ava-elicitation-messages';

export type ConnectionPickCommit = {
  message: string;
  rect: { left: number; top: number; width: number; height: number };
};

type ConnId = (typeof AVA_PICKER_CONNECTION)[number]['id'];

const CONN_GRADIENT: Record<ConnId, string> = {
  '1': 'from-slate-400 to-slate-600',
  '2': 'from-blue-400 to-indigo-600',
  '3': 'from-amber-400 to-orange-500',
  '4': 'from-emerald-400 to-teal-600',
  '5': 'from-rose-400 to-pink-600',
};

type Props = {
  onCommitted: (commit: ConnectionPickCommit) => void;
  disabled: boolean;
};

export function ConnectionScorePicker({ onCommitted, disabled }: Props) {
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
            duration: 0.38,
            stagger: { each: 0.04, from: 'start' },
            ease: 'back.out(1.1)',
          },
          '-=0.16',
        );
    }, root);
    return () => ctx.revert();
  }, []);

  const handle = (id: ConnId) => {
    if (disabled || picked) return;
    setPicked(id);
    const row = AVA_PICKER_CONNECTION.find((r) => r.id === id);
    const msg = row?.message ?? '';
    const idx = AVA_PICKER_CONNECTION.findIndex((r) => r.id === id);
    const btn = cardsRef.current[idx];
    if (!btn) return;
    const others = AVA_PICKER_CONNECTION.map((_, j) => cardsRef.current[j]).filter(
      (el, j) => el && j !== idx,
    ) as HTMLButtonElement[];
    const raw = btn.getBoundingClientRect();
    const r = { left: raw.left, top: raw.top, width: raw.width, height: raw.height };
    const root = scopeRef.current;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => onCommitted({ message: msg, rect: r }),
    });
    tl.to(others, {
      autoAlpha: 0.32,
      scale: 0.94,
      duration: 0.18,
      stagger: { each: 0.02 },
    }).to(
      btn,
      {
        scale: 1.06,
        boxShadow:
          '0 0 0 3px rgba(99, 102, 241, 0.35), 0 12px 24px rgba(99, 102, 241, 0.15)',
        duration: 0.2,
      },
      0,
    );
    if (root) {
      tl.to(root, { y: 6, autoAlpha: 0, duration: 0.28, ease: 'power2.in' }, '+=0.06');
    }
  };

  return (
    <div
      ref={scopeRef}
      className="mx-auto max-w-md px-3 pb-1.5 pt-1 perspective-[800px]"
      role="group"
      aria-label="How tuned in you feel to Tobago these days"
    >
      <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-400/40 bg-gradient-to-r from-indigo-50/80 via-white to-sand-50/40 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
          Connection
        </span>
        <span className="text-[11px] text-slate-600">1–5 · Pick one</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-1.5">
        {AVA_PICKER_CONNECTION.map((opt, i) => {
          const gradient = CONN_GRADIENT[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              disabled={disabled || !!picked}
              onClick={() => handle(opt.id)}
              className="group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border border-sand-200/90 bg-white px-2 py-2.5 text-center shadow-sm transition-shadow hover:border-indigo-400/45 hover:shadow disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-200 group-hover:opacity-[0.09]`}
              />
              <div
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
              >
                <Signal className="h-5 w-5 text-white" strokeWidth={2.25} />
              </div>
              <span className="relative max-w-[6rem] text-[11px] font-semibold leading-tight text-slate-800 sm:text-xs">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
