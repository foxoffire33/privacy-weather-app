import { create } from 'zustand';

import { isRecord, isStringArray } from '../stores/core/guards';

import en from './locales/en.json';

import type { I18nState, Language, LocaleModule, MessageKey, Messages, Vars } from '../types';

export type { MessageKey } from '../types';

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

function preferredLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') { return []; }
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

export function systemLanguage(): Language {
  for (const tag of preferredLanguages()) {
    const base = tag.toLowerCase().split('-', 1)[0];
    const match = LANGUAGES.find((l) => l.code === base);
    if (match !== undefined) { return match.code; }
  }
  return 'en';
}

export function resolveLanguage(pref: string | undefined): Language {
  return LANGUAGES.find((l) => l.code === pref)?.code ?? systemLanguage();
}

const DONE: Promise<void> = Object.assign(Promise.resolve(), { status: 'fulfilled', value: undefined });
const loading = new Map<Language, Promise<void>>();
const loaded = new Map<Language, Promise<void>>();

export function ensureLanguage(lang: Language): PromiseLike<void> {
  const pending = loading.get(lang);
  if (pending !== undefined) { return pending; }
  const promise = Promise.resolve().then(async () => useI18n.getState().setLanguage(lang));
  loading.set(lang, promise);
  void promise.then(() => {
    loading.delete(lang);
    loaded.set(lang, promise);
  });
  return promise;
}

export function languageLoaded(lang: Language): PromiseLike<void> {
  return loaded.get(lang) ?? DONE;
}

let languageRequest = 0;

export const useI18n = create<I18nState>((set, get) => ({
  lang: 'en',
  locale: 'en-GB',
  messages: en,
  ready: false,
  setLanguage: async (pref) => {
    const lang = resolveLanguage(pref);
    languageRequest += 1;
    const request = languageRequest;
    if (get().ready && get().lang === lang) { return; }
    let messages: Messages = en;
    if (lang !== 'en') {
      try {
        const mod = await loaders[`./locales/${lang}.json`]();
        messages = mod.default;
      } catch {
        messages = en;
      }
    }
    if (request !== languageRequest) { return; }
    const locale = LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-GB';
    document.documentElement.lang = lang;
    set({ lang, locale, messages, ready: true });
  },
}));

function lookup(messages: unknown, key: string): unknown {
  let node = messages;
  for (const part of key.split('.')) {
    if (!isRecord(node)) { return undefined; }
    node = node[part];
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
  if ((value === null || value === undefined) || (typeof value === 'string' && value === '')) { value = lookup(en, key); }
  if (isRecord(value)) {
    const count = typeof vars?.count === 'number' ? vars.count : 0;
    const enForms = lookup(en, key);
    value = value[pluralCategory(locale, count)] ?? value.other ?? (isRecord(enForms) ? enForms.other : undefined);
  }
  if (typeof value !== 'string') { return key; }
  return vars ? value.replaceAll(/\{(\w+)\}/g, (m, k: string) => ((vars[k] === null || vars[k] === undefined) ? m : String(vars[k]))) : value;
}

export function tl(key: MessageKey): string[] {
  const value = lookup(useI18n.getState().messages, key);
  const english = lookup(en, key);
  const fallback = isStringArray(english) ? english : [];
  return Array.isArray(value) ? fallback.map((f, i) => { const v: unknown = value[i]; return typeof v === 'string' && v !== '' ? v : f; }) : fallback;
}

export const currentLocale = (): string => useI18n.getState().locale;
