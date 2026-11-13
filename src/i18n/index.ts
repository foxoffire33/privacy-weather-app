import { create } from 'zustand';

import en from './locales/en.json';
import type { I18nState, Language, LocaleModule, MessageKey, Messages, Vars } from '../types';

export type { Language, MessageKey, Messages } from '../types';

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

const loaders = import.meta.glob<LocaleModule>(['./locales/*.json', '!./locales/en.json']);

export function systemLanguage(): Language {
  const prefs = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of prefs) {
    const base = (tag ?? '').toLowerCase().split('-')[0];
    if (LANGUAGES.some((l) => l.code === base)) return base as Language;
  }
  return 'en';
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: 'en',
  locale: 'en-GB',
  messages: en,
  ready: false,
  setLanguage: async (pref) => {
    const known = LANGUAGES.some((l) => l.code === pref);
    const lang: Language = known ? pref as Language : systemLanguage();
    if (get().ready && get().lang === lang) return;
    let messages: Messages = en;
    if (lang !== 'en') {
      try {
        messages = (await loaders[`./locales/${lang}.json`]()).default;
      } catch {
        messages = en;
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

export function tl(key: MessageKey): string[] {
  const value = lookup(useI18n.getState().messages, key);
  const fallback = lookup(en, key) as string[];
  return Array.isArray(value) ? fallback.map((f, i) => (value[i] as string) || f) : fallback;
}

export const currentLocale = () => useI18n.getState().locale;
