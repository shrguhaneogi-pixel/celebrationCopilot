import { Sparkles, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 sm:p-12">
      <div className="max-w-3xl mx-auto w-full space-y-8 my-auto">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Foundation Milestone Active
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Celebration Copilot
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Deterministic event planning with reactive budgeting, adaptive milestone schedules, and verified mutation boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Deterministic Budget</h3>
            <p className="text-xs text-slate-500">Integer-cent precision with zero floating-point accumulation drift.</p>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Adaptive Milestones</h3>
            <p className="text-xs text-slate-500">Event-relative deadlines that automatically recalculate when dates shift.</p>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Verified CI Pipeline</h3>
            <p className="text-xs text-slate-500">Strict linting, static typechecking, and size guards under 5 MB.</p>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 py-4">
        Celebration Copilot • Next.js 15 App Router • Tailwind CSS v4 • Foundation Scaffolding
      </footer>
    </main>
  );
}
