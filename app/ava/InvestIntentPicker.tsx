'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CircleDollarSign, HelpCircle, Ban } from 'lucide-react';
import { AVA_PICKER_INVEST } from '@/lib/ava-elicitation-messages';

export type InvestPickCommit = {
  message: string;
  rect: { left: number; top: number; width: number; height: number };
};

type InvestId = (typeof AVA_PICKER_INVEST)[number]['id'];

const INVEST_ICON: Record<InvestId, typeof CircleDollarSign> = {
  yes: CircleDollarSign,
  maybe: HelpCircle,
  no: Ban,
};

const INVEST_GRADIENT: Record<InvestId, string> = {
  yes: 'from-emerald-400 to-green-600',
  maybe: 'from-amber-400 to-orange-500',
  no: 'from-slate-400 to-slate-600',
};

type Props = {
  onCommitted: (commit: InvestPickCommit) => void;
  disabled: boolean;
};

export function InvestIntentPicker({ onCommitted, disabled }: Props) {
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
            stagger: { each: 0.05, from: 'start' },
            ease: 'back.out(1.12)',
          },
          '-=0.16',
        );
    }, root);
    return () => ctx.revert();
  }, []);

  const handle = (id: InvestId) => {
    if (disabled || picked) return;
    setPicked(id);
    const row = AVA_PICKER_INVEST.find((r) => r.id === id);
    const msg = row?.message ?? '';
    const idx = AVA_PICKER_INVEST.findIndex((r) => r.id === id);
    const btn = cardsRef.current[idx];
    if (!btn) return;
    const others = AVA_PICKER_INVEST.map((_, j) => cardsRef.current[j]).filter(
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
      stagger: { each: 0.03 },
    }).to(
      btn,
      {
        scale: 1.07,
        boxShadow:
          '0 0 0 3px rgba(16, 185, 129, 0.35), 0 12px 24px rgba(16, 185, 129, 0.12)',
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
      aria-label="Whether you would consider investing in Tobago"
    >
      <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/45 bg-gradient-to-r from-emerald-50/80 via-white to-sand-50/40 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
          Invest
        </span>
        <span className="text-[11px] text-slate-600">Pick one</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-1.5">
        {AVA_PICKER_INVEST.map((opt, i) => {
          const Icon = INVEST_ICON[opt.id];
          const gradient = INVEST_GRADIENT[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              disabled={disabled || !!picked}
              onClick={() => handle(opt.id)}
              className="group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border border-sand-200/90 bg-white px-2 py-2.5 text-center shadow-sm transition-shadow hover:border-emerald-400/45 hover:shadow disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-200 group-hover:opacity-[0.09]`}
              />
              <div
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
              </div>
              <span className="relative max-w-[10rem] text-[11px] font-semibold leading-tight text-slate-800 sm:text-xs">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
