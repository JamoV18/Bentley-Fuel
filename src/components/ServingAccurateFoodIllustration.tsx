import FoodIllustration from "@/components/FoodIllustrationV2";
import LunchFoodIllustration from "@/components/LunchFoodIllustration";
import MenuFoodIllustration from "@/components/MenuFoodIllustration";
import { foodIllustrationKind, hasLunchFoodIllustration } from "@/lib/foodIllustrations";
import { hasExactMenuVisual } from "@/lib/menuIllustrationCatalog";

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

export default function ServingAccurateFoodIllustration({ name }: { name: string }) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");

  if (normalized === "pumpkin spice baked oatmeal") {
    return <PumpkinBakedOatmealBowl />;
  }

  if (hasLunchFoodIllustration(name)) {
    return <LunchFoodIllustration name={name} />;
  }

  if (hasExactMenuVisual(name)) {
    return <MenuFoodIllustration name={name} />;
  }

  if (foodIllustrationKind(name)) {
    return <FoodIllustration name={name} />;
  }

  // The menu artwork is now the fallback itself. Unknown dinner/live-menu
  // items still render in the Falcon illustration language instead of
  // reverting to a stock or unpublished dining photo.
  return <MenuFoodIllustration name={name} />;
}
