import { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';

export default function Hint({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  return (
    <div
      ref={ref}
      className="absolute right-3 top-3 z-20 group/hint"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(o => !o);
      }}
      role="button"
      aria-label="Hint"
    >
      <Info className="w-4 h-4 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer" />
      <div className={`absolute right-0 top-5 w-52 rounded-lg bg-slate-800 p-2.5 text-[10px] leading-relaxed text-white shadow-lg dark:bg-slate-700 z-50 transition-all duration-200 ${
        open ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none group-hover/hint:opacity-100 group-hover/hint:visible'
      }`}>
        {text}
      </div>
    </div>
  );
}
