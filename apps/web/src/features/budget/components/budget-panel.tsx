'use client';

import {
  CircleAlert,
  CircleCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useModalBehavior } from '../../../hooks/use-modal-behavior';
import {
  EXPENSE_CATEGORIES,
  type BudgetOverview,
  type BudgetOverviewCategory,
  type Expense,
  type ExpenseCategory,
} from '../types/budget.types';

type BudgetPanelProps = {
  tripId: string;
  canEdit: boolean;
};

type LoadState =
  | {
      status: 'loading';
      overview: null;
      expenses: Expense[];
      error: null;
    }
  | {
      status: 'success';
      overview: BudgetOverview;
      expenses: Expense[];
      error: null;
    }
  | {
      status: 'error';
      overview: null;
      expenses: Expense[];
      error: string;
    };

type ExpenseFormState = {
  title: string;
  category: ExpenseCategory;
  amount: string;
  spentAt: string;
  notes: string;
};

type Notice = {
  tone: 'success' | 'error';
  message: string;
} | null;

const EMPTY_EXPENSE_FORM: ExpenseFormState = {
  title: '',
  category: 'OTHER',
  amount: '',
  spentAt: '',
  notes: '',
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ACCOMMODATION: 'Accommodation',
  FOOD: 'Food & drinks',
  TRANSPORT: 'Transport',
  ACTIVITIES: 'Activities',
  SHOPPING: 'Shopping',
  HEALTH: 'Health',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  ACCOMMODATION: '#38bdf8',
  FOOD: '#fbbf24',
  TRANSPORT: '#60a5fa',
  ACTIVITIES: '#a78bfa',
  SHOPPING: '#f472b6',
  HEALTH: '#34d399',
  OTHER: '#94a3b8',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  const { message } = payload;

  if (typeof message === 'string') {
    return message;
  }

  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === 'string')
  ) {
    return message.join(', ');
  }

  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function fetchBudgetWorkspace(
  tripId: string,
): Promise<{
  overview: BudgetOverview;
  expenses: Expense[];
}> {
  const [overviewResponse, expensesResponse] = await Promise.all([
    fetch(`/api/trips/${encodeURIComponent(tripId)}/budget/overview`, {
      cache: 'no-store',
    }),
    fetch(`/api/trips/${encodeURIComponent(tripId)}/expenses`, {
      cache: 'no-store',
    }),
  ]);

  const overviewPayload = await readJson(overviewResponse);
  const expensesPayload = await readJson(expensesResponse);

  if (!overviewResponse.ok) {
    throw new Error(
      readErrorMessage(
        overviewPayload,
        'Unable to load budget overview.',
      ),
    );
  }

  if (!expensesResponse.ok) {
    throw new Error(
      readErrorMessage(
        expensesPayload,
        'Unable to load expenses.',
      ),
    );
  }

  return {
    overview: overviewPayload as BudgetOverview,
    expenses: expensesPayload as Expense[],
  };
}

function createLimitDrafts(
  overview: BudgetOverview,
): Record<ExpenseCategory, string> {
  return Object.fromEntries(
    EXPENSE_CATEGORIES.map((category) => {
      const item = overview.categories.find(
        (entry) => entry.category === category,
      );

      return [category, item?.limitAmount ?? ''];
    }),
  ) as Record<ExpenseCategory, string>;
}

function getLoadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Budget service is currently unavailable.';
}

