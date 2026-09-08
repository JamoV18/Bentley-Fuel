import LegacyFoodIllustration from "@/components/FoodIllustration";
import {
  breakfastPlateComposition,
  foodIllustrationKind,
  type BreakfastPlateSide,
  type BreakfastFruitSide,
} from "@/lib/foodIllustrations";

const INK = "#10263d";
const PLATE = "#fffdf8";
const EGG = "#f7c934";
const EGG_WHITE = "#fff2b8";
const GREEN = "#45a735";
const GREEN_LIGHT = "#75c94a";
const ORANGE = "#e68a2e";
const BROWN = "#8c5d35";
const PUMPKIN = "#d77a2e";
const OAT = "#d9b46e";
const OAT_LIGHT = "#efcf91";
const CHOCOLATE = "#5b3928";
const SAUSAGE = "#a95f36";
const SWEET_POTATO = "#df7a32";
const PATTY = "#765436";
const ICING = "#fff7e8";
const SPRINKLES = ["#ef4a3c", "#42b7b0", "#f7c934", "#7b65c8"];
const APPLE = "#d6a04c";
const YOGURT = "#fff6dc";
const STRAWBERRY_YOGURT = "#f3a3b9";
const HONEY = "#e7a317";

function Plate() {
  return (
    <g>
      <ellipse cx="160" cy="163" rx="126" ry="57" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="163" rx="105" ry="43" fill="none" stroke={INK} strokeWidth="4" />
    </g>
  );
}

function Bowl({ x = 160, y = 124, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK} strokeLinejoin="round">
      <ellipse cx="0" cy="0" rx="72" ry="31" fill={PLATE} strokeWidth="6" />
      <path d="M-72 0c6 48 34 69 72 69S66 48 72 0C53 17 28 26 0 26S-53 17-72 0Z" fill={PLATE} strokeWidth="6" />
    </g>
  );
}

