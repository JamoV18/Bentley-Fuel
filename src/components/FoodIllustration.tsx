import "./food-illustration.css";
import {
  foodIllustrationKind,
  omeletIngredientsForName,
  omeletUsesEggWhites,
  type OmeletIngredient,
} from "@/lib/foodIllustrations";

const INK = "#10263d";
const PLATE = "#fffdf8";
const EGG = "#f7c934";
const EGG_WHITE = "#fff2b8";
const GREEN = "#45a735";
const GREEN_LIGHT = "#75c94a";
const RED = "#ef4a3c";
const PURPLE = "#c981d8";
const MUSHROOM = "#f3e5cf";
const MUSHROOM_INNER = "#ad7046";
const CHEESE = "#f3a90b";
const SAUSAGE = "#b86b35";
const SAUSAGE_CUT = "#e5b982";
const BEAN = "#25213b";

function Plate() {
  return (
    <g>
      <ellipse cx="160" cy="163" rx="126" ry="57" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="163" rx="105" ry="43" fill="none" stroke={INK} strokeWidth="4" />
    </g>
  );
}

function Scrambled({ pale = false }: { pale?: boolean }) {
  const fill = pale ? EGG_WHITE : EGG;
  return (
    <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
      <path d="M73 147c-12-17 4-34 23-29 5-20 31-24 42-7 13-17 41-10 43 10 19-13 43 3 37 24 19 9 12 35-10 34-6 17-33 22-46 6-11 15-36 12-44-3-17 9-38-7-31-25-11 2-20-2-24-10-4-8-1-18 8-25Z" fill={fill} />
      <path d="M95 144c11 7 19 10 31 10M138 127c8 6 15 9 26 9M160 162c10 7 18 9 30 8" fill="none" stroke={pale ? "#e7c95e" : "#dd9911"} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Spinach() {
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      <path d="M91 165c-16-28 8-53 38-42 3-25 34-35 50-14 17-13 45-4 47 19 26-2 36 30 16 45-20 14-52 10-71-1-25 16-63 13-80-7Z" fill={GREEN} />
      <path d="M113 142c12 8 19 17 26 29M151 126c3 14 8 25 18 39M189 133c-6 12-10 23-10 36" fill="none" stroke="#1e6d31" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Tomatoes() {
  const blocks = [[98,130],[132,112],[169,128],[201,112],[119,160],[160,158],[197,156]];
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      {blocks.map(([x,y], i) => <rect key={i} x={x} y={y} width="32" height="27" rx="7" fill={RED} />)}
      <g fill="#ffd77a" stroke="none">
        <circle cx="110" cy="142" r="3"/><circle cx="144" cy="124" r="3"/><circle cx="181" cy="140" r="3"/><circle cx="213" cy="124" r="3"/>
      </g>
    </g>
  );
}

function Onions() {
  const blocks = [[95,128],[127,110],[163,128],[197,112],[118,158],[154,160],[191,155]];
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      {blocks.map(([x,y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="31" height="27" rx="7" fill="#fffaf2" />
          <path d={`M${x+4} ${y+22}h23v-7`} fill="none" stroke={PURPLE} strokeWidth="5" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

function Mushrooms() {
  const pieces = [[112,142,0],[164,122,-8],[203,147,10]] as const;
  return (
    <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
      {pieces.map(([x,y,r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M-29 2c1-22 14-34 29-34S28-20 29 2H8v28H-8V2Z" fill={MUSHROOM} />
          <path d="M-15 2c5-10 25-10 30 0" fill="none" stroke={MUSHROOM_INNER} strokeWidth="7" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

function GreenPepper() {
  const blocks = [[94,130,36,24],[134,111,31,28],[171,133,37,24],[204,111,28,30],[113,162,35,22],[157,160,32,25],[194,155,35,23]] as const;
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      {blocks.map(([x,y,w,h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="7" fill={i%2 ? GREEN : GREEN_LIGHT} />)}
    </g>
  );
}

function Cheddar() {
  const strips = [[91,126,62,-10],[121,112,76,12],[144,142,74,-5],[104,157,72,7],[169,162,55,-12],[194,129,48,9]] as const;
  return (
    <g stroke={INK} strokeWidth="5" strokeLinecap="round">
      {strips.map(([x,y,len,r], i) => <line key={i} x1={x} y1={y} x2={x+len} y2={y} transform={`rotate(${r} ${x} ${y})`} stroke={CHEESE} strokeWidth="12" />)}
    </g>
  );
}

function TurkeySausage() {
  const blocks = [[98,128],[132,110],[167,130],[202,113],[118,158],[156,159],[194,156]];
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      {blocks.map(([x,y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="32" height="29" rx="8" fill={SAUSAGE} />
          <path d={`M${x+5} ${y+5}h22v8H${x+5}Z`} fill={SAUSAGE_CUT} stroke="none" />
        </g>
      ))}
    </g>
  );
}

function BlackBeans() {
  const beans = [[103,131,-12],[134,112,10],[167,132,-8],[201,115,13],[119,161,8],[154,160,-11],[193,156,7]] as const;
  return (
    <g fill={BEAN} stroke={INK} strokeWidth="4">
      {beans.map(([x,y,r], i) => <ellipse key={i} cx={x} cy={y} rx="18" ry="12" transform={`rotate(${r} ${x} ${y})`} />)}
    </g>
  );
}

function OmeletFilling({ ingredient, index }: { ingredient: OmeletIngredient; index: number }) {
  const positions = [[105,154],[132,163],[160,155],[188,163],[214,151],[144,145],[181,144]];
  const [x,y] = positions[index % positions.length];
  if (ingredient === "spinach") return <path d={`M${x-11} ${y+5}q10-20 21 0q-11 13-21 0Z`} fill={GREEN} stroke={INK} strokeWidth="4" />;
  if (ingredient === "tomatoes") return <rect x={x-10} y={y-9} width="20" height="17" rx="5" fill={RED} stroke={INK} strokeWidth="4" />;
  if (ingredient === "onions") return <path d={`M${x-10} ${y+4}q10-15 20 0`} fill="none" stroke={PURPLE} strokeWidth="7" strokeLinecap="round" />;
  if (ingredient === "mushrooms") return <path d={`M${x-11} ${y}q2-13 11-13t11 13h-7v10h-8V${y}Z`} fill={MUSHROOM} stroke={INK} strokeWidth="4" />;
  if (ingredient === "green-pepper") return <rect x={x-10} y={y-8} width="21" height="15" rx="4" fill={GREEN_LIGHT} stroke={INK} strokeWidth="4" />;
  if (ingredient === "cheddar") return <path d={`M${x-13} ${y}h26`} stroke={CHEESE} strokeWidth="7" strokeLinecap="round" />;
  if (ingredient === "turkey-sausage") return <rect x={x-10} y={y-9} width="20" height="18" rx="5" fill={SAUSAGE} stroke={INK} strokeWidth="4" />;
  return <ellipse cx={x} cy={y} rx="11" ry="7" fill={BEAN} stroke={INK} strokeWidth="3" />;
}

function Omelet({ name }: { name: string }) {
  const ingredients = omeletIngredientsForName(name);
  const eggFill = omeletUsesEggWhites(name) ? EGG_WHITE : EGG;
  return (
    <g>
      <Plate />
      <g>
        <path d="M68 151c18-55 57-79 95-79 48 0 88 25 101 78-23 22-59 35-101 35-42 0-74-11-95-34Z" fill={eggFill} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        <path d="M77 153c31 22 139 26 177-1" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M109 108c31 13 72 14 103 1" fill="none" stroke={omeletUsesEggWhites(name) ? "#e7c95e" : "#dd9911"} strokeWidth="5" strokeLinecap="round" />
        {ingredients.slice(0, 7).map((ingredient, index) => <OmeletFilling key={`${ingredient}-${index}`} ingredient={ingredient} index={index} />)}
      </g>
    </g>
  );
}

export default function FoodIllustration({ name }: { name: string }) {
  const kind = foodIllustrationKind(name);
  if (!kind) return null;
  return (
    <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
      {kind === "omelet" && <Omelet name={name} />}
      {kind === "eggs" && <><Plate /><Scrambled /></>}
      {kind === "egg-whites" && <><Plate /><Scrambled pale /></>}
      {kind === "spinach" && <Spinach />}
      {kind === "tomatoes" && <Tomatoes />}
      {kind === "onions" && <Onions />}
      {kind === "mushrooms" && <Mushrooms />}
      {kind === "green-pepper" && <GreenPepper />}
      {kind === "cheddar" && <Cheddar />}
      {kind === "turkey-sausage" && <TurkeySausage />}
      {kind === "black-beans" && <BlackBeans />}
    </svg>
  );
}
