"use client";

import { useState } from "react";

const AUTHOR_NAME = "Arya Achmad Caesar";
const AUTHOR_NPM = "237006093";

/** Body POST ke /predict — samakan key dengan Model-API Python */
type PredictRequest = {
  Engine_size: number;
  Horsepower: number;
  Wheelbase: number;
  Width: number;
  Length: number;
  Curb_weight: number;
  Fuel_capacity: number;
  Fuel_efficiency: number;
};

const INITIAL: PredictRequest = {
  Engine_size: 2.5,
  Horsepower: 150,
  Wheelbase: 100,
  Width: 70,
  Length: 180,
  Curb_weight: 3,
  Fuel_capacity: 15,
  Fuel_efficiency: 25,
};

type ParsedPrice = { amount: number; currency: "USD" | "IDR" };

function formatMoney({ amount, currency }: ParsedPrice): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 0 : 0,
  }).format(amount);
}

function parsePredictPrice(data: unknown): ParsedPrice | null {
  if (typeof data !== "object" || data === null) return null;
  const root = data as Record<string, unknown>;
  const inner =
    typeof root.data === "object" && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;

  const thousands = inner.predicted_price_in_thousands;
  if (typeof thousands === "number" && Number.isFinite(thousands)) {
    return { amount: thousands * 1000, currency: "USD" };
  }
  if (typeof thousands === "string") {
    const n = Number(thousands);
    if (Number.isFinite(n)) return { amount: n * 1000, currency: "USD" };
  }

  const keys = ["price", "predicted_price", "prediction", "harga"] as const;
  for (const k of keys) {
    const v = inner[k] ?? root[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      return { amount: v, currency: "IDR" };
    }
    if (typeof v === "string") {
      const n = Number(v.replace(/\s/g, "").replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) return { amount: n, currency: "IDR" };
    }
  }
  return null;
}

function formatApiError(data: unknown, status: number): string {
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    const d = o.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0];
      if (typeof first === "object" && first !== null && "msg" in first) {
        return String((first as { msg: unknown }).msg);
      }
    }
  }
  return `Gagal (${status})`;
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:focus:border-emerald-500/60 dark:focus:ring-emerald-400/15";

const labelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const FIELDS: {
  key: keyof PredictRequest;
  label: string;
  step?: string;
  min?: number;
}[] = [
  { key: "Engine_size", label: "Engine size (L)", step: "0.1" },
  { key: "Horsepower", label: "Horsepower (HP)", step: "1" },
  { key: "Wheelbase", label: "Wheelbase", step: "0.1" },
  { key: "Width", label: "Width", step: "0.1" },
  { key: "Length", label: "Length", step: "0.1" },
  { key: "Curb_weight", label: "Curb weight", step: "0.01", min: 0 },
  { key: "Fuel_capacity", label: "Fuel capacity", step: "0.1", min: 0 },
  { key: "Fuel_efficiency", label: "Fuel efficiency", step: "0.1", min: 0 },
];

