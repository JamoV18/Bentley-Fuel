"use client";

import Link from "next/link";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import { useLanguage, type SupportedLanguage } from "@/components/LanguageProvider";

type IntroCopy = {
  prefix: string;
  accent: string;
  description: string;
  cta: string;
  note: string;
};

const COPY: Record<SupportedLanguage, IntroCopy> = {
  en: {
    prefix: "Nutrition built around",
    accent: "where you actually eat.",
    description: "Tell Bentley Fuel what matters to you. Your goals, preferences, and campus dining options become practical meal recommendations.",
    cta: "Build my profile",
    note: "About one minute. You can change this later.",
  },
  es: {
    prefix: "Nutrición diseñada alrededor de",
    accent: "donde realmente comes.",
    description: "Dile a Bentley Fuel qué es importante para ti. Tus objetivos, preferencias y opciones de comida del campus se convierten en recomendaciones prácticas.",
    cta: "Crear mi perfil",
    note: "Aproximadamente un minuto. Puedes cambiarlo más tarde.",
  },
  fr: {
    prefix: "Une nutrition pensée autour de",
    accent: "là où vous mangez vraiment.",
    description: "Dites à Bentley Fuel ce qui compte pour vous. Vos objectifs, préférences et options de restauration sur le campus deviennent des recommandations de repas concrètes.",
    cta: "Créer mon profil",
    note: "Environ une minute. Vous pourrez modifier ces informations plus tard.",
  },
  zh: {
    prefix: "营养规划围绕",
    accent: "你真正用餐的地方。",
    description: "告诉 Bentley Fuel 什么对你最重要。你的目标、偏好和校园餐饮选择会转化为实用的餐食推荐。",
    cta: "创建我的资料",
    note: "大约一分钟，之后随时可以修改。",
  },
};

const MEALS = [
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=82",
] as const;

const DEG_TO_RAD = Math.PI / 180;
const RADIUS_X = 330;
const DEPTH = 190;

function CircularMealCard({
  image,
  index,
  total,
  rotation,
}: {
  image: string;
  index: number;
  total: number;
  rotation: MotionValue<number>;
}) {
  const baseAngle = (index / total) * 360;
  const angle = useTransform(rotation, (value) => (baseAngle + value) * DEG_TO_RAD);
  const x = useTransform(angle, (value) => Math.sin(value) * RADIUS_X);
  const y = useTransform(angle, (value) => (1 - Math.cos(value)) * 18);
  const z = useTransform(angle, (value) => Math.cos(value) * DEPTH);
  const scale = useTransform(angle, (value) => 0.69 + ((Math.cos(value) + 1) / 2) * 0.34);
  const opacity = useTransform(angle, (value) => 0.26 + ((Math.cos(value) + 1) / 2) * 0.74);
  const rotateY = useTransform(angle, (value) => -Math.sin(value) * 18);
  const filter = useTransform(angle, (value) => {
    const depth = (Math.cos(value) + 1) / 2;
    return `blur(${(1 - depth) * 1.5}px)`;
  });
  const zIndex = useTransform(angle, (value) => Math.round(((Math.cos(value) + 1) / 2) * 100));

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ x, y, z, scale, opacity, rotateY, filter, zIndex, transformStyle: "preserve-3d" }}
    >
      <div
        className="h-32 w-24 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.15rem] border border-white/80 bg-cover bg-center shadow-[0_18px_45px_rgba(20,45,34,.14)] sm:h-48 sm:w-36 lg:h-52 lg:w-40"
        style={{
          backgroundImage: `linear-gradient(180deg,rgba(255,255,255,.03)_42%,rgba(0,45,32,.16)),url(\"${image}\")`,
        }}
      />
    </motion.div>
  );
}

