import "./food-illustration.css";
import {
  breakfastBowlComposition,
  breakfastPlateComposition,
  foodIllustrationKind,
  omeletIngredientsForName,
  omeletUsesEggWhites,
  type BreakfastBowlBase,
  type BreakfastBowlTopping,
  type BreakfastFruitSide,
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
const OAT = "#d9b46e";
const OAT_LIGHT = "#efcf91";
const BACON = "#c7543c";
const HAM = "#e99898";
const FETA = "#fff8df";
const JALAPENO = "#3e9d35";
const CANTALOUPE = "#f5a458";
const HONEYDEW = "#b7d97e";
const HONEY = "#e7a317";
const STRAWBERRY_YOGURT = "#f3a3b9";
const VANILLA_YOGURT = "#fff6dc";
const COTTAGE = "#fffdf4";
const RASPBERRY_SMOOTHIE = "#e8788f";
const AVOCADO_SMOOTHIE = "#79b85a";
const PUMPKIN = "#d77a2e";
const POTATO = "#d7a457";
const LENTIL = "#8f653b";

function Plate() {
  return (
    <g>
      <ellipse cx="160" cy="163" rx="126" ry="57" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="163" rx="105" ry="43" fill="none" stroke={INK} strokeWidth="4" />
    </g>
  );
}

function Bowl() {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <ellipse cx="160" cy="122" rx="92" ry="43" fill={PLATE} strokeWidth="7" />
      <path d="M69 122c6 61 43 87 91 87s85-26 91-87c-22 22-55 34-91 34s-69-12-91-34Z" fill={PLATE} strokeWidth="7" />
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
  return <g stroke={INK} strokeWidth="5">{blocks.map(([x,y,w,h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="7" fill={i%2 ? GREEN : GREEN_LIGHT} />)}</g>;
}

function Cheddar() {
  const strips = [[91,126,62,-10],[121,112,76,12],[144,142,74,-5],[104,157,72,7],[169,162,55,-12],[194,129,48,9]] as const;
  return <g>{strips.map(([x,y,len,r], i) => <line key={i} x1={x} y1={y} x2={x+len} y2={y} transform={`rotate(${r} ${x} ${y})`} stroke={CHEESE} strokeWidth="12" strokeLinecap="round" />)}</g>;
}

function DicedProtein({ fill, inner }: { fill: string; inner?: string }) {
  const blocks = [[98,128],[132,110],[167,130],[202,113],[118,158],[156,159],[194,156]];
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      {blocks.map(([x,y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="32" height="29" rx="8" fill={fill} />
          {inner && <path d={`M${x+5} ${y+5}h22v8H${x+5}Z`} fill={inner} stroke="none" />}
        </g>
      ))}
    </g>
  );
}

function TurkeySausage() { return <DicedProtein fill={SAUSAGE} inner={SAUSAGE_CUT} />; }
function Bacon() { return <DicedProtein fill={BACON} inner="#f0aa83" />; }
function Ham() { return <DicedProtein fill={HAM} inner="#ffd1c6" />; }

function BlackBeans() {
  const beans = [[103,131,-12],[134,112,10],[167,132,-8],[201,115,13],[119,161,8],[154,160,-11],[193,156,7]] as const;
  return <g fill={BEAN} stroke={INK} strokeWidth="4">{beans.map(([x,y,r], i) => <ellipse key={i} cx={x} cy={y} rx="18" ry="12" transform={`rotate(${r} ${x} ${y})`} />)}</g>;
}

function Feta() {
  const pieces = [[102,138,16],[126,117,13],[151,142,17],[179,119,14],[202,145,16],[126,163,12],[170,165,14],[212,169,11]] as const;
  return <g fill={FETA} stroke={INK} strokeWidth="4">{pieces.map(([x,y,r],i)=><path key={i} d={`M${x-r} ${y}l${r/2} -${r}h${r}l${r/2} ${r}l-${r/2} ${r}h-${r}Z`} />)}</g>;
}

function Broccoli() {
  const florets = [[108,145],[150,118],[191,144],[141,165],[199,169]];
  return (
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      {florets.map(([x,y],i)=><g key={i}><rect x={x-8} y={y} width="16" height="28" rx="6" fill={GREEN_LIGHT}/><circle cx={x-12} cy={y} r="15" fill={GREEN}/><circle cx={x+2} cy={y-7} r="17" fill={GREEN}/><circle cx={x+15} cy={y+1} r="14" fill={GREEN}/></g>)}
    </g>
  );
}

function Jalapeno() {
  const rings = [[111,143,-10],[158,122,4],[204,146,11],[146,165,-5],[190,171,8]] as const;
  return (
    <g stroke={INK} strokeWidth="5">
      {rings.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><ellipse cx={x} cy={y} rx="25" ry="17" fill={JALAPENO}/><ellipse cx={x} cy={y} rx="12" ry="8" fill={PLATE}/><circle cx={x-5} cy={y-2} r="2.5" fill="#f7dc73" stroke="none"/><circle cx={x+6} cy={y+3} r="2.5" fill="#f7dc73" stroke="none"/></g>)}
    </g>
  );
}

function OatmealFill() {
  const oats = [[101,115,13,-8],[126,105,15,8],[153,117,13,-4],[180,105,15,9],[207,117,13,-8],[118,132,13,6],[146,137,14,-7],[176,133,13,5],[202,137,14,-6]] as const;
  return (
    <g>
      <ellipse cx="160" cy="122" rx="78" ry="31" fill={OAT_LIGHT} stroke={INK} strokeWidth="5" />
      <g fill={OAT} stroke={INK} strokeWidth="3">{oats.map(([x,y,rx,r], index) => <ellipse key={index} cx={x} cy={y} rx={rx} ry="6" transform={`rotate(${r} ${x} ${y})`} />)}</g>
    </g>
  );
}

function Oatmeal() { return <g><Bowl/><OatmealFill/></g>; }

function Soup({ broccoli = false }: { broccoli?: boolean }) {
  return (
    <g>
      <Bowl/>
      <ellipse cx="160" cy="122" rx="78" ry="31" fill="#f5c34f" stroke={INK} strokeWidth="5" />
      {broccoli && <g transform="translate(0 -18) scale(.55)"><Broccoli/></g>}
      <g stroke={CHEESE} strokeWidth="7" strokeLinecap="round"><path d="M115 126h28M168 112h26M181 137h24"/></g>
    </g>
  );
}

function YogurtFill({ base }: { base: BreakfastBowlBase }) {
  const fill = base === "strawberry-yogurt" ? STRAWBERRY_YOGURT : base === "vanilla-greek-yogurt" ? VANILLA_YOGURT : OAT_LIGHT;
  return <ellipse cx="160" cy="122" rx="78" ry="31" fill={fill} stroke={INK} strokeWidth="5" />;
}

function GranolaTopping() {
  const clusters = [[121,113,10],[143,126,8],[164,110,11],[187,126,9],[204,113,8],[153,136,7],[177,139,8]];
  return <g fill="#b97b2e" stroke={INK} strokeWidth="3">{clusters.map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r}/>)}</g>;
}