function formatMoney(value: string | null, currency: string): string {
  if (value === null) {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${currency} ${value}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatCompactMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatExpenseDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function toDateTimeLocal(date: Date): string {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return local.toISOString().slice(0, 16);
}

function ProgressBar({ value }: { value: number | null }) {
  const normalized =
    value === null ? 0 : Math.max(0, Math.min(value, 100));

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300 transition-[width] duration-500"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-white/[0.11] hover:bg-white/[0.035]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function SpendingTrendChart({
  expenses,
  currency,
}: {
  expenses: Expense[];
  currency: string;
}) {
  const series = useMemo(() => {
    const ordered = [...expenses].sort(
      (left, right) =>
        new Date(left.spentAt).getTime() -
        new Date(right.spentAt).getTime(),
    );

    return ordered.reduce<
      Array<{
        id: string;
        date: string;
        total: number;
      }>
    >((series, expense) => {
      const previousTotal =
        series.at(-1)?.total ?? 0;

      return [
        ...series,
        {
          id: expense.id,
          date: expense.spentAt,
          total:
            previousTotal +
            Number(expense.amount),
        },
      ];
    }, []);
  }, [expenses]);

  if (series.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] p-6 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Spending pace
          </p>
          <p className="mt-3 text-sm font-medium text-slate-300">
            Your spending curve will appear here.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Add the first expense to start the timeline.
          </p>
        </div>
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const left = 20;
  const right = 20;
  const top = 24;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(...series.map((item) => item.total), 1);

  const points = series.map((item, index) => {
    const x =
      series.length === 1
        ? left + plotWidth / 2
        : left + (index / (series.length - 1)) * plotWidth;
    const y = top + plotHeight - (item.total / max) * plotHeight;

    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(' ');

  const areaPath = `${linePath} L ${points.at(-1)?.x ?? left} ${height - bottom} L ${points[0]?.x ?? left} ${height - bottom} Z`;
  const current = series.at(-1)?.total ?? 0;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Spending pace
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            Cumulative spend
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tracking-[-0.03em] text-white">
            {formatCompactMoney(current, currency)}
          </p>
          <p className="text-[11px] text-slate-500">across {series.length} entries</p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-5 h-52 w-full"
        role="img"
        aria-label="Cumulative spending over time"
      >
        <defs>
          <linearGradient id="budgetArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="budgetLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + plotHeight - plotHeight * ratio;

          return (
            <line
              key={ratio}
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        <path d={areaPath} fill="url(#budgetArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#budgetLine)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#07111b"
            stroke="#7dd3fc"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{formatShortDate(series[0]?.date ?? '')}</span>
        <span>{formatShortDate(series.at(-1)?.date ?? '')}</span>
      </div>
    </div>
  );
}

function CategoryDonut({
  categories,
  currency,
}: {
  categories: BudgetOverviewCategory[];
  currency: string;
}) {
  const entries = categories
    .map((category) => ({
      ...category,
      value: Number(category.spentAmount),
    }))
    .filter((category) => category.value > 0)
    .sort((left, right) => right.value - left.value);

  const total = entries.reduce(
    (sum, item) =>
      sum + item.value,
    0,
  );

  const segments = entries.map(
    (item, index) => {
      const spentBefore = entries
        .slice(0, index)
        .reduce(
          (sum, entry) =>
            sum + entry.value,
          0,
        );

      const start =
        total > 0
          ? (spentBefore / total) *
            100
          : 0;

      const size =
        total > 0
          ? (item.value / total) *
            100
          : 0;

      const end = start + size;

      return `${CATEGORY_COLORS[item.category]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    },
  );

  const background =
    segments.length > 0
      ? `conic-gradient(${segments.join(', ')})`
      : 'conic-gradient(rgba(255,255,255,0.08) 0 100%)';

  return (
    <div className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Category mix
      </p>
      <p className="mt-1 text-sm font-medium text-white">Where the money goes</p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row xl:flex-col">
        <div
          className="relative h-36 w-36 shrink-0 rounded-full"
          style={{ background }}
          role="img"
          aria-label="Expense distribution by category"
        >
          <div className="absolute inset-[18px] flex items-center justify-center rounded-full border border-white/[0.06] bg-[#09131e] text-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Spent</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatCompactMoney(total, currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          {entries.length === 0 ? (
            <p className="text-xs leading-5 text-slate-500">
              No category data yet.
            </p>
          ) : (
            entries.slice(0, 4).map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span className="text-xs font-medium text-slate-200">
                  {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryPressure({
  categories,
  currency,
}: {
  categories: BudgetOverviewCategory[];
  currency: string;
}) {
  const entries = categories
    .filter((category) => category.limitAmount !== null)
    .sort(
      (left, right) =>
        (right.usagePercentage ?? 0) - (left.usagePercentage ?? 0),
    )
    .slice(0, 4);

  return (
    <div className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Limit health
          </p>
          <p className="mt-1 text-sm font-medium text-white">Pressure by category</p>
        </div>
        <span className="text-[11px] text-slate-600">highest first</span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-xs leading-5 text-slate-500">
          Add category limits to compare actual spending against the plan.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {entries.map((category) => (
            <div key={category.category}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-medium text-slate-300">
                  {CATEGORY_LABELS[category.category]}
                </p>
                <p className="text-[11px] text-slate-500">
                  {category.usagePercentage?.toFixed(0) ?? 0}%
                </p>
              </div>
              <div className="mt-2">
                <ProgressBar value={category.usagePercentage} />
              </div>
              <p className="mt-2 text-[11px] text-slate-600">
                {formatMoney(category.spentAmount, currency)} /{' '}
                {formatMoney(category.limitAmount, currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toast({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  const success = notice.tone === 'success';

  return (
    <div
      className={`fixed bottom-5 left-4 right-4 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:left-auto sm:right-5 sm:mx-0 ${
        success
          ? 'border-emerald-300/15 bg-[#0b1b19]/95 text-emerald-100'
          : 'border-rose-300/15 bg-[#211116]/95 text-rose-100'
      }`}
      role="status"
      aria-live="polite"
    >
      {success ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
      )}
      <p className="min-w-0 flex-1 text-sm leading-5">{notice.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 text-current/50 transition hover:bg-white/[0.06] hover:text-current"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ExpenseDialog({
  form,
  currency,
  error,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ExpenseFormState;
  currency: string;
  error: string | null;
  saving: boolean;
  onChange: (next: ExpenseFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useModalBehavior({
    open: true,
    disabled: saving,
    onClose,
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add expense"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) {
          onClose();
        }
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden border border-white/[0.1] bg-[#0a1520] shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[1.75rem]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.07] bg-[#0a1520]/95 px-5 py-5 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
              Expense
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">
              Add trip spending
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            aria-label="Close expense dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-5 sm:grid-cols-2 sm:p-6">
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">Title</span>
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="Dinner in Navigli"
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40"
            />
          </label>

          <label>
            <span className="text-xs font-medium text-slate-400">Category</span>
            <select
              value={form.category}
              onChange={(event) =>
                onChange({ ...form, category: event.target.value as ExpenseCategory })
              }
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0a1520] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-300/40"
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-medium text-slate-400">Amount ({currency})</span>
            <input
              value={form.amount}
              onChange={(event) => onChange({ ...form, amount: event.target.value })}
              inputMode="decimal"
              placeholder="45.50"
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">Date & time</span>
            <input
              type="datetime-local"
              value={form.spentAt}
              onChange={(event) => onChange({ ...form, spentAt: event.target.value })}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-300/40"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              rows={3}
              placeholder="Optional context"
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40"
            />
          </label>

          {error && (
            <div className="sm:col-span-2 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-xs leading-5 text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="z-20 flex shrink-0 flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#0a1520]/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl sm:flex-row sm:justify-end sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteExpenseDialog({
  expense,
  currency,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  expense: Expense;
  currency: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useModalBehavior({
    open: true,
    disabled: deleting,
    onClose: onCancel,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Delete expense"
    >
      <div className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#0c1118] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/10 bg-rose-300/[0.05] text-rose-200">
          <Trash2 className="h-5 w-5" strokeWidth={1.6} />
        </div>

        <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-white">
          Delete expense?
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/45">
          “{expense.title}” ({formatMoney(expense.amount, currency)}) will be permanently removed from this journey.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200/80">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Keep expense
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl border border-rose-300/15 bg-rose-300/[0.08] px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/[0.13] disabled:opacity-40"
          >
            {deleting ? 'Deleting...' : 'Delete expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BudgetPanel({
  tripId,
  canEdit,
}: BudgetPanelProps) {
  const [state, setState] = useState<LoadState>({
    status: 'loading',
    overview: null,
    expenses: [],
    error: null,
  });
  const [budgetAmount, setBudgetAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(EMPTY_EXPENSE_FORM);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [limitDrafts, setLimitDrafts] = useState<Record<ExpenseCategory, string>>(
    () =>
      Object.fromEntries(
        EXPENSE_CATEGORIES.map((category) => [category, '']),
      ) as Record<ExpenseCategory, string>,
  );
  const [savingLimit, setSavingLimit] = useState<ExpenseCategory | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);

  async function reload() {
    try {
      const { overview, expenses } = await fetchBudgetWorkspace(tripId);

      setState({
        status: 'success',
        overview,
        expenses,
        error: null,
      });
      setBudgetAmount(overview.totals.budgetAmount ?? '');
      setLimitDrafts(createLimitDrafts(overview));
    } catch (error) {
      setState({
        status: 'error',
        overview: null,
        expenses: [],
        error: getLoadErrorMessage(error),
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetchBudgetWorkspace(tripId).then(
      ({ overview, expenses }) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'success',
          overview,
          expenses,
          error: null,
        });
        setBudgetAmount(overview.totals.budgetAmount ?? '');
        setLimitDrafts(createLimitDrafts(overview));
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'error',
          overview: null,
          expenses: [],
          error: getLoadErrorMessage(error),
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice]);

  const recentExpenses = useMemo(() => {
    if (state.status !== 'success') {
      return [];
    }

    return state.expenses.slice(0, 6);
  }, [state]);

  async function saveBudget() {
    const amount = budgetAmount.trim();

    if (!amount) {
      setBudgetError('Enter a total budget.');
      return;
    }

    setSavingBudget(true);
    setBudgetError(null);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/budget`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ totalAmount: amount }),
        },
      );
      const payload = await readJson(response);

      if (!response.ok) {
        setBudgetError(readErrorMessage(payload, 'Unable to save budget.'));
        return;
      }

      await reload();
      setNotice({ tone: 'success', message: 'Journey budget updated.' });
    } catch {
      setBudgetError('Budget service is currently unavailable.');
    } finally {
      setSavingBudget(false);
    }
  }

  async function saveExpense() {
    const title = expenseForm.title.trim();
    const amount = expenseForm.amount.trim();

    if (!title) {
      setExpenseError('Expense title is required.');
      return;
    }

    if (!amount) {
      setExpenseError('Expense amount is required.');
      return;
    }

    if (!expenseForm.spentAt) {
      setExpenseError('Expense date is required.');
      return;
    }

    setSavingExpense(true);
    setExpenseError(null);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/expenses`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title,
            category: expenseForm.category,
            amount,
            spentAt: new Date(expenseForm.spentAt).toISOString(),
            notes: expenseForm.notes.trim() || undefined,
          }),
        },
      );
      const payload = await readJson(response);

      if (!response.ok) {
        setExpenseError(readErrorMessage(payload, 'Unable to save expense.'));
        return;
      }

      setExpenseForm({
        ...EMPTY_EXPENSE_FORM,
        spentAt: toDateTimeLocal(new Date()),
      });
      setShowExpenseForm(false);
      await reload();
      setNotice({ tone: 'success', message: 'Expense added to the journey.' });
    } catch {
      setExpenseError('Expense service is currently unavailable.');
    } finally {
      setSavingExpense(false);
    }
  }

  async function confirmDeleteExpense() {
    if (!deleteTarget) {
      return;
    }

    setDeletingExpense(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        const payload = await readJson(response);
        setDeleteError(readErrorMessage(payload, 'Unable to delete expense.'));
        return;
      }

      setDeleteTarget(null);
      await reload();
      setNotice({ tone: 'success', message: 'Expense removed.' });
    } catch {
      setDeleteError('Expense service is currently unavailable.');
    } finally {
      setDeletingExpense(false);
    }
  }

  async function saveCategoryLimit(category: ExpenseCategory) {
    const amount = limitDrafts[category].trim();

    if (!amount) {
      setLimitError(`Enter a limit for ${CATEGORY_LABELS[category]}.`);
      return;
    }

    setSavingLimit(category);
    setLimitError(null);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/budget/categories/${encodeURIComponent(category)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ amount }),
        },
      );
      const payload = await readJson(response);

      if (!response.ok) {
        setLimitError(
          readErrorMessage(payload, 'Unable to save category limit.'),
        );
        return;
      }

      await reload();
      setNotice({
        tone: 'success',
        message: `${CATEGORY_LABELS[category]} limit updated.`,
      });
    } catch {
      setLimitError('Budget category service is currently unavailable.');
    } finally {
      setSavingLimit(null);
    }
  }

  async function clearCategoryLimit(category: ExpenseCategory) {
    setSavingLimit(category);
    setLimitError(null);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/budget/categories/${encodeURIComponent(category)}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        const payload = await readJson(response);
        setLimitError(
          readErrorMessage(payload, 'Unable to clear category limit.'),
        );
        return;
      }

      await reload();
      setNotice({
        tone: 'success',
        message: `${CATEGORY_LABELS[category]} limit cleared.`,
      });
    } catch {
      setLimitError('Budget category service is currently unavailable.');
    } finally {
      setSavingLimit(null);
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="space-y-5 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-[1.4rem] border border-white/[0.06] bg-white/[0.025]"
            />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
          <div className="h-80 animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-white/[0.025]" />
          <div className="h-80 animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-white/[0.025]" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="py-8">
        <div className="rounded-[1.75rem] border border-rose-300/10 bg-rose-300/[0.04] p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
            Budget unavailable
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{state.error}</p>
          <button
            type="button"
            onClick={() => {
              setState({
                status: 'loading',
                overview: null,
                expenses: [],
                error: null,
              });
              void reload();
            }}
            className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { overview } = state;
  const { currency, totals } = overview;

  return (
    <section className="py-7 sm:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Budget
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Keep the journey financially on course.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Track the total budget, category limits and every expense from one workspace.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setExpenseError(null);
              setExpenseForm({
                ...EMPTY_EXPENSE_FORM,
                spentAt: toDateTimeLocal(new Date()),
              });
              setShowExpenseForm(true);
            }}
            className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 sm:w-auto"
          >
            + Add expense
          </button>
        )}
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total budget"
          value={formatMoney(totals.budgetAmount, currency)}
          helper={overview.configured ? 'Planned for this journey' : 'Set a budget to start tracking'}
        />
        <MetricCard
          label="Spent"
          value={formatMoney(totals.spentAmount, currency)}
          helper={`${totals.expensesCount} recorded expense${totals.expensesCount === 1 ? '' : 's'}`}
        />
        <MetricCard
          label="Remaining"
          value={formatMoney(totals.remainingAmount, currency)}
          helper={
            totals.remainingAmount === null
              ? 'Available after budget setup'
              : Number(totals.remainingAmount) >= 0
                ? 'Still available'
                : 'Currently over budget'
          }
        />
        <MetricCard
          label="Used"
          value={
            totals.usagePercentage === null
              ? '—'
              : `${totals.usagePercentage.toFixed(2)}%`
          }
          helper="Share of total budget"
        />
      </div>

      {totals.usagePercentage !== null && (
        <div className="mt-4">
          <ProgressBar value={totals.usagePercentage} />
        </div>
      )}

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <SpendingTrendChart expenses={state.expenses} currency={currency} />
        <CategoryDonut categories={overview.categories} currency={currency} />
      </div>

      <div className="mt-5">
        <CategoryPressure categories={overview.categories} currency={currency} />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recent spending
                </p>
                <p className="mt-1 text-sm font-medium text-white">Latest expenses</p>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-black/10 px-3 py-1 text-xs text-slate-400">
                {state.expenses.length}
              </span>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-300">No expenses yet.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Add transport, accommodation, meals and activities as the trip takes shape.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="group flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-xs font-semibold text-sky-200">
                      {CATEGORY_LABELS[expense.category].charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{expense.title}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {CATEGORY_LABELS[expense.category]} · {formatExpenseDate(expense.spentAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatMoney(expense.amount, currency)}
                      </p>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(expense);
                          }}
                          className="mt-1 text-[11px] text-slate-600 opacity-100 transition hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025]">
            <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Category plan
              </p>
              <p className="mt-1 text-sm font-medium text-white">Limits vs. spending</p>
            </div>

            {!overview.configured ? (
              <div className="px-6 py-10 text-sm leading-6 text-slate-500">
                Configure the total budget first, then assign category limits.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {overview.categories.map((category) => (
                  <div key={category.category} className="px-4 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium text-slate-200">
                            {CATEGORY_LABELS[category.category]}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatMoney(category.spentAmount, currency)} spent
                          </p>
                        </div>
                        <div className="mt-3">
                          <ProgressBar value={category.usagePercentage} />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-600">
                          {category.limitAmount === null
                            ? 'No category ceiling set'
                            : `${formatMoney(category.remainingAmount, currency)} remaining`}
                        </p>
                      </div>

                      {canEdit ? (
                        <div className="flex min-w-0 gap-2 lg:w-[17rem]">
                          <input
                            value={limitDrafts[category.category]}
                            onChange={(event) => {
                              const value = event.target.value;
                              setLimitDrafts((current) => ({
                                ...current,
                                [category.category]: value,
                              }));
                            }}
                            inputMode="decimal"
                            placeholder="Limit"
                            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40"
                          />
                          <button
                            type="button"
                            disabled={savingLimit === category.category}
                            onClick={() => void saveCategoryLimit(category.category)}
                            className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingLimit === category.category ? '...' : 'Save'}
                          </button>
                          {category.limitAmount !== null && (
                            <button
                              type="button"
                              disabled={savingLimit === category.category}
                              onClick={() => void clearCategoryLimit(category.category)}
                              className="rounded-xl border border-white/[0.07] px-2.5 py-2 text-[11px] text-slate-500 transition hover:border-rose-300/10 hover:text-rose-200 disabled:opacity-40"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="shrink-0 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2 text-xs text-slate-400 lg:w-[12rem] lg:text-right">
                          {category.limitAmount === null
                            ? 'No limit'
                            : formatMoney(category.limitAmount, currency)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {limitError && (
              <p className="border-t border-rose-300/10 bg-rose-300/[0.03] px-6 py-3 text-xs text-rose-200">
                {limitError}
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Budget setup
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">
              Set the journey ceiling.
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Currency is inherited from the trip, so every expense stays in {currency}.
            </p>

            <div className="mt-5">
              <label className="text-xs font-medium text-slate-400">
                Total budget
              </label>

              {canEdit ? (
                <>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row xl:flex-col 2xl:flex-row">
                    <input
                      value={budgetAmount}
                      onChange={(event) => setBudgetAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="35000"
                      className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/40"
                    />
                    <button
                      type="button"
                      disabled={savingBudget}
                      onClick={() => void saveBudget()}
                      className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingBudget ? 'Saving' : overview.configured ? 'Update' : 'Set'}
                    </button>
                  </div>
                  {budgetError && (
                    <p className="mt-3 text-xs leading-5 text-rose-200">
                      {budgetError}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-2 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">
                    {formatMoney(totals.budgetAmount, currency)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Read-only budget access
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-sky-300/10 bg-[linear-gradient(145deg,rgba(14,46,63,0.55),rgba(8,20,30,0.7))] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/60">
              Financial signal
            </p>
            <p className="mt-3 text-lg font-semibold tracking-[-0.025em] text-white">
              {totals.usagePercentage === null
                ? 'Ready when you are.'
                : totals.usagePercentage < 70
                  ? 'Comfortably on track.'
                  : totals.usagePercentage < 100
                    ? 'Budget is getting tight.'
                    : 'Budget has been exceeded.'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {totals.usagePercentage === null
                ? 'Set a total budget and Meridian will calculate the pace automatically.'
                : `${totals.usagePercentage.toFixed(2)}% of the journey budget has been used so far.`}
            </p>
          </div>
        </aside>
      </div>

      {canEdit && showExpenseForm && (
        <ExpenseDialog
          form={expenseForm}
          currency={currency}
          error={expenseError}
          saving={savingExpense}
          onChange={setExpenseForm}
          onClose={() => {
            if (!savingExpense) {
              setShowExpenseForm(false);
              setExpenseError(null);
            }
          }}
          onSubmit={() => void saveExpense()}
        />
      )}

      {canEdit && deleteTarget && (
        <DeleteExpenseDialog
          expense={deleteTarget}
          currency={currency}
          deleting={deletingExpense}
          error={deleteError}
          onCancel={() => {
            if (!deletingExpense) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void confirmDeleteExpense()}
        />
      )}

      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
    </section>
  );
}
