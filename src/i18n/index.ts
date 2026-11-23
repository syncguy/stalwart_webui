/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ru from './ru.json';
import { useSchemaStore } from '@/stores/schemaStore';

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];
const LOCALE_STORAGE_KEY = 'stalwart.webui.locale';

function normalizeLocale(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase();
}

function savedLocale(): string | null {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === 'en' || value === 'ru' ? value : null;
  } catch {
    // Private browsing or disabled storage must not block application startup.
    return null;
  }
}

const initialLocale = savedLocale() ?? normalizeLocale(navigator.language || 'en');

// The schema store must know the selected locale BEFORE the first schema fetch.
// i18next can fire its initial languageChanged event before listeners register.
useSchemaStore.getState().setDisplayLanguage(initialLocale);

function syncDocumentLanguage(language: string) {
  const lang = normalizeLocale(language);
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', (language) => {
  useSchemaStore.getState().setDisplayLanguage(language);
  syncDocumentLanguage(language);
});

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru } },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

syncDocumentLanguage(initialLocale);

export function setLocale(locale: string) {
  const lang = normalizeLocale(locale);
  if (lang !== 'en' && lang !== 'ru') return;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lang);
  } catch {
    // The currently displayed locale still changes when storage is denied.
  }

  void i18n.changeLanguage(lang);
}

export default i18n;