export default function Home() {
  const [form, setForm] = useState<PredictRequest>(INITIAL);
  const [submitted, setSubmitted] = useState<PredictRequest | null>(null);
  const [priceResult, setPriceResult] = useState<ParsedPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "IDR">("USD");
  const USD_TO_IDR = 17546.65; // static conversion rate for display only

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_PREDICT_API_BASE?.trim();
      if (!base) {
        throw new Error(
          "Set NEXT_PUBLIC_PREDICT_API_BASE di .env (URL server Python)",
        );
      }
      const url = `${base.replace(/\/$/, "")}/predict`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiError(data, res.status));
      }
      if (
        typeof data === "object" &&
        data !== null &&
        (data as Record<string, unknown>).status === "error"
      ) {
        throw new Error(
          String((data as Record<string, unknown>).message ?? "Prediksi gagal"),
        );
      }
      const parsed = parsePredictPrice(data);
      if (parsed === null) {
        throw new Error(
          "Respons tidak berisi harga (data.predicted_price_in_thousands atau price)",
        );
      }
      setPriceResult(parsed);
      setSubmitted({ ...form });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permintaan gagal");
    } finally {
      setLoading(false);
    }
  }

  const display = submitted ?? form;

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-zinc-50 via-white to-emerald-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/20">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.12), transparent 45%),
            radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.08), transparent 40%)`,
        }}
      />

      <main className="relative mx-auto flex max-w-4xl lg:max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <header className="text-center lg:text-left lg:flex-1">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Estimasi berbasis atribut kendaraan
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
              Prediksi Harga Mobil
            </h1>
          </header>

          <div className="w-full lg:w-120">
            <div className="rounded-2xl border border-sky-200/70 bg-linear-to-br from-sky-50 to-sky-100/60 p-4 text-sm shadow-md shadow-sky-100/50 dark:border-sky-900/40 dark:from-sky-950/35 dark:to-sky-900/20 dark:shadow-black/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                Sistem ini dibuat oleh
              </p>
              <div className="mt-3 space-y-2 text-zinc-800 dark:text-zinc-200">
                <div className="flex flex-row items-baseline gap-3">
                  <span className="shrink-0 font-medium text-sky-900 dark:text-sky-200">Nama</span>
                  <span className="min-h-5 flex-10 border-b border-dotted border-sky-300/80 pb-0.5 text-zinc-600 dark:border-sky-700 dark:text-zinc-400">{AUTHOR_NAME}</span>
                 <span className="shrink-0 font-medium text-sky-900 dark:text-sky-200">NPM</span>
                  <span className="min-h-5 flex-1 border-b border-dotted border-sky-300/80 pb-0.5 text-zinc-600 dark:border-sky-700 dark:text-zinc-400">{AUTHOR_NPM}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
          <section className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-lg shadow-zinc-200/50 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-black/40 sm:p-8"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Fitur model
              </h2>

              <div className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[480px] overflow-y-auto pr-2">
                  {FIELDS.map(({ key, label, step, min }) => (
                    <div key={key} className="flex flex-col">
                      <label htmlFor={key} className={labelClass}>
                        {label}
                      </label>
                      <input
                        id={key}
                        type="number"
                        min={min}
                        step={step ?? "any"}
                        className={fieldClass}
                        value={form[key]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setForm((s) => ({
                            ...s,
                            [key]: Number.isFinite(v) ? v : s[key],
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:shadow-emerald-900/40 dark:hover:bg-emerald-400"
              >
                {loading ? "Menghitung…" : "Hitung harga mobil"}
              </button>
            </form>
          </section>

          <div className="flex flex-col gap-6 lg:col-span-7">
            

            <section className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-lg shadow-zinc-200/50 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-black/40 sm:p-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Perkiraan harga mobil
              </h2>

              <div className="mt-6 rounded-2xl border border-amber-200/80 bg-linear-to-br from-amber-50 to-amber-100/80 p-8 text-center shadow-inner dark:border-amber-900/50 dark:from-amber-950/40 dark:to-amber-900/20">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-800/90 dark:text-amber-200/80">
                    Estimasi
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDisplayCurrency("USD")}
                      className={`text-xs rounded-md px-2 py-1 ${displayCurrency === "USD" ? "bg-white/90 text-amber-900" : "bg-white/30 text-amber-700"} dark:${displayCurrency === "USD" ? "bg-zinc-900 text-amber-100" : "bg-zinc-800/40 text-amber-200"}`}
                    >
                      USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayCurrency("IDR")}
                      className={`text-xs rounded-md px-2 py-1 ${displayCurrency === "IDR" ? "bg-white/90 text-amber-900" : "bg-white/30 text-amber-700"} dark:${displayCurrency === "IDR" ? "bg-zinc-900 text-amber-100" : "bg-zinc-800/40 text-amber-200"}`}
                    >
                      IDR
                    </button>
                  </div>
                </div>

                <p className="mt-2 min-h-10 wrap-break-word text-3xl font-bold tabular-nums tracking-tight text-amber-950 sm:text-4xl dark:text-amber-100">
                  {loading ? (
                    <span className="text-amber-800/80 dark:text-amber-200/70">Menghitung…</span>
                  ) : priceResult !== null ? (
                    // compute shown value based on displayCurrency
                    (() => {
                      if (!priceResult) return null;
                      if (displayCurrency === priceResult.currency) return formatMoney(priceResult);
                      if (displayCurrency === "IDR" && priceResult.currency === "USD") {
                        const amt = Math.round(priceResult.amount * USD_TO_IDR);
                        return formatMoney({ amount: amt, currency: "IDR" });
                      }
                      if (displayCurrency === "USD" && priceResult.currency === "IDR") {
                        const amt = Math.round(priceResult.amount / USD_TO_IDR);
                        return formatMoney({ amount: amt, currency: "USD" });
                      }
                      return formatMoney(priceResult);
                    })()
                  ) : (
                    <span className="text-2xl font-semibold text-amber-800/70 dark:text-amber-200/60">Tekan hitung</span>
                  )}
                </p>
                {error && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
                    {error}
                  </p>
                )}
                {!loading && priceResult !== null && submitted && (
                  <p className="mt-3 text-xs text-amber-900/70 dark:text-amber-200/60">
                    {displayCurrency !== priceResult.currency ? (
                      <>
                        Konversi dari {priceResult.currency} • 1 USD ≈ {USD_TO_IDR.toLocaleString()} IDR
                      </>
                    ) : (
                      <>Output model ({priceResult.currency}).</>
                    )}
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Ringkasan input
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
                  {FIELDS.map(({ key, label }) => (
                    <li
                      key={key}
                      className="flex justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
                    >
                      <span className="text-zinc-500">{label}</span>
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {display[key]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
