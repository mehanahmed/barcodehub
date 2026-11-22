import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Check } from 'lucide-react';

/** Whole-percent saving of paying yearly instead of 12 monthly payments (0 when there is none). */
export const yearlySaving = (p: { monthlyPrice?: number | null; yearlyPrice?: number | null }) => {
  const m = Number(p.monthlyPrice ?? 0), y = Number(p.yearlyPrice ?? 0);
  return m > 0 && y > 0 ? Math.max(0, Math.round((1 - y / (m * 12)) * 100)) : 0;
};

/** Pill Monthly/Yearly switch from the landing page pricing section. */
export function BillingToggle({ yearly, onChange, yearlyBadge }: { yearly: boolean; onChange: (yearly: boolean) => void; yearlyBadge?: string }) {
  const item = (on: boolean) =>
    `px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8f33c] ${
      on ? 'bg-[#212124] text-white shadow' : 'text-gray-600 hover:text-gray-900'
    }`;
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex bg-white/80 backdrop-blur rounded-full p-1 border border-gray-300 shadow-sm">
      <button type="button" role="radio" aria-checked={!yearly} onClick={() => onChange(false)} className={item(!yearly)}>Monthly</button>
      <button type="button" role="radio" aria-checked={yearly} onClick={() => onChange(true)} className={item(yearly)}>
        <span>Yearly</span>
        {yearlyBadge && <span className="text-[10px] font-extrabold bg-[#a8f33c] text-black px-1.5 py-0.5 rounded-full">{yearlyBadge}</span>}
      </button>
    </div>
  );
}

type PackageCardProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  /** Pill at the top, e.g. the package name in capitals */
  badge: string;
  /** Extra pill next to the badge, e.g. "Current plan" */
  tag?: string;
  price: string;
  /** "/month", "/year", or nothing for a free plan */
  unit?: string;
  subtitle?: string;
  features: string[];
  /** The dark, raised middle card */
  featured?: boolean;
  /** Lime ring when this card is the one being bought */
  selected?: boolean;
  /** Same size as its neighbours: fills the grid row height, and a featured card is not raised */
  uniform?: boolean;
  action: { label: ReactNode; onClick?: () => void; disabled?: boolean; pressed?: boolean };
};

/** Pricing card from the landing page; shared so the landing page and the subscription page stay identical. */
export function PackageCard({ badge, tag, price, unit, subtitle, features, featured, selected, uniform, action, className = '', ...motionProps }: PackageCardProps) {
  const size = uniform ? 'h-full p-6 sm:p-7' : featured ? 'p-6 sm:p-8 md:py-10 relative z-10 md:-my-4' : 'p-6 sm:p-7';
  return (
    <motion.div
      {...motionProps}
      className={`rounded-[2rem] flex flex-col justify-between transition-all duration-300 ${size} ${
        featured ? 'bg-[#202022] text-white shadow-2xl border border-white/10' : 'bg-white text-gray-950 shadow-sm border border-gray-200/90'
      } ${selected ? 'ring-4 ring-[#a8f33c] ring-offset-2 ring-offset-background' : ''} ${className}`}
    >
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
            featured ? 'border border-[#a8f33c] text-[#a8f33c]' : 'border border-gray-300 text-gray-800'
          }`}>
            {badge}
          </span>
          {tag && (
            <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full ${featured ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>{tag}</span>
          )}
        </div>

        <div className="flex items-baseline flex-nowrap whitespace-nowrap mb-1">
          <span className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-none ${featured ? 'text-white' : 'text-gray-950'}`}>{price}</span>
          {unit && <span className={`text-xs sm:text-sm font-normal ml-1 shrink-0 whitespace-nowrap ${featured ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>}
        </div>

        {subtitle && <p className={`text-xs sm:text-sm font-normal mb-5 whitespace-nowrap truncate ${featured ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>}

        <hr className={`my-5 ${featured ? 'border-white/10' : 'border-gray-200/90'}`} />

        <ul className="space-y-3 mb-8 text-xs sm:text-[13px]">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${featured ? 'border-gray-500' : 'border-gray-400'}`}>
                <Check className={`w-2.5 h-2.5 ${featured ? 'text-white' : 'text-gray-800'}`} strokeWidth={2.5} />
              </div>
              <span className={`leading-snug ${featured ? 'text-gray-200' : 'text-gray-700'}`}>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        aria-pressed={action.pressed}
        className={`w-full h-12 rounded-full font-bold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#a8f33c] ${
          featured ? 'bg-[#a8f33c] text-black hover:brightness-105 shadow-lg shadow-lime-400/20' : 'bg-[#212124] text-white hover:bg-black'
        }`}
      >
        {action.label}
      </button>
    </motion.div>
  );
}