function Scrambled({ pale = false, transform = "" }: { pale?: boolean; transform?: string }) {
  return (
    <g transform={transform} stroke={INK} strokeWidth="6" strokeLinejoin="round">
      <path d="M73 147c-12-17 4-34 23-29 5-20 31-24 42-7 13-17 41-10 43 10 19-13 43 3 37 24 19 9 12 35-10 34-6 17-33 22-46 6-11 15-36 12-44-3-17 9-38-7-31-25-11 2-20-2-24-10-4-8-1-18 8-25Z" fill={pale ? EGG_WHITE : EGG} />
      <path d="M95 144c11 7 19 10 31 10M138 127c8 6 15 9 26 9M160 162c10 7 18 9 30 8" fill="none" stroke={pale ? "#e7c95e" : "#dd9911"} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function SteamedBroccoli() {
  const florets = [[112,137],[157,116],[202,139],[139,166],[191,168]];
  return (
    <g>
      <Plate />
      <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
        {florets.map(([x,y],i)=><g key={i}><rect x={x-7} y={y} width="14" height="27" rx="5" fill={GREEN_LIGHT}/><circle cx={x-11} cy={y} r="14" fill={GREEN}/><circle cx={x+2} cy={y-7} r="16" fill={GREEN}/><circle cx={x+14} cy={y+1} r="13" fill={GREEN}/></g>)}
      </g>
    </g>
  );
}

function Pancakes({ mini = false }: { mini?: boolean }) {
  const group = (
    <g stroke={INK} strokeWidth="5">
      <ellipse cx="160" cy="158" rx="70" ry="27" fill="#d99443" />
      <ellipse cx="160" cy="142" rx="70" ry="27" fill="#e8ac59" />
      <g fill={CHOCOLATE} stroke="none"><circle cx="128" cy="136" r="6"/><circle cx="165" cy="147" r="6"/><circle cx="192" cy="133" r="6"/><circle cx="145" cy="127" r="5"/><circle cx="208" cy="149" r="5"/></g>
      <path d="M118 132c20-12 62-15 86 1" fill="none" stroke={PUMPKIN} strokeWidth="6" strokeLinecap="round"/>
    </g>
  );
  return mini ? group : <g><Plate/>{group}</g>;
}

function SausageLinks({ mini = false }: { mini?: boolean }) {
  const body = (
    <g stroke={INK} strokeWidth="5" fill={SAUSAGE}>
      <rect x="105" y="126" width="34" height="78" rx="17" transform="rotate(-18 122 165)"/>
      <rect x="147" y="116" width="34" height="82" rx="17" transform="rotate(5 164 157)"/>
      <rect x="190" y="128" width="34" height="76" rx="17" transform="rotate(19 207 166)"/>
    </g>
  );
  return mini ? body : <g><Plate/>{body}</g>;
}

function SweetPotatoTots({ mini = false }: { mini?: boolean }) {
  const tots = [[113,139,-10],[151,126,7],[192,141,11],[132,166,8],[173,167,-8],[211,162,5]] as const;
  const body = <g fill={SWEET_POTATO} stroke={INK} strokeWidth="5">{tots.map(([x,y,r],i)=><rect key={i} x={x-14} y={y-9} width="28" height="18" rx="8" transform={`rotate(${r} ${x} ${y})`}/>)}</g>;
  return mini ? body : <g><Plate/>{body}</g>;
}

function VegetarianSausagePatty({ mini = false }: { mini?: boolean }) {
  const body = <g><ellipse cx="160" cy="151" rx="66" ry="45" fill={PATTY} stroke={INK} strokeWidth="7"/><path d="M128 140c16-11 46-12 64-2M134 163c18 9 38 9 55 0" fill="none" stroke="#9d754e" strokeWidth="5" strokeLinecap="round"/></g>;
  return mini ? body : <g><Plate/>{body}</g>;
}

function StickyBun() {
  return (
    <g>
      <Plate/>
      <path d="M99 156c0-43 27-67 63-67s64 25 64 67c0 31-27 49-64 49s-63-18-63-49Z" fill="#c8793c" stroke={INK} strokeWidth="7"/>
      <path d="M128 153c0-23 15-37 35-37 18 0 31 12 31 28 0 15-12 25-26 25-11 0-19-7-19-16 0-8 7-14 15-14 6 0 10 4 10 9" fill="none" stroke="#6c432b" strokeWidth="8" strokeLinecap="round"/>
      <path d="M109 113c23 9 74 5 105-4" fill="none" stroke={HONEY} strokeWidth="8" strokeLinecap="round"/>
    </g>
  );
}

function BirthdayDoughnut() {
  return (
    <g>
      <ellipse cx="160" cy="150" rx="82" ry="60" fill="#d79a58" stroke={INK} strokeWidth="7"/>
      <ellipse cx="160" cy="150" rx="31" ry="24" fill={PLATE} stroke={INK} strokeWidth="6"/>
      <path d="M87 135c20-37 126-46 148 0-20 22-42 26-63 18-28 13-58 4-85-18Z" fill={ICING} stroke={INK} strokeWidth="5"/>
      {[[115,125],[140,112],[173,119],[201,128],[130,143],[184,142],[215,146]].map(([x,y],i)=><rect key={i} x={x-3} y={y-9} width="6" height="18" rx="3" fill={SPRINKLES[i%SPRINKLES.length]} transform={`rotate(${i%2?25:-25} ${x} ${y})`}/>) }
    </g>
  );
}

function AppleDanish() {
  return (
    <g>
      <Plate/>
      <path d="M95 154c0-39 31-63 66-63 39 0 67 25 67 63 0 32-28 48-67 48-38 0-66-16-66-48Z" fill="#d7a15f" stroke={INK} strokeWidth="7"/>
      <path d="M126 132c16-19 54-20 70 0l-9 35h-52Z" fill={APPLE} stroke={INK} strokeWidth="5"/>
      <path d="M115 113l17 17M207 114l-17 16M107 155h20M213 155h-20" stroke="#f4d49c" strokeWidth="7" strokeLinecap="round"/>
    </g>
  );
}

function MiniBroccoli() {
  return <g stroke={INK} strokeWidth="4"><rect x="150" y="146" width="16" height="27" rx="5" fill={GREEN_LIGHT}/><circle cx="146" cy="143" r="13" fill={GREEN}/><circle cx="160" cy="136" r="15" fill={GREEN}/><circle cx="174" cy="143" r="13" fill={GREEN}/></g>;
}

function MiniPumpkinBakedOatmeal() {
  return <g><rect x="123" y="126" width="72" height="54" rx="5" fill={PUMPKIN} stroke={INK} strokeWidth="5"/><g fill={OAT_LIGHT}><ellipse cx="143" cy="145" rx="10" ry="4"/><ellipse cx="169" cy="158" rx="10" ry="4"/></g></g>;
}

function MiniLentilHash() {
  return <g><g fill="#d7a457" stroke={INK} strokeWidth="3"><rect x="120" y="135" width="26" height="20" rx="5"/><rect x="153" y="127" width="27" height="22" rx="5"/><rect x="184" y="143" width="26" height="20" rx="5"/></g><path d="M128 169q12-20 24 0q-12 11-24 0ZM173 168q12-20 24 0q-12 11-24 0Z" fill={GREEN} stroke={INK} strokeWidth="3"/></g>;
}

function PlateSide({ side, index }: { side: BreakfastPlateSide; index: number }) {
  const positions = [
    { x: -68, y: 55, s: .48 },
    { x: 12, y: 64, s: .44 },
    { x: 84, y: 58, s: .4 },
    { x: 48, y: 91, s: .36 },
  ];
  const p = positions[index % positions.length];
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
      {side === "pumpkin-pancakes" && <Pancakes mini/>}
      {side === "pork-sausage" && <SausageLinks mini/>}
      {side === "sweet-potato-tots" && <SweetPotatoTots mini/>}
      {side === "vegetarian-sausage" && <VegetarianSausagePatty mini/>}
      {side === "pumpkin-baked-oatmeal" && <MiniPumpkinBakedOatmeal/>}
      {side === "lentil-hash" && <MiniLentilHash/>}
      {side === "steamed-broccoli" && <MiniBroccoli/>}
    </g>
  );
}

function FruitSide({ kind, index }: { kind: BreakfastFruitSide; index: number }) {
  const x = 226 + index * 24;
  if (kind === "grapefruit") {
    return <g transform={`translate(${x} 174) scale(.38)`}><circle r="54" fill="#f27e78" stroke={INK} strokeWidth="7"/><circle r="9" fill="#fff3d5" stroke={INK} strokeWidth="4"/></g>;
  }
  const fill = kind === "cantaloupe" ? "#f5a458" : "#b7d97e";
  return <g transform={`translate(${x-24} 146) scale(.55)`} fill={fill} stroke={INK} strokeWidth="5"><rect x="0" y="0" width="32" height="28" rx="7"/><rect x="29" y="16" width="32" height="28" rx="7"/><rect x="6" y="38" width="32" height="28" rx="7"/></g>;
}

function BowlSide({ name }: { name: string }) {
  const composition = breakfastPlateComposition(name)?.bowl;
  if (!composition) return null;
  const fill = composition.base === "strawberry-yogurt" ? STRAWBERRY_YOGURT : composition.base === "vanilla-greek-yogurt" ? YOGURT : OAT_LIGHT;
  return (
    <g>
      <Bowl x={241} y={115} scale={.52}/>
      <ellipse cx="241" cy="115" rx="36" ry="16" fill={fill} stroke={INK} strokeWidth="4"/>
      {composition.base === "oatmeal" && <g fill={OAT} stroke={INK} strokeWidth="2"><ellipse cx="229" cy="111" rx="8" ry="3"/><ellipse cx="244" cy="119" rx="8" ry="3"/><ellipse cx="254" cy="107" rx="8" ry="3"/></g>}
      {composition.toppings.includes("granola") && <g fill="#b97b2e" stroke={INK} strokeWidth="2"><circle cx="229" cy="110" r="5"/><circle cx="242" cy="119" r="5"/><circle cx="253" cy="109" r="5"/></g>}
      {composition.toppings.includes("honey") && <path d="M218 113c11 8 21-5 31 2s17 1 22-3" fill="none" stroke={HONEY} strokeWidth="4" strokeLinecap="round"/>}
    </g>
  );
}

function OmeletOrEggs({ name }: { name: string }) {
  const composition = breakfastPlateComposition(name);
  if (!composition?.eggBase) return null;
  if (composition.omeletIngredients.length === 0) return <Scrambled pale={composition.eggBase === "egg-whites"} transform="translate(-40 34) scale(.7)"/>;

  const fill = composition.eggBase === "egg-whites" ? EGG_WHITE : EGG;
  return (
    <g transform="translate(-26 37) scale(.72)">
      <path d="M68 151c18-55 57-79 95-79 48 0 88 25 101 78-23 22-59 35-101 35-42 0-74-11-95-34Z" fill={fill} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M77 153c31 22 139 26 177-1" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      {composition.omeletIngredients.slice(0,6).map((ingredient,index)=>{
        const xs = [107,137,166,194,222,151];
        const ys = [151,164,148,162,149,135];
        const x = xs[index];
        const y = ys[index];
        const color = ingredient === "spinach" || ingredient === "broccoli" || ingredient === "green-pepper" || ingredient === "jalapeno" ? GREEN : ingredient === "tomatoes" ? "#ef4a3c" : ingredient === "cheddar" ? "#f3a90b" : ingredient === "bacon" ? "#c7543c" : ingredient === "ham" ? "#e99898" : ingredient === "feta" ? "#fff8df" : ingredient === "black-beans" ? "#25213b" : "#b86b35";
        return <circle key={`${ingredient}-${index}`} cx={x} cy={y} r="10" fill={color} stroke={INK} strokeWidth="3"/>;
      })}
    </g>
  );
}