function CircularMealGallery({ reduceMotion }: { reduceMotion: boolean }) {
  const rotation = useMotionValue(0);

  const turn = (deltaX: number) => {
    rotation.set(rotation.get() + deltaX * 0.34);
  };

  const release = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const projectedRotation = rotation.get() + info.velocity.x * 0.075;
    animate(rotation, projectedRotation, {
      type: "spring",
      stiffness: 42,
      damping: 18,
      mass: 0.9,
      restDelta: 0.08,
    });
  };

  return (
    <motion.div
      aria-hidden="true"
      className="relative mt-4 h-[190px] w-full max-w-5xl cursor-grab select-none overflow-visible sm:mt-5 sm:h-[260px] active:cursor-grabbing"
      style={{ perspective: 900, transformStyle: "preserve-3d", touchAction: "pan-y" }}
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.58, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
      onPan={reduceMotion ? undefined : (_event, info) => turn(info.delta.x)}
      onPanEnd={reduceMotion ? undefined : release}
      onWheel={
        reduceMotion
          ? undefined
          : (event) => {
              const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
              rotation.set(rotation.get() - delta * 0.075);
            }
      }
    >
      <div className="absolute inset-x-[13%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-emerald-950/[.055] to-transparent" />
      {MEALS.map((image, index) => (
        <CircularMealCard key={image} image={image} index={index} total={MEALS.length} rotation={rotation} />
      ))}
      <div className="pointer-events-none absolute inset-x-[18%] bottom-1 h-10 rounded-[50%] bg-emerald-950/[.075] blur-2xl" />
    </motion.div>
  );
}

export default function OnboardingIntro({ onStart }: { onStart(): void }) {
  const reduceMotion = useReducedMotion();
  const { language } = useLanguage();
  const copy = COPY[language];
  const title = "Bentley Fuel";

  return (
    <main data-i18n-skip className="relative mx-auto flex min-h-[100svh] w-full max-w-[92rem] flex-1 flex-col overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-20 h-[28rem] rounded-full bg-[radial-gradient(circle,rgba(10,154,110,.11)_0%,rgba(10,154,110,.035)_42%,transparent_72%)] blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-emerald-950/[.035] to-transparent" />

      <header className="relative z-20 flex min-h-8 items-center justify-between">
        <Link href="/" className="brand-kicker transition-colors hover:text-emerald-950">Bentley Fuel</Link>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center pb-6 pt-10 text-center sm:pt-14 lg:pb-10">
        <div className="[perspective:900px]">
          <h1 className="flex flex-wrap justify-center text-[clamp(3.4rem,8vw,7.2rem)] font-bold leading-[.9] tracking-[-0.065em] text-emerald-950" aria-label={title}>
            {title.split("").map((character, index) => (
              <motion.span
                key={`${character}-${index}`}
                aria-hidden="true"
                className="inline-block whitespace-pre"
                style={{ transformOrigin: "50% 100%", transformStyle: "preserve-3d" }}
                initial={reduceMotion ? false : { opacity: 0, y: 22, rotateX: -88 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.05 + index * 0.026, ease: [0.22, 1, 0.36, 1] }}
              >
                {character}
              </motion.span>
            ))}
          </h1>
        </div>

        <motion.h2
          className="mt-6 max-w-4xl text-balance text-2xl font-semibold tracking-[-0.025em] text-black/72 sm:text-3xl lg:text-[2.15rem]"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.38, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>{copy.prefix} </span>
          <motion.span
            className="inline-block bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(100deg, #075a42 0%, #0a9a6e 38%, #31b98a 52%, #087a58 72%, #075a42 100%)",
              backgroundSize: "220% 100%",
            }}
            animate={reduceMotion ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: "linear" }}
          >
            {copy.accent}
          </motion.span>
        </motion.h2>

        <motion.p
          className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-black/50 sm:text-base"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.34, delay: 0.43, ease: [0.22, 1, 0.36, 1] }}
        >
          {copy.description}
        </motion.p>

        <CircularMealGallery reduceMotion={Boolean(reduceMotion)} />

        <motion.div
          className="mt-1 flex flex-col items-center"
          initial={reduceMotion ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.button
            type="button"
            className="primary min-w-48 px-6 py-3.5 text-base shadow-[0_12px_28px_rgba(0,59,42,.16)]"
            onClick={onStart}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            transition={{ duration: 0.12 }}
          >
            {copy.cta}
          </motion.button>
          <p className="mt-3 text-xs font-medium text-black/38">{copy.note}</p>
        </motion.div>
      </section>
    </main>
  );
}
