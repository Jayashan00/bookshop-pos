import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const defaultSettings = {
  lang: 'en',
  theme: 'light',
  bigText: false,
  sound: true,
  shop: {
    nameEn: 'Sipsala Bookshop',
    nameSi: 'සිප්සල පොත් හල',
    addressEn: '',
    addressSi: '',
    phone: '',
    phone2: '',
    email: '',
    website: '',
    regNo: '',
    logo: '',          // upload under Settings → Shop details
    logoWidthMm: 0,
    logoHeightMm: 0,
  },
  receipt: {
    paper: '80',
    showLogo: true,
    bilingual: true,
    showBarcode: true,
    showSavings: true,
    showCashier: true,
    footerEn: 'Thank you! Please come again.',
    footerSi: 'ස්තූතියි! නැවත එන්න.',
    policyEn: 'Books and stationery can be exchanged within 7 days with this bill, in unused condition.',
    policySi: 'භාවිත නොකළ භාණ්ඩ මෙම බිල්පත සමඟ දින 7ක් ඇතුළත මාරු කළ හැක.',
    autoPrint: true,
    copies: 1,
    fontScale: 1,
  },
  labels: {
    template: 'z3-30x20',
    gapMm: 1.5,      // space between labels side by side (measured on the shop's Zebra roll)
    leftMm: 0.5,     // move the whole row right (+) or left (−)
    topMm: 0.8,      // move everything down (+) or up (−)
    showCostCode: true,
    costCode: { digits: 'GSAREHLIYN', zz: 'GE' }, // index = digit (0..9); zz = the code for "00"
    format: 'EAN13',
    prefix: '20',
    moduleMm: 0.25,
    showShop: true,
    showPrice: true,
    showVariant: true,
    nameLang: 'en',
  },
  tax: { enabled: false, rate: 18, inclusive: true, label: 'VAT' },
  loyalty: { enabled: true, rsPerPoint: 100, pointValue: 1 },
  quote: { validDays: 14, termsEn: 'Prices are valid for the period shown and subject to stock at the time of order.', termsSi: 'මිල ගණන් දක්වා ඇති කාලයට වලංගු වන අතර, ඇණවුම් කරන විට තොග තිබීම මත රඳා පවතී.' },
  terminal: { code: 'T1', name: 'Counter 1' },
  stock: { lowDefault: 5, allowNegative: false },
  sync: { url: '', key: '', auto: true, intervalMin: 5, lastPush: 0, lastPull: 0, lastResult: '' },
  currency: 'Rs.',
};

const merge = (persisted, current) => {
  const out = { ...current, ...persisted };
  for (const k of Object.keys(defaultSettings)) {
    if (defaultSettings[k] && typeof defaultSettings[k] === 'object' && !Array.isArray(defaultSettings[k])) {
      out[k] = { ...defaultSettings[k], ...(persisted?.[k] || {}) };
    }
  }
  return out;
};

export const useSettings = create(
  persist(
    (set) => ({
      ...defaultSettings,
      set: (patch) => set(patch),
      setSection: (section, patch) => set((s) => ({ [section]: { ...s[section], ...patch } })),
      reset: () => set({ ...defaultSettings }),
    }),
    {
      name: 'bookpos-settings',
      version: 1,
      merge,
    }
  )
);

export const getSettings = () => useSettings.getState();
