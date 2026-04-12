import en from '@/locales/en.json';
import vi from '@/locales/vi.json';

export type LocaleCode = 'vi' | 'en';
type I18nDict = Record<string, string>;
type I18nParams = Record<string, string | number>;

const dictionaries: Record<LocaleCode, I18nDict> = {
  vi,
  en,
};

const warnedMissingKeys = new Set<string>();
const DEFAULT_LOCALE: LocaleCode = 'vi';
const FALLBACK_MESSAGE = vi['common.updating'] || 'Nội dung đang được cập nhật';

let activeLocale: LocaleCode = DEFAULT_LOCALE;

export function setLocale(locale: LocaleCode): void {
  activeLocale = locale;
}

export function getLocale(): LocaleCode {
  return activeLocale;
}

function format(template: string, params?: I18nParams): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name: string) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      return String(params[name]);
    }
    return `{${name}}`;
  });
}

function getTemplate(locale: LocaleCode, key: string): string | undefined {
  return dictionaries[locale][key] || dictionaries[DEFAULT_LOCALE][key];
}

function warnMissing(locale: LocaleCode, key: string): void {
  const warningId = `${locale}:${key}`;
  if (warnedMissingKeys.has(warningId)) return;
  warnedMissingKeys.add(warningId);
  console.warn(`[i18n] Missing translation for key "${key}" (locale "${locale}")`);
}

export function t(
  key: string,
  params?: I18nParams,
  options?: { locale?: LocaleCode; fallback?: string },
): string {
  const locale = options?.locale || activeLocale;
  const template = getTemplate(locale, key);
  if (!template) {
    warnMissing(locale, key);
    return format(options?.fallback || FALLBACK_MESSAGE, params);
  }
  return format(template, params);
}