function BreakfastPlateV2({ name }: { name: string }) {
  const composition = breakfastPlateComposition(name);
  if (!composition) return null;
  return (
    <g>
      <Plate/>
      <OmeletOrEggs name={name}/>
      {composition.plateSides.slice(0,4).map((side,index)=><PlateSide key={`${side}-${index}`} side={side} index={index}/>)}
      {composition.bowl && <BowlSide name={name}/>} 
      {composition.fruitSides.slice(0,2).map((kind,index)=><FruitSide key={`${kind}-${index}`} kind={kind} index={index}/>)}
    </g>
  );
}

export default function FoodIllustrationV2({ name }: { name: string }) {
  const kind = foodIllustrationKind(name);
  if (!kind) return null;

  if (kind === "breakfast-plate") {
    return <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false"><BreakfastPlateV2 name={name}/></svg>;
  }

  const extra = (
    <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
      {kind === "steamed-broccoli" && <SteamedBroccoli/>}
      {kind === "scrambled-eggs" && <><Plate/><Scrambled/></>}
      {kind === "pumpkin-chocolate-chip-pancakes" && <Pancakes/>}
      {kind === "pork-sausage-link" && <SausageLinks/>}
      {kind === "sweet-potato-tots" && <SweetPotatoTots/>}
      {kind === "vegetarian-sausage-patty" && <VegetarianSausagePatty/>}
      {kind === "five-spice-sticky-bun" && <StickyBun/>}
      {kind === "birthday-cake-doughnut" && <BirthdayDoughnut/>}
      {kind === "apple-danish" && <AppleDanish/>}
    </svg>
  );

  if ([
    "steamed-broccoli",
    "scrambled-eggs",
    "pumpkin-chocolate-chip-pancakes",
    "pork-sausage-link",
    "sweet-potato-tots",
    "vegetarian-sausage-patty",
    "five-spice-sticky-bun",
    "birthday-cake-doughnut",
    "apple-danish",
  ].includes(kind)) return extra;

  return <LegacyFoodIllustration name={name}/>;
}