function HoneyDrizzle() {
  return <path d="M105 111c24 18 46-13 67 2s40 7 48-3M123 135c18 10 37-7 55 1" fill="none" stroke={HONEY} strokeWidth="7" strokeLinecap="round" />;
}

function BreakfastBowlArt({ name }: { name: string }) {
  const composition = breakfastBowlComposition(name);
  if (!composition) return null;
  return (
    <g>
      <Bowl/>
      {composition.base === "oatmeal" ? <OatmealFill/> : <YogurtFill base={composition.base}/>} 
      {composition.toppings.includes("granola") && <GranolaTopping/>}
      {composition.toppings.includes("honey") && <HoneyDrizzle/>}
    </g>
  );
}

function Yogurt({ strawberry = false }: { strawberry?: boolean }) {
  const base: BreakfastBowlBase = strawberry ? "strawberry-yogurt" : "vanilla-greek-yogurt";
  return <g><Bowl/><YogurtFill base={base}/></g>;
}

function CottageCheese() {
  const curds = [[118,116,12],[143,107,13],[168,119,14],[193,109,12],[132,135,14],[160,138,13],[188,136,14],[210,127,10]];
  return <g><Bowl/><ellipse cx="160" cy="122" rx="78" ry="31" fill={COTTAGE} stroke={INK} strokeWidth="5"/><g fill="#fff" stroke={INK} strokeWidth="3">{curds.map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r}/>)}</g></g>;
}

function FruitCubes({ fill }: { fill: string }) {
  const cubes = [[101,130],[133,111],[167,132],[202,113],[119,159],[157,160],[195,156]];
  return <g fill={fill} stroke={INK} strokeWidth="5">{cubes.map(([x,y],i)=><rect key={i} x={x} y={y} width="32" height="28" rx="7"/>)}</g>;
}

function Granola() {
  return <g><Bowl/><ellipse cx="160" cy="122" rx="78" ry="31" fill="#f4dfb3" stroke={INK} strokeWidth="5"/><GranolaTopping/></g>;
}

