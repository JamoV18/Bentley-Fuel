const INK = "#10263d";
const PLATE = "#fffdf8";
const ZUCCHINI = "#2f8f45";
const ZUCCHINI_INNER = "#b9db78";
const SQUASH = "#f3c742";
const CARROT = "#eb8b35";
const RED_PEPPER = "#df4a3a";
const GREEN_PEPPER = "#3d9a4a";
const MUSHROOM = "#b68763";
const MUSHROOM_INNER = "#ead7bd";
const BALSAMIC = "#6d4436";

function Plate() {
  return (
    <g>
      <ellipse cx="160" cy="154" rx="126" ry="58" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="154" rx="105" ry="44" fill="none" stroke="#dfe8ed" strokeWidth="3" />
    </g>
  );
}

function ZucchiniCoin({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx="22" ry="17" fill={ZUCCHINI} stroke={INK} strokeWidth="4" />
      <ellipse cx={x} cy={y} rx="14" ry="10" fill={ZUCCHINI_INNER} stroke={INK} strokeWidth="2" />
      <g fill="#eef1c8">
        <circle cx={x - 5} cy={y - 2} r="2.3" />
        <circle cx={x + 5} cy={y - 1} r="2.3" />
        <circle cx={x} cy={y + 4} r="2.3" />
      </g>
    </g>
  );
}

function SquashHalfMoon({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`}>
      <path
        d={`M${x - 25} ${y + 7}c7-24 43-28 52-2-9 15-36 21-52 2Z`}
        fill={SQUASH}
        stroke={INK}
        strokeWidth="4"
      />
      <path
        d={`M${x - 11} ${y + 2}c7-8 19-9 26-1`}
        fill="none"
        stroke="#fff3b0"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </g>
  );
}

function CarrotCoin({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx="19" ry="13" fill={CARROT} stroke={INK} strokeWidth="4" />
      <path d={`M${x - 7} ${y}h14M${x} ${y - 5}v10`} stroke="#c86b26" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function PepperStrip({ x, y, r = 0, color = RED_PEPPER }: { x: number; y: number; r?: number; color?: string }) {
  return (
    <path
      d={`M${x - 24} ${y + 4}q22-22 48-5`}
      transform={`rotate(${r} ${x} ${y})`}
      fill="none"
      stroke={color}
      strokeWidth="13"
      strokeLinecap="round"
    />
  );
}

function MushroomSlice({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`} stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d={`M${x - 24} ${y}q24-28 48 0q-24 14-48 0Z`} fill={MUSHROOM} />
      <path d={`M${x - 6} ${y + 1}v20h12V${y + 1}`} fill={MUSHROOM_INNER} />
    </g>
  );
}

function MixedVegetables({ balsamic = false }: { balsamic?: boolean }) {
  return (
    <g>
      <Plate />
      <ZucchiniCoin x={105} y={142} r={-14} />
      <SquashHalfMoon x={143} y={122} r={8} />
      <CarrotCoin x={184} y={139} r={-8} />
      <PepperStrip x={211} y={119} r={16} />
      <ZucchiniCoin x={132} y={166} r={11} />
      <SquashHalfMoon x={175} y={164} r={-9} />
      <PepperStrip x={212} y={163} r={-14} color={GREEN_PEPPER} />
      <CarrotCoin x={104} y={171} r={9} />
      {balsamic && (
        <path
          d="M91 128c28 13 52 4 75 14 23 10 44-2 65 9"
          fill="none"
          stroke={BALSAMIC}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function GrilledVegetables() {
  return (
    <g>
      <Plate />
      <g transform="translate(-4 -2)">
        <ZucchiniCoin x={111} y={144} r={-12} />
        <ZucchiniCoin x={150} y={125} r={8} />
        <SquashHalfMoon x={193} y={140} r={-7} />
        <PepperStrip x={211} y={165} r={-10} />
        <PepperStrip x={137} y={169} r={9} color={GREEN_PEPPER} />
      </g>
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" opacity=".7">
        <path d="M97 135l25 8" />
        <path d="M138 118l25 8" />
        <path d="M181 134l25 7" />
      </g>
    </g>
  );
}

function RoastedMushrooms() {
  return (
    <g>
      <Plate />
      <MushroomSlice x={103} y={139} r={-10} />
      <MushroomSlice x={142} y={122} r={8} />
      <MushroomSlice x={183} y={139} r={-6} />
      <MushroomSlice x={216} y={121} r={10} />
      <MushroomSlice x={128} y={166} r={7} />
      <MushroomSlice x={175} y={166} r={-8} />
      <g fill="#4e9c45">
        <circle cx="112" cy="124" r="4" />
        <circle cx="163" cy="147" r="4" />
        <circle cx="205" cy="158" r="4" />
      </g>
    </g>
  );
}

export function isRecognizableVegetableDish(name: string): boolean {
  const value = name.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  return (
    /balsamic roasted vegetables/.test(value) ||
    /squash.*zucchini.*peppers.*carrots/.test(value) ||
    /grilled vegetables/.test(value) ||
    /herb roasted mushrooms/.test(value)
  );
}

export default function VegetableDishIllustration({ name }: { name: string }) {
  const value = name.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  let art = <MixedVegetables />;

  if (/herb roasted mushrooms/.test(value)) art = <RoastedMushrooms />;
  else if (/grilled vegetables/.test(value)) art = <GrilledVegetables />;
  else if (/balsamic roasted vegetables/.test(value)) art = <MixedVegetables balsamic />;

  return (
    <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
      {art}
    </svg>
  );
}
