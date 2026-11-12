import { create } from 'zustand';

import en from './locales/en.json';

// Translations: one static JSON file per language in ./locales, English (en.json) is the
// source and the fallback for anything a translation lacks. The active language lives in
// a small store; the app re-renders from the root when it changes, so t() is a plain
// function usable anywhere (components, formatters, insights).

export type Messages = typeof en;
type Plural = { one: string; other: string };
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural | readonly string[] ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

// English plus every official language of the European Union, each named in itself.
export const LANGUAGES = [
  { code: 'bg', name: 'Български', locale: 'bg-BG' },
  { code: 'cs', name: 'Čeština', locale: 'cs-CZ' },
  { code: 'da', name: 'Dansk', locale: 'da-DK' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'el', name: 'Ελληνικά', locale: 'el-GR' },
  { code: 'en', name: 'English', locale: 'en-GB' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'et', name: 'Eesti', locale: 'et-EE' },
  { code: 'fi', name: 'Suomi', locale: 'fi-FI' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'ga', name: 'Gaeilge', locale: 'ga-IE' },
  { code: 'hr', name: 'Hrvatski', locale: 'hr-HR' },
  { code: 'hu', name: 'Magyar', locale: 'hu-HU' },
  { code: 'it', name: 'Italiano', locale: 'it-IT' },
  { code: 'lt', name: 'Lietuvių', locale: 'lt-LT' },
  { code: 'lv', name: 'Latviešu', locale: 'lv-LV' },
  { code: 'mt', name: 'Malti', locale: 'mt-MT' },
  { code: 'nl', name: 'Nederlands', locale: 'nl-NL' },
  { code: 'pl', name: 'Polski', locale: 'pl-PL' },
  { code: 'pt', name: 'Português', locale: 'pt-PT' },
  { code: 'ro', name: 'Română', locale: 'ro-RO' },
  { code: 'sk', name: 'Slovenčina', locale: 'sk-SK' },
  { code: 'sl', name: 'Slovenščina', locale: 'sl-SI' },
  { code: 'sv', name: 'Svenska', locale: 'sv-SE' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];
export type LanguagePref = Language | 'system';

const loaders = import.meta.glob<{ default: Messages }>(['./locales/*.json', '!./locales/en.json']);

/** The first of the device's preferred languages that the app supports, else English. */
export function systemLanguage(): Language {
  const prefs = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of prefs) {
    const base = (tag ?? '').toLowerCase().split('-')[0];
    if (LANGUAGES.some((l) => l.code === base)) return base as Language;
  }
  return 'en';
}

interface I18nState {
  lang: Language;
  locale: string;
  messages: Messages;
  ready: boolean;
  setLanguage: (pref: LanguagePref | undefined) => Promise<void>;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: 'en',
  locale: 'en-GB',
  messages: en,
  ready: false,
  setLanguage: async (pref) => {
    const lang = !pref || pref === 'system' ? systemLanguage() : pref;
    if (get().ready && get().lang === lang) return;
    let messages: Messages = en;
    if (lang !== 'en') {
      try {
        messages = (await loaders[`./locales/${lang}.json`]()).default;
      } catch {
        messages = en; // missing file: stay readable in English
      }
    }
    const locale = LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-GB';
    document.documentElement.lang = lang;
    set({ lang, locale, messages, ready: true });
  },
}));

function lookup(messages: unknown, key: string): unknown {
  let node = messages;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(locale: string, n: number) {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(n);
}

type Vars = Record<string, string | number | null | undefined>;

/** Translates a key. {name} placeholders are filled from vars; a `count` var picks the plural form. */
export function t(key: MessageKey, vars?: Vars): string {
  const { messages, locale } = useI18n.getState();
  let value = lookup(messages, key);
  if (value == null || (typeof value === 'string' && !value)) value = lookup(en, key);
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const forms = value as Record<string, string>;
    const count = typeof vars?.count === 'number' ? vars.count : 0;
    const enForms = lookup(en, key) as Record<string, string>;
    value = forms[pluralCategory(locale, count)] ?? forms.other ?? enForms.other;
  }
  if (typeof value !== 'string') return key;
  return vars ? value.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] == null ? m : String(vars[k]))) : value;
}

/** A translated list (e.g. level names), falling back to English per item. */
export function tl(key: MessageKey): string[] {
  const value = lookup(useI18n.getState().messages, key);
  const fallback = lookup(en, key) as string[];
  return Array.isArray(value) ? fallback.map((f, i) => (value[i] as string) || f) : fallback;
}

/** The active locale for dates and numbers, e.g. 'nl-NL'. */
export const currentLocale = () => useI18n.getState().locale;
