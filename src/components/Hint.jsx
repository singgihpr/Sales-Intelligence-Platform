import { Info } from 'lucide-react';

export default function Hint({ text }) {
  return (
    <div
      className="group/hint relative z-20"
      onClick={(e) => e.stopPropagation()}
      role="button"
      aria-label="Hint"
    >
      <Info className="w-4 h-4 text-slate-400 hover:text-emerald-500 transition-colors" />
      <div className="pointer-events-none absolute right-0 top-5 hidden w-52 group-hover/hint:block rounded-lg bg-slate-800 p-2.5 text-[10px] leading-relaxed text-white shadow-lg dark:bg-slate-700 z-50">
        {text}
      </div>
    </div>
  );
}
