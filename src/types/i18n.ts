import type { LANGUAGES } from '../i18n';
import type en from '../i18n/locales/en.json';

export type Messages = typeof en;

export interface Plural {
  one: string;
  other: string;
}

export type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural | readonly string[] ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export type Language = (typeof LANGUAGES)[number]['code'];

export interface LocaleModule {
  default: Messages;
}

export interface I18nState {
  lang: Language;
  locale: string;
  messages: Messages;
  ready: boolean;
  setLanguage: (pref: string | undefined) => Promise<void>;
}

export type Vars = Record<string, string | number | null | undefined>;
