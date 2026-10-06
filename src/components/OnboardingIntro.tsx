"use client";

import { LanguageChooser, useLanguage, type SupportedLanguage } from "@/components/LanguageProvider";

type IntroCopy = {
  prefix: string;
  accent: string;
  description: string;
  cta: string;
};

const COPY: Record<SupportedLanguage, IntroCopy> = {
  en: {
    prefix: "Nutrition built around",
    accent: "where you actually eat.",
    description: "Your goals, preferences, and Bentley dining options — translated into practical meal recommendations.",
    cta: "Build my profile",
  },
  es: {
    prefix: "Nutrición diseñada alrededor de",
    accent: "donde realmente comes.",
    description: "Tus objetivos, preferencias y opciones de comida de Bentley, convertidos en recomendaciones prácticas.",
    cta: "Crear mi perfil",
  },
  fr: {
    prefix: "Une nutrition pensée autour de",
    accent: "là où vous mangez vraiment.",
    description: "Vos objectifs, préférences et options de restauration à Bentley, transformés en recommandations concrètes.",
    cta: "Créer mon profil",
  },
  zh: {
    prefix: "营养规划围绕",
    accent: "你真正用餐的地方。",
    description: "将你的目标、偏好和 Bentley 校园餐饮选择转化为实用的餐食推荐。",
    cta: "创建我的资料",
  },
};

export default function OnboardingIntro({ onStart }: { onStart(): void }) {
  const { language } = useLanguage();
  const copy = COPY[language];
  return <main data-i18n-skip className="ff-intro">
    <header className="ff-intro-header"><p className="brand-kicker">Falcon Fuel</p><LanguageChooser /></header>
    <h1>{copy.prefix} {copy.accent}</h1>
    <p>{copy.description}</p>
    <button type="button" className="primary" onClick={onStart}>{copy.cta}</button>
  </main>;
}
