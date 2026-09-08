import Image from "next/image";
import FoodIllustration from "@/components/FoodIllustrationV2";
import LunchFoodIllustration from "@/components/LunchFoodIllustration";
import PremiumMenuFoodIllustration from "@/components/PremiumMenuFoodIllustration";
import VegetableDishIllustration, {
  isRecognizableVegetableDish,
} from "@/components/VegetableDishIllustration";
import { foodIllustrationKind, hasLunchFoodIllustration } from "@/lib/foodIllustrations";
import { hasExactMenuVisual } from "@/lib/menuIllustrationCatalog";
import { prerenderedFoodArtForName } from "@/lib/prerenderedFoodArt";

const INK = "#10263d";
const BOWL = "#fffdf8";
const OATMEAL = "#d98a3d";
const OAT = "#efc07b";

function PumpkinBakedOatmealBowl() {
  const oats = [
    [116, 112, 12, -7],
    [143, 105, 13, 8],
    [170, 115, 12, -3],
    [195, 106, 13, 7],
    [128, 130, 12, 5],
    [157, 135, 13, -6],
    [186, 132, 12, 4],
  ] as const;

  return (
    <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
      <g stroke={INK} strokeLinejoin="round">
        <ellipse cx="160" cy="122" rx="92" ry="43" fill={BOWL} strokeWidth="7" />
        <path
          d="M69 122c6 61 43 87 91 87s85-26 91-87c-22 22-55 34-91 34s-69-12-91-34Z"
          fill={BOWL}
          strokeWidth="7"
        />
        <ellipse cx="160" cy="122" rx="78" ry="31" fill={OATMEAL} strokeWidth="5" />
        <g fill={OAT} strokeWidth="3">
          {oats.map(([x, y, rx, rotation], index) => (
            <ellipse
              key={index}
              cx={x}
              cy={y}
              rx={rx}
              ry="6"
              transform={`rotate(${rotation} ${x} ${y})`}
            />
          ))}
        </g>
        <path
          d="M112 119c18 10 31-8 46 1s31 6 50-3M133 139c14 8 27-5 41 1"
          fill="none"
          stroke="#9b5a2b"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function SmoothieIllustration({ name }: { name: string }) {
  const value = name.toLowerCase();
  const isGreen = /spinach|avocado|green/.test(value);
  const isBerry = /berry|strawberry|raspberry|blueberry/.test(value);
  const isMango = /mango/.test(value);
  const isBanana = /banana/.test(value);
  const smoothie = isGreen ? "#80b955" : isBerry ? "#d77c98" : isMango || isBanana ? "#f0b94f" : "#e8a867";
  const smoothieDark = isGreen ? "#5b8f39" : isBerry ? "#a95876" : "#c98232";

  return (
    <svg className="ff-food-art ff-food-art-smoothie" viewBox="0 0 320 300" aria-hidden="true" focusable="false">
      <ellipse cx="160" cy="266" rx="76" ry="14" fill="rgba(16,38,61,.12)" />
      <g stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <path d="M195 50L212 18" fill="none" strokeWidth="8" />
        <path d="M195 50L212 18" fill="none" stroke="#f4c65e" strokeWidth="4" />
        <path d="M91 75H229L212 244Q209 261 193 263H127Q111 261 108 244Z" fill="rgba(255,255,255,.82)" strokeWidth="7" />
        <path d="M102 90H218L203 233Q201 244 190 246H130Q119 244 117 233Z" fill={smoothie} strokeWidth="3.5" />
        <ellipse cx="160" cy="90" rx="58" ry="18" fill={smoothie} strokeWidth="4" />
        <path d="M118 116Q136 104 151 112T190 108" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="5" />
        <path d="M124 142Q144 133 162 141T198 136" fill="none" stroke={smoothieDark} strokeWidth="3" opacity=".38" />
        <path d="M121 100L132 223" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="5" />
        <path d="M211 98L198 229" fill="none" stroke="rgba(16,38,61,.12)" strokeWidth="3" />
      </g>
      {isBanana && (
        <g transform="translate(221 83) rotate(18)">
          <circle r="23" fill="#f6dc72" stroke={INK} strokeWidth="4" />
          <circle r="12" fill="#fff0a8" stroke="#c99633" strokeWidth="2" />
          <circle r="2.8" fill="#7e5a2e" />
        </g>
      )}
      {isMango && (
        <g fill="#f29f38" stroke={INK} strokeWidth="2.5">
          <path d="M86 95l22-9 13 18-21 13Z" />
          <path d="M80 119l21-8 11 17-20 12Z" />
        </g>
      )}
      {isGreen && (
        <g transform="translate(95 84) rotate(-18)">
          <path d="M0 0C-19-15-33 7-18 23C-5 36 17 25 22 5C16-2 8-5 0 0Z" fill="#5ca248" stroke={INK} strokeWidth="3" />
          <path d="M-13 19L14 4" fill="none" stroke="#2c7035" strokeWidth="2.2" />
        </g>
      )}
    </svg>
  );
}

function PrerenderedFoodArt({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={520}
      height={360}
      unoptimized
      className="ff-food-art ff-food-art-prerendered"
    />
  );
}

export default function ServingAccurateFoodIllustration({ name }: { name: string }) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");

  const prerendered = prerenderedFoodArtForName(name);
  if (prerendered) {
    return <PrerenderedFoodArt src={prerendered} />;
  }

  if (/\b(smoothie|milkshake|shake)\b/.test(normalized)) {
    return <SmoothieIllustration name={name} />;
  }

  if (normalized === "pumpkin spice baked oatmeal") {
    return <PumpkinBakedOatmealBowl />;
  }

  // Local SVG renderers are the zero-cost production path. Approved remote
  // masters can still replace them explicitly, but missing art never requires
  // a generation request.
  if (hasExactMenuVisual(name)) {
    return <PremiumMenuFoodIllustration name={name} />;
  }

  if (hasLunchFoodIllustration(name)) {
    return <LunchFoodIllustration name={name} />;
  }

  if (isRecognizableVegetableDish(name)) {
    return <VegetableDishIllustration name={name} />;
  }

  if (foodIllustrationKind(name)) {
    return <FoodIllustration name={name} />;
  }

  return <PremiumMenuFoodIllustration name={name} />;
}