function Honey() {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <path d="M105 108h110l-12 78c-3 17-18 26-43 26s-40-9-43-26Z" fill="#fff7dc" strokeWidth="7"/>
      <ellipse cx="160" cy="109" rx="55" ry="23" fill={HONEY} strokeWidth="6"/>
      <path d="M190 75l36 14M216 83l-19 56" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round"/>
    </g>
  );
}

function DateCaramelOvernightOats() {
  const dateBits = [[122,115],[151,128],[182,112],[201,135],[139,139],[173,140]];
  return <g><Bowl/><ellipse cx="160" cy="122" rx="78" ry="31" fill="#d7b17b" stroke={INK} strokeWidth="5"/><path d="M107 117c22 14 39-10 57 2s36 7 53-4" fill="none" stroke="#8a5a32" strokeWidth="7" strokeLinecap="round"/><g fill="#7a4d2e" stroke={INK} strokeWidth="3">{dateBits.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6"/>)}</g></g>;
}

function Grapefruit() {
  const wedges = [0,45,90,135,180,225,270,315];
  return (
    <g transform="translate(160 137)">
      <circle r="68" fill="#f6d06f" stroke={INK} strokeWidth="7"/>
      <circle r="54" fill="#f27e78" stroke={INK} strokeWidth="4"/>
      {wedges.map((a,i)=><line key={i} x1="0" y1="0" x2="0" y2="-52" transform={`rotate(${a})`} stroke="#ffd8c8" strokeWidth="4"/>)}
      <circle r="8" fill="#fff3d5" stroke={INK} strokeWidth="3"/>
    </g>
  );
}

function Smoothie({ green = false }: { green?: boolean }) {
  const fill = green ? AVOCADO_SMOOTHIE : RASPBERRY_SMOOTHIE;
  return (
    <g stroke={INK} strokeLinejoin="round">
      <path d="M105 71h110l-12 125c-2 18-20 28-43 28s-41-10-43-28Z" fill="#fffdf8" strokeWidth="7"/>
      <path d="M114 89h92l-10 99c-2 12-15 19-36 19s-34-7-36-19Z" fill={fill} stroke="none"/>
      <path d="M182 39l14 58" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round"/>
    </g>
  );
}

function PumpkinBakedOatmeal() {
  return (
    <g>
      <Plate/>
      <path d="M96 116h132v72H96Z" fill={PUMPKIN} stroke={INK} strokeWidth="7" strokeLinejoin="round"/>
      <path d="M105 126h114v18H105Z" fill="#f0b36d" stroke="none"/>
      <g fill={OAT_LIGHT} stroke={INK} strokeWidth="3"><ellipse cx="126" cy="157" rx="14" ry="6"/><ellipse cx="160" cy="167" rx="14" ry="6"/><ellipse cx="195" cy="154" rx="14" ry="6"/></g>
    </g>
  );
}

function LentilKalePotatoHash() {
  const potatoes = [[108,132],[151,118],[194,137],[130,164],[176,165]];
  const lentils = [[121,145],[142,144],[164,137],[185,151],[203,155],[151,174]];
  return (
    <g>
      <Bowl/>
      <ellipse cx="160" cy="122" rx="78" ry="31" fill="#ece1b6" stroke={INK} strokeWidth="5"/>
      <g fill={POTATO} stroke={INK} strokeWidth="4">{potatoes.map(([x,y],i)=><rect key={i} x={x-13} y={y-11} width="27" height="22" rx="6"/>)}</g>
      <g fill={GREEN} stroke={INK} strokeWidth="3"><path d="M111 121q12-21 24 0q-12 12-24 0Z"/><path d="M173 112q13-20 25 1q-13 12-25-1Z"/><path d="M190 134q11-18 22 0q-11 11-22 0Z"/></g>
      <g fill={LENTIL} stroke={INK} strokeWidth="2">{lentils.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5"/>)}</g>
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
  if (ingredient === "black-beans") return <ellipse cx={x} cy={y} rx="11" ry="7" fill={BEAN} stroke={INK} strokeWidth="3" />;
  if (ingredient === "bacon") return <rect x={x-10} y={y-9} width="20" height="18" rx="5" fill={BACON} stroke={INK} strokeWidth="4" />;
  if (ingredient === "ham") return <rect x={x-10} y={y-9} width="20" height="18" rx="5" fill={HAM} stroke={INK} strokeWidth="4" />;
  if (ingredient === "feta") return <circle cx={x} cy={y} r="9" fill={FETA} stroke={INK} strokeWidth="4" />;
  if (ingredient === "broccoli") return <circle cx={x} cy={y} r="10" fill={GREEN} stroke={INK} strokeWidth="4" />;
  return <ellipse cx={x} cy={y} rx="11" ry="7" fill={JALAPENO} stroke={INK} strokeWidth="3" />;
}

function OmeletBody({ name, eggWhiteOverride }: { name: string; eggWhiteOverride?: boolean }) {
  const ingredients = omeletIngredientsForName(name);
  const eggFill = eggWhiteOverride ?? omeletUsesEggWhites(name) ? EGG_WHITE : EGG;
  return (
    <g>
      <path d="M68 151c18-55 57-79 95-79 48 0 88 25 101 78-23 22-59 35-101 35-42 0-74-11-95-34Z" fill={eggFill} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M77 153c31 22 139 26 177-1" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      {ingredients.slice(0, 7).map((ingredient, index) => <OmeletFilling key={`${ingredient}-${index}`} ingredient={ingredient} index={index} />)}
    </g>
  );
}

function Omelet({ name }: { name: string }) { return <g><Plate/><OmeletBody name={name}/></g>; }

function FruitSide({ kind }: { kind: BreakfastFruitSide }) {
  if (kind === "grapefruit") return <g transform="translate(188 122) scale(.42)"><Grapefruit/></g>;
  return <g transform="translate(112 94) scale(.42)"><FruitCubes fill={kind === "cantaloupe" ? CANTALOUPE : HONEYDEW}/></g>;
}

function BreakfastPlate({ name }: { name: string }) {
  const composition = breakfastPlateComposition(name);
  if (!composition) return null;
  const hasOmeletFillings = composition.omeletIngredients.length > 0;
  return (
    <g>
      <Plate/>
      <g transform="translate(-36 28) scale(.72)">
        {hasOmeletFillings ? <OmeletBody name={name} eggWhiteOverride={composition.eggBase === "egg-whites"}/> : <Scrambled pale={composition.eggBase === "egg-whites"}/>} 
      </g>
      {composition.bowl && (
        <g transform="translate(142 38) scale(.5)">
          <Bowl/>
          {composition.bowl.base === "oatmeal" ? <OatmealFill/> : <YogurtFill base={composition.bowl.base}/>} 
          {composition.bowl.toppings.includes("granola") && <GranolaTopping/>}
          {composition.bowl.toppings.includes("honey") && <HoneyDrizzle/>}
        </g>
      )}
      {composition.fruitSides.slice(0,2).map((kind,index)=><g key={kind} transform={`translate(${index*32} ${index*8})`}><FruitSide kind={kind}/></g>)}
    </g>
  );
}

export default function FoodIllustration({ name }: { name: string }) {
  const kind = foodIllustrationKind(name);
  if (!kind) return null;
  return (
    <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
      {kind === "breakfast-plate" && <BreakfastPlate name={name}/>} 
      {kind === "omelet" && <Omelet name={name} />}
      {kind === "breakfast-bowl" && <BreakfastBowlArt name={name}/>} 
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
      {kind === "bacon" && <Bacon/>}
      {kind === "ham" && <Ham/>}
      {kind === "feta" && <Feta/>}
      {kind === "broccoli" && <Broccoli/>}
      {kind === "jalapeno" && <Jalapeno/>}
      {kind === "oatmeal" && <Oatmeal />}
      {kind === "broccoli-cheddar-soup" && <Soup broccoli/>}
      {kind === "strawberry-yogurt" && <Yogurt strawberry/>}
      {kind === "vanilla-greek-yogurt" && <Yogurt/>}
      {kind === "cottage-cheese" && <CottageCheese/>}
      {kind === "cantaloupe" && <FruitCubes fill={CANTALOUPE}/>} 
      {kind === "honeydew" && <FruitCubes fill={HONEYDEW}/>} 
      {kind === "granola" && <Granola/>}
      {kind === "honey" && <Honey/>}
      {kind === "date-caramel-overnight-oats" && <DateCaramelOvernightOats/>}
      {kind === "grapefruit" && <Grapefruit/>}
      {kind === "raspberry-peach-smoothie" && <Smoothie/>}
      {kind === "avocado-spinach-smoothie" && <Smoothie green/>}
      {kind === "pumpkin-spice-baked-oatmeal" && <PumpkinBakedOatmeal/>}
      {kind === "lentil-kale-potato-hash" && <LentilKalePotatoHash/>}
    </svg>
  );
}
