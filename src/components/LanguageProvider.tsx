"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { translateDiningText } from "@/lib/diningTranslations";
import { translateFrenchText } from "@/lib/frenchTranslations";
import { translateProfileText } from "@/lib/profileTranslations";
import {
  isAppLanguage,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  localeForLanguage,
  translateText,
  type AppLanguage,
} from "@/lib/i18n";
import { translateRuntimeText } from "@/lib/runtimeTranslations";

export type SupportedLanguage = AppLanguage | "fr";

export const SUPPORTED_LANGUAGE_OPTIONS: Array<{ code: SupportedLanguage; label: string; greeting: string; locale: string }> = [
  LANGUAGE_OPTIONS.find((option) => option.code === "en")!,
  LANGUAGE_OPTIONS.find((option) => option.code === "es")!,
  { code: "fr", label: "Français", greeting: "Bonjour", locale: "fr-FR" },
  LANGUAGE_OPTIONS.find((option) => option.code === "zh")!,
];

type LanguageContextValue = {
  language: SupportedLanguage;
  setLanguage(language: SupportedLanguage): void;
  t(source: string): string;
  locale: string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;
const ALL_LANGUAGES: SupportedLanguage[] = ["en", "es", "fr", "zh"];

function translateAny(source: string, language: SupportedLanguage) {
  const profileTranslation = translateProfileText(source, language);
  if (profileTranslation !== source) return profileTranslation;
  if (language === "fr") return translateFrenchText(source);
  const appLanguage = language as AppLanguage;
  const uiTranslation = translateText(source, appLanguage);
  if (uiTranslation !== source) return uiTranslation;
  const diningTranslation = translateDiningText(source, appLanguage);
  if (diningTranslation !== source) return diningTranslation;
  return translateRuntimeText(source, appLanguage);
}

function translateAnyPreservingWhitespace(value: string, language: SupportedLanguage) {
  const match = value.match(/^(\s*)(.*?)(\s*)$/s);
  if (!match) return value;
  const [, before, core, after] = match;
  if (!core) return value;
  return `${before}${translateAny(core, language)}${after}`;
}

function isSkipped(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  return Boolean(element?.closest("[data-i18n-skip]")) || element?.tagName === "SCRIPT" || element?.tagName === "STYLE";
}

function isTextVariant(source: string, value: string) {
  return ALL_LANGUAGES.some((language) => translateAnyPreservingWhitespace(source, language) === value);
}

function isAttributeVariant(source: string, value: string) {
  return ALL_LANGUAGES.some((language) => translateAny(source, language) === value);
}

function translateTextNode(node: Text, language: SupportedLanguage) {
  if (isSkipped(node)) return;
  const current = node.nodeValue ?? "";
  let source = originalText.get(node);
  if (source === undefined) {
    source = current;
    originalText.set(node, source);
  } else if (!isTextVariant(source, current)) {
    source = current;
    originalText.set(node, source);
  }
  const next = translateAnyPreservingWhitespace(source, language);
  if (node.nodeValue !== next) node.nodeValue = next;
}

function translateElementAttributes(element: Element, language: SupportedLanguage) {
  if (isSkipped(element)) return;
  let sources = originalAttributes.get(element);
  if (!sources) {
    sources = new Map<string, string>();
    originalAttributes.set(element, sources);
  }
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    let source = sources.get(attribute);
    if (source === undefined) {
      source = current;
      sources.set(attribute, source);
    } else if (!isAttributeVariant(source, current)) {
      source = current;
      sources.set(attribute, source);
    }
    const next = translateAny(source, language);
    if (current !== next) element.setAttribute(attribute, next);
  }
}

function translateTree(root: Node, language: SupportedLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE && isSkipped(root)) return;

  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root as Element, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, language);
    else translateElementAttributes(current as Element, language);
    current = walker.nextNode();
  }
}

function OnboardingLanguageChooser({ value, onChange, t }: { value: SupportedLanguage; onChange(language: SupportedLanguage): void; t(source: string): string }) {
  const reduceMotion = useReducedMotion();
  const selected = SUPPORTED_LANGUAGE_OPTIONS.find((option) => option.code === value) ?? SUPPORTED_LANGUAGE_OPTIONS[0];

  return (
    <section data-i18n-skip className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/[.08] bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5" aria-label="Language">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{t("Language")}</p>
          <div className="mt-1 flex min-h-9 items-center gap-3">
            <h2 className="text-lg font-bold text-emerald-950">{t("Choose your language")}</h2>
            <span className="relative inline-flex min-w-16 overflow-hidden rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={selected.code}
                  initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {selected.greeting}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end rounded-2xl bg-black/[.04] p-1" role="group" aria-label="Language options">
          {SUPPORTED_LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === value;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => onChange(option.code)}
                aria-pressed={active}
                className={`relative isolate rounded-xl px-3 py-2 text-sm font-bold transition-colors ${active ? "text-emerald-950" : "text-black/50 hover:text-emerald-900"}`}
              >
                {active && <motion.span layoutId="onboarding-language-pill" className="absolute inset-0 -z-10 rounded-xl bg-white shadow-sm" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34, mass: 0.55 }} />}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-black/50">{t("You can change this during onboarding. Bentley dining and location names stay unchanged.")}</p>
    </section>
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<SupportedLanguage>("en");
  const [onboardingHeader, setOnboardingHeader] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || isAppLanguage(stored)) setLanguageState(stored);
  }, []);

  useEffect(() => {
    if (pathname !== "/onboarding") {
      setOnboardingHeader(null);
      return;
    }
    const findHeader = () => setOnboardingHeader(document.querySelector<HTMLElement>("main > header"));
    findHeader();
    const frame = requestAnimationFrame(findHeader);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const setLanguage = (next: SupportedLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    locale: language === "fr" ? "fr-FR" : localeForLanguage(language as AppLanguage),
    t: (source: string) => translateAny(source, language),
  }), [language]);

  useLayoutEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
    translateTree(document.body, language);

    // English is already the authored UI, so observing every DOM mutation is unnecessary.
    if (language === "en") return;

    const pending = new Set<Node>();
    let frame: number | null = null;
    const flush = () => {
      frame = null;
      const nodes = Array.from(pending);
      pending.clear();
      nodes.forEach((node) => translateTree(node, language));
    };
    const schedule = (node: Node) => {
      pending.add(node);
      if (frame === null) frame = requestAnimationFrame(flush);
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") schedule(mutation.target);
        if (mutation.type === "childList") mutation.addedNodes.forEach(schedule);
        if (mutation.type === "attributes") schedule(mutation.target);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [language, pathname]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      {pathname === "/onboarding" && onboardingHeader && createPortal(
        <OnboardingLanguageChooser value={language} onChange={setLanguage} t={value.t} />,
        onboardingHeader,
      )}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
