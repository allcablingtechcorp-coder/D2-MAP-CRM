import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { localeCode, translate, type Locale, type TranslationKey } from "./translations";

export type { Locale, TranslationKey } from "./translations";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  formatDateTime: (value: string | Date) => string;
  formatShortDate: (value: string | Date) => string;
  formatMoney: (amountCents: number | null) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem("d2-crm-locale");
    return stored === "en" || stored === "es" || stored === "pt" ? stored : "pt";
  });

  useEffect(() => {
    localStorage.setItem("d2-crm-locale", locale);
    document.documentElement.lang = localeCode[locale];
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale: setLocaleState,
    t: (key, variables) => translate(locale, key, variables),
    formatDateTime: (value) => new Intl.DateTimeFormat(localeCode[locale], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)),
    formatShortDate: (value) => new Intl.DateTimeFormat(localeCode[locale], { day: "2-digit", month: "short" }).format(new Date(value)),
    formatMoney: (amountCents) => amountCents === null ? translate(locale, "common.notInformed") : new Intl.NumberFormat(localeCode[locale], { style: "currency", currency: "USD" }).format(amountCents / 100),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
