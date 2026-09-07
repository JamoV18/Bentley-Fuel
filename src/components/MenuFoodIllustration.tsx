import { menuVisualForName, type MenuVisualSpec } from "@/lib/menuIllustrationCatalog";

const INK = "#10263d";
const PLATE = "#fffdf8";
const RED = "#ef4a3c";
const TOMATO = "#d94636";
const GREEN = "#2f9d3a";
const DARK_GREEN = "#1f6f31";
const LIGHT_GREEN = "#79c34e";
const GOLD = "#f6c842";
const ORANGE = "#eb8b35";
const CREAM = "#fff3d6";
const BROWN = "#8d5a37";
const DARK_BROWN = "#5b3928";
const PURPLE = "#8a4c8f";
const PINK = "#ef9fba";

type Point = readonly [number, number];
type RotPoint = readonly [number, number, number];
type ColorPoint = readonly [number, number, string];

function Plate() {
  return (
    <g>
      <ellipse cx="160" cy="158" rx="126" ry="57" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="158" rx="105" ry="43" fill="none" stroke="#dfe8ed" strokeWidth="3" />
    </g>
  );
}

function Bowl() {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <ellipse cx="160" cy="126" rx="82" ry="35" fill={PLATE} strokeWidth="7" />
      <path d="M78 126c7 58 39 82 82 82s75-24 82-82c-22 21-51 31-82 31s-60-10-82-31Z" fill={PLATE} strokeWidth="7" />
    </g>
  );
}

function Ramekin({ fill }: { fill: string }) {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <ellipse cx="160" cy="128" rx="67" ry="30" fill={PLATE} strokeWidth="6" />
      <path d="M98 128c5 47 27 67 62 67s57-20 62-67c-17 16-39 23-62 23s-45-7-62-23Z" fill={PLATE} strokeWidth="6" />
      <ellipse cx="160" cy="128" rx="54" ry="22" fill={fill} stroke={INK} strokeWidth="4" />
    </g>
  );
}

function Leaf({ x, y, r = 0, fill = GREEN }: { x: number; y: number; r?: number; fill?: string }) {
  return (
    <path
      d={`M${x - 16} ${y + 8}c1-20 19-31 34-19 13 11 4 31-12 34-14 3-24-7-22-17Z`}
      transform={`rotate(${r} ${x} ${y})`}
      fill={fill}
      stroke={INK}
      strokeWidth="3"
    />
  );
}

function Pizza({ variant }: { variant?: string }) {
  return (
    <g>
      <Plate />
      <path d="M84 176L160 91l77 85c-52 24-102 23-153 0Z" fill="#f1bd55" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M105 157c30-18 84-18 110 0" fill="none" stroke={TOMATO} strokeWidth="15" strokeLinecap="round" />
      <path d="M113 148c26-13 70-13 96 0" fill="none" stroke="#f5df7c" strokeWidth="13" strokeLinecap="round" />
      {variant === "pepperoni" && <g fill={RED} stroke={INK} strokeWidth="3"><circle cx="137" cy="137" r="11"/><circle cx="170" cy="128" r="11"/><circle cx="191" cy="151" r="11"/></g>}
      {variant === "sausage" && <g fill={BROWN} stroke={INK} strokeWidth="3"><circle cx="135" cy="138" r="8"/><circle cx="162" cy="126" r="8"/><circle cx="191" cy="146" r="8"/><circle cx="164" cy="153" r="7"/></g>}
    </g>
  );
}

function ProteinPlate({ variant }: { variant?: string }) {
  const isFish = /salmon|fish/.test(variant || "");
  const isSteak = /steak|beef/.test(variant || "");
  const fill = isFish ? "#ef9a69" : isSteak ? "#9a5a3a" : "#c97948";
  return (
    <g>
      <Plate />
      <rect x="92" y="122" width="112" height="58" rx="22" fill={fill} stroke={INK} strokeWidth="7" transform="rotate(-8 148 151)" />
      <g stroke="#6a412d" strokeWidth="4" strokeLinecap="round"><path d="M113 128l54 42"/><path d="M134 121l54 41"/><path d="M155 118l46 35"/></g>
      <Leaf x={221} y={145} r={10} />
      <Leaf x={222} y={164} r={-8} fill={LIGHT_GREEN} />
      {variant === "bbq-chicken" && <path d="M101 137c32 13 59 7 91 2" fill="none" stroke="#8c2f24" strokeWidth="9" strokeLinecap="round"/>}
    </g>
  );
}

function Tenders() {
  const pieces: readonly RotPoint[] = [[112,142,-12],[154,124,7],[194,145,13],[146,164,-7]];
  return <g><Plate/><g fill={ORANGE} stroke={INK} strokeWidth="5">{pieces.map(([x,y,r],i)=><rect key={i} x={x-24} y={y-10} width="48" height="21" rx="10" transform={`rotate(${r} ${x} ${y})`}/>)}</g><circle cx="222" cy="125" r="25" fill={PLATE} stroke={INK} strokeWidth="5"/><circle cx="222" cy="125" r="16" fill={CREAM}/></g>;
}

function Potatoes() {
  const pieces: readonly RotPoint[] = [[105,143,-8],[133,124,10],[161,145,-5],[192,126,11],[216,148,-9],[136,166,6],[178,164,-7]];
  return <g><Plate/><g fill="#d69d4c" stroke={INK} strokeWidth="4">{pieces.map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y+7}l8-24 25 5 8 23-18 14Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g><g fill={GREEN}><circle cx="127" cy="141" r="4"/><circle cx="175" cy="129" r="4"/><circle cx="198" cy="161" r="4"/></g></g>;
}

function RoastedVegetables({ variant }: { variant?: string }) {
  const veg: readonly ColorPoint[] = [[105,145,RED],[132,126,ORANGE],[161,146,LIGHT_GREEN],[190,127,GREEN],[217,146,GOLD],[135,165,PURPLE],[180,165,ORANGE]];
  return <g>{variant === "mushrooms" ? <Bowl/> : <Plate/>}<g stroke={INK} strokeWidth="4">{veg.map(([x,y,c],i)=><rect key={i} x={x-14} y={y-10} width="28" height="20" rx="7" fill={c} transform={`rotate(${(i%3-1)*8} ${x} ${y})`}/>)}</g>{variant === "mushrooms" && <g fill={BROWN} stroke={INK} strokeWidth="3"><ellipse cx="127" cy="133" rx="18" ry="12"/><ellipse cx="166" cy="123" rx="18" ry="12"/><ellipse cx="197" cy="145" rx="18" ry="12"/></g>}</g>;
}

function GreenBeans() {
  const beans: readonly RotPoint[] = [[105,132,18],[127,145,-12],[149,127,9],[171,146,-8],[192,126,12],[210,145,-14],[140,160,5],[184,161,-5]];
  return <g><Plate/><g stroke={INK} strokeWidth="5" strokeLinecap="round">{beans.map(([x,y,r],i)=><line key={i} x1={x-20} y1={y} x2={x+20} y2={y} transform={`rotate(${r} ${x} ${y})`} stroke={i%2?GREEN:LIGHT_GREEN}/>)}</g></g>;
}

function Pasta({ variant }: { variant?: string }) {
  const pieces: readonly RotPoint[] = [[101,142,-13],[129,124,8],[159,143,-7],[190,126,10],[217,145,-11],[132,164,7],[169,165,-5],[201,160,8]];
  return <g><Bowl/><ellipse cx="160" cy="127" rx="69" ry="27" fill="#f3c66f" stroke={INK} strokeWidth="4"/><g>{pieces.map(([x,y,r],i)=><rect key={i} x={x-17} y={y-6} width="34" height="12" rx="5" fill={GOLD} stroke={INK} strokeWidth="3" transform={`rotate(${r} ${x} ${y})`}/>)}</g><g fill={GREEN}><circle cx="126" cy="131" r="4"/><circle cx="174" cy="119" r="4"/><circle cx="200" cy="149" r="4"/></g>{variant === "dinner" && <path d="M112 136c22-18 71-18 97 0" fill="none" stroke={TOMATO} strokeWidth="7" strokeLinecap="round"/>}</g>;
}

function Sauce({ variant }: { variant?: string }) {
  return <Ramekin fill={variant === "alfredo" ? CREAM : TOMATO} />;
}

function Bread({ variant }: { variant?: string }) {
  if (variant === "garlic-knots") {
    const knots: readonly Point[] = [[112,141],[147,128],[182,142],[137,165],[178,165]];
    return <g><Plate/><g fill="#dda655" stroke={INK} strokeWidth="4">{knots.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="21"/>)}</g><g fill={GREEN}><circle cx="125" cy="137" r="4"/><circle cx="167" cy="151" r="4"/></g></g>;
  }
  if (variant === "hoagie") return <g><rect x="72" y="118" width="176" height="66" rx="33" fill="#e6a34d" stroke={INK} strokeWidth="7"/><path d="M98 137c36-17 88-17 124 0" fill="none" stroke="#f6d39c" strokeWidth="5" strokeLinecap="round"/></g>;
  if (variant === "pita" || variant === "tortilla") return <ellipse cx="160" cy="148" rx="98" ry="59" fill={variant === "pita" ? "#f0d6a6" : "#f3dfb0"} stroke={INK} strokeWidth="7"/>;
  if (variant === "potato-roll" || variant === "slider" || variant === "dinner") return <g><ellipse cx="160" cy="145" rx="75" ry="48" fill="#e6a34d" stroke={INK} strokeWidth="7"/><path d="M106 147c28 9 78 9 108 0" stroke="#f1c77e" strokeWidth="5" fill="none"/></g>;
  const dark = variant === "rye" || variant === "multigrain" || variant === "whole-wheat";
  const seeds: readonly Point[] = [[120,125],[147,112],[181,128],[205,150],[138,169],[178,177]];
  return <g><rect x="88" y="100" width="145" height="105" rx="19" fill={dark ? "#a66e45" : "#e2b372"} stroke={INK} strokeWidth="7" transform="rotate(-4 160 152)"/>{variant === "multigrain" && <g fill={DARK_BROWN}>{seeds.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4"/>)}</g>}</g>;
}

function Meatballs() {
  const balls: readonly Point[] = [[115,141],[150,124],[187,141],[141,166],[180,166]];
  return <g><Plate/><g fill={BROWN} stroke={INK} strokeWidth="5">{balls.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="23"/>)}</g><path d="M98 127c34 18 84 18 123-2" fill="none" stroke="#d18b35" strokeWidth="10" strokeLinecap="round"/><g fill={GREEN}><circle cx="131" cy="135" r="4"/><circle cx="186" cy="155" r="4"/></g></g>;
}

function Carrots({ variant }: { variant?: string }) {
  const carrots: readonly RotPoint[] = [[111,143,-15],[139,126,8],[165,145,-7],[192,127,12],[216,147,-12],[144,164,5],[183,163,-5]];
  return <g><Plate/><g fill={variant === "harissa" ? "#e76b31" : ORANGE} stroke={INK} strokeWidth="4">{carrots.map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="22" ry="11" transform={`rotate(${r} ${x} ${y})`}/>)}</g><g fill={GREEN}><circle cx="131" cy="133" r="4"/><circle cx="183" cy="153" r="4"/></g></g>;
}

function Dumplings() {
  const dumplings: readonly RotPoint[] = [[119,142,-12],[160,127,4],[199,144,12],[147,166,-5],[184,165,7]];
  return <g><Plate/><g fill="#efd6a3" stroke={INK} strokeWidth="5">{dumplings.map(([x,y,r],i)=><path key={i} d={`M${x-22} ${y+11}q22-31 44 0l-5 18h-34Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g><g fill={GREEN}><circle cx="136" cy="130" r="4"/><circle cx="190" cy="153" r="4"/></g></g>;
}

function Sandwich({ burger = false }: { burger?: boolean }) {
  return <g><Plate/>{burger ? <><ellipse cx="160" cy="122" rx="73" ry="42" fill="#e6a34d" stroke={INK} strokeWidth="7"/><rect x="95" y="144" width="130" height="34" rx="17" fill={BROWN} stroke={INK} strokeWidth="6"/><path d="M101 139h118" stroke={GREEN} strokeWidth="12" strokeLinecap="round"/><ellipse cx="160" cy="181" rx="68" ry="21" fill="#e6a34d" stroke={INK} strokeWidth="6"/></> : <><rect x="90" y="107" width="140" height="57" rx="18" fill="#b67b4a" stroke={INK} strokeWidth="6" transform="rotate(-2 160 135)"/><path d="M101 151h119" stroke={PINK} strokeWidth="18" strokeLinecap="round"/><path d="M104 159h112" stroke="#f1d36b" strokeWidth="11" strokeLinecap="round"/><path d="M110 168h103" stroke={GREEN} strokeWidth="10" strokeLinecap="round"/><rect x="91" y="168" width="139" height="43" rx="16" fill="#b67b4a" stroke={INK} strokeWidth="6"/></>}</g>;
}

function HotDog() {
  return <g><Plate/><rect x="81" y="133" width="160" height="58" rx="29" fill="#e8a74f" stroke={INK} strokeWidth="7"/><rect x="103" y="125" width="116" height="38" rx="19" fill="#b94d35" stroke={INK} strokeWidth="6" transform="rotate(-2 161 144)"/><path d="M116 143q12-18 24 0t24 0t24 0t24 0" fill="none" stroke={GOLD} strokeWidth="7" strokeLinecap="round"/></g>;
}

function Fries() {
  const fries: readonly RotPoint[] = [[103,153,-18],[123,135,13],[145,151,-7],[164,129,10],[185,149,-11],[207,135,15],[132,168,7],[173,169,-5],[213,160,-14]];
  return <g><Plate/><g stroke={INK} strokeWidth="4" fill={GOLD}>{fries.map(([x,y,r],i)=><rect key={i} x={x-23} y={y-6} width="46" height="12" rx="5" transform={`rotate(${r} ${x} ${y})`}/>)}</g></g>;
}

function SlicedProtein({ variant }: { variant?: string }) {
  const pepperoni: readonly Point[] = [[120,128],[158,118],[190,136],[139,158],[177,161]];
  if (variant === "pepperoni") return <g fill={RED} stroke={INK} strokeWidth="4">{pepperoni.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="22"/>)}</g>;
  const slices: readonly RotPoint[] = [[115,122,-8],[143,139,5],[174,119,-6],[198,145,7]];
  return <g fill="#efc1ae" stroke={INK} strokeWidth="4">{slices.map(([x,y,r],i)=><path key={i} d={`M${x-34} ${y}q34-22 68 0q-34 20-68 0Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g>;
}

function Ingredient({ variant }: { variant?: string }) {
  const leafy: readonly RotPoint[] = [[112,139,-18],[142,119,8],[171,139,-6],[200,122,15],[135,163,8],[181,163,-9]];
  if (variant === "spinach" || variant === "romaine" || variant === "iceberg") return <g>{leafy.map(([x,y,r],i)=><Leaf key={i} x={x} y={y} r={r} fill={variant === "iceberg" ? LIGHT_GREEN : i%2?GREEN:DARK_GREEN}/>)}</g>;
  if (variant === "tomato-slices") return <g fill={RED} stroke={INK} strokeWidth="4"><circle cx="135" cy="136" r="35"/><circle cx="184" cy="145" r="35"/></g>;
  const cherries: readonly Point[] = [[115,135],[145,120],[176,137],[204,123],[139,159],[183,160]];
  if (variant === "cherry-tomatoes") return <g fill={RED} stroke={INK} strokeWidth="3">{cherries.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="15"/>)}</g>;
  if (variant === "red-onion") return <g fill="none" stroke={PURPLE} strokeWidth="12"><circle cx="130" cy="139" r="35"/><circle cx="183" cy="145" r="31"/></g>;
  const rounds: readonly Point[] = [[122,135],[160,122],[196,142],[146,160],[187,162]];
  if (variant === "pickle" || variant === "cucumber" || variant === "jalapeno") return <g fill={variant === "pickle" ? "#8eae3a" : variant === "jalapeno" ? GREEN : "#9fd45d"} stroke={INK} strokeWidth="4">{rounds.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="20"/>)}</g>;
  if (variant === "red-pepper" || variant === "mixed-peppers") {
    const strips: readonly ColorPoint[] = [[110,128,RED],[145,151,GREEN],[180,126,RED],[205,154,GREEN]];
    return <g fill="none" strokeWidth="13" strokeLinecap="round">{strips.map(([x,y,c],i)=><path key={i} d={`M${x-22} ${y}q22-18 44 0`} stroke={c}/>)}</g>;
  }
  if (variant === "giardiniera") return <RoastedVegetables variant="mixed"/>;
  const carrotStrips: readonly RotPoint[] = [[110,130,45],[130,145,-40],[155,127,35],[177,147,-35],[201,132,45],[145,163,15]];
  if (variant === "shredded-carrots") return <g stroke={ORANGE} strokeWidth="9" strokeLinecap="round">{carrotStrips.map(([x,y,r],i)=><line key={i} x1={x-18} y1={y} x2={x+18} y2={y} transform={`rotate(${r} ${x} ${y})`}/>)}</g>;
  const cubes: readonly Point[] = [[116,137],[149,122],[183,140],[139,162],[177,164]];
  return <g fill={LIGHT_GREEN} stroke={INK} strokeWidth="4">{cubes.map(([x,y],i)=><rect key={i} x={x-15} y={y-11} width="30" height="22" rx="6"/>)}</g>;
}

function Spread({ variant }: { variant?: string }) {
  const fill = variant === "pimento" ? "#f0a53b" : variant === "hummus" ? "#d99548" : variant === "garbanzo" ? "#c78336" : variant === "egg-salad" ? "#f3da73" : "#dcc982";
  const garbanzos: readonly Point[] = [[125,125],[151,137],[177,123],[198,143],[141,151]];
  return <g><Bowl/><ellipse cx="160" cy="127" rx="68" ry="27" fill={fill} stroke={INK} strokeWidth="4"/>{variant === "chickpea-salad" && <g fill={GREEN} stroke={INK} strokeWidth="2"><circle cx="134" cy="125" r="7"/><circle cx="174" cy="137" r="7"/></g>}{variant === "garbanzo" && <g fill={ORANGE} stroke={INK} strokeWidth="2">{garbanzos.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="7"/>)}</g>}</g>;
}

function Cheese({ variant }: { variant?: string }) {
  const parmesan: readonly Point[] = [[118,143],[136,128],[155,145],[176,127],[196,146],[146,163],[181,162]];
  if (variant === "grated-parmesan") return <g fill="#f0db93" stroke={INK} strokeWidth="2">{parmesan.map(([x,y],i)=><rect key={i} x={x-9} y={y-4} width="18" height="8" rx="3" transform={`rotate(${i%2?18:-18} ${x} ${y})`}/>)}</g>;
  const fill = variant === "swiss" ? "#f3df78" : variant === "american" ? GOLD : ORANGE;
  return <g fill={fill} stroke={INK} strokeWidth="5"><rect x="103" y="116" width="116" height="66" rx="5" transform="rotate(-5 160 149)"/>{variant === "swiss" && <g fill={PLATE} stroke="none"><circle cx="135" cy="134" r="7"/><circle cx="180" cy="151" r="8"/><circle cx="158" cy="166" r="6"/></g>}</g>;
}

function Dressing({ variant }: { variant?: string }) {
  const fill = variant === "pesto-mayo" ? "#b6d76c" : variant === "bbq-ranch" ? "#e99c66" : variant === "yellow-mustard" ? GOLD : variant === "dijon" ? "#d7a447" : variant === "blue-cheese" ? "#f2eee2" : variant === "honey-mustard" ? "#e5ad2f" : variant === "balsamic-vinaigrette" ? "#7b4a38" : variant === "italian" || variant === "fat-free-italian" ? "#c8d879" : CREAM;
  return <Ramekin fill={fill}/>;
}

function Chips({ variant }: { variant?: string }) {
  const pieces: readonly RotPoint[] = [[102,145,-18],[128,124,12],[156,145,-7],[185,125,14],[215,145,-11],[137,165,8],[178,165,-7]];
  return <g><Plate/><g fill={variant === "house" ? ORANGE : GOLD} stroke={INK} strokeWidth="4">{pieces.map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y+9}q18-24 36 0q-18 18-36 0Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g></g>;
}

function Grain({ variant }: { variant?: string }) {
  const fill = variant === "wheat-berries" ? "#bf8b4b" : "#e5c784";
  const grains: readonly Point[] = [[125,124],[146,136],[170,121],[194,137],[213,122],[136,151],[181,151]];
  return <g><Bowl/><ellipse cx="160" cy="128" rx="67" ry="27" fill={fill} stroke={INK} strokeWidth="4"/><g fill={CREAM}>{grains.map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="6" ry="3"/>)}</g></g>;
}

function SaladProtein({ variant }: { variant?: string }) {
  const points: readonly Point[] = [[120,137],[151,121],[184,138],[144,160],[183,161]];
  if (variant === "eggs") return <g fill={CREAM} stroke={INK} strokeWidth="4">{points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="18"/>)}</g>;
  if (variant === "tofu") return <g fill="#ead4a5" stroke={INK} strokeWidth="4">{points.map(([x,y],i)=><rect key={i} x={x-16} y={y-13} width="32" height="26" rx="5"/>)}</g>;
  return <ProteinPlate variant="chicken"/>;
}

function Bottle({ fill }: { fill: string }) {
  return <g stroke={INK} strokeWidth="7" strokeLinejoin="round"><rect x="136" y="72" width="48" height="34" rx="8" fill="#d6a36f"/><path d="M126 101h68l14 98H112Z" fill={fill}/><path d="M128 119h64" stroke="#ffffffaa" strokeWidth="5"/></g>;
}

function Topping({ variant }: { variant?: string }) {
  const fill = variant === "pepper-flakes" ? RED : variant === "oregano" ? GREEN : variant === "cranberries" ? "#a8324f" : variant === "croutons" ? "#d89b48" : GOLD;
  const curls: readonly RotPoint[] = [[110,133,24],[137,150,-28],[165,128,17],[193,150,-20],[211,130,28],[154,166,8]];
  if (variant === "fried-onions" || variant === "chow-mein") return <g fill="none" stroke={fill} strokeWidth="9" strokeLinecap="round">{curls.map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y}q18-14 36 0`} transform={`rotate(${r} ${x} ${y})`}/>)}</g>;
  const pieces: readonly Point[] = [[118,137],[146,121],[175,139],[202,124],[141,161],[185,160]];
  return <g fill={fill} stroke={INK} strokeWidth="3">{pieces.map(([x,y],i)=><rect key={i} x={x-10} y={y-7} width="20" height="14" rx="4" transform={`rotate(${i%2?12:-12} ${x} ${y})`}/>)}</g>;
}

function Dessert({ variant }: { variant?: string }) {
  if (variant === "cookie") return <g><Plate/><g fill="#7b4b33" stroke={INK} strokeWidth="6"><circle cx="132" cy="148" r="45"/><circle cx="191" cy="153" r="42"/></g><g fill="#3b281f"><circle cx="118" cy="132" r="5"/><circle cx="144" cy="158" r="5"/><circle cx="181" cy="136" r="5"/><circle cx="203" cy="163" r="5"/></g></g>;
  if (variant === "cocoa-treat") return <g><Plate/><rect x="101" y="111" width="119" height="89" rx="12" fill="#775039" stroke={INK} strokeWidth="7"/><g fill="#4b3125"><circle cx="117" cy="131" r="8"/><circle cx="143" cy="121" r="8"/><circle cx="168" cy="140" r="8"/><circle cx="196" cy="125" r="8"/></g></g>;
  return <g><Plate/><rect x="101" y="113" width="120" height="87" rx="8" fill="#e1b24c" stroke={INK} strokeWidth="7"/><g fill={CREAM}><circle cx="130" cy="135" r="6"/><circle cx="170" cy="151" r="7"/><circle cx="198" cy="131" r="5"/></g></g>;
}

function Soup() {
  const bits: readonly ColorPoint[] = [[126,123,GREEN],[151,137,ORANGE],[178,121,GREEN],[202,138,RED],[137,148,LIGHT_GREEN],[185,150,ORANGE]];
  return <g><Bowl/><ellipse cx="160" cy="127" rx="68" ry="27" fill="#f1cc5f" stroke={INK} strokeWidth="4"/><g stroke={INK} strokeWidth="2">{bits.map(([x,y,c],i)=><circle key={i} cx={x} cy={y} r="7" fill={c}/>)}</g></g>;
}

function Crackers() {
  return <g fill="#efd69b" stroke={INK} strokeWidth="5"><rect x="93" y="104" width="88" height="113" rx="10" transform="rotate(-8 137 160)"/><rect x="155" y="110" width="88" height="113" rx="10" transform="rotate(8 199 166)"/><g fill={INK} stroke="none"><circle cx="116" cy="135" r="3"/><circle cx="145" cy="148" r="3"/><circle cx="185" cy="139" r="3"/><circle cx="209" cy="160" r="3"/></g></g>;
}

function Salad() {
  const leaves: readonly RotPoint[] = [[116,133,-18],[144,117,8],[174,132,-7],[202,119,16],[139,151,7],[182,151,-10]];
  return <g><Bowl/><g>{leaves.map(([x,y,r],i)=><Leaf key={i} x={x} y={y} r={r} fill={i%2?GREEN:LIGHT_GREEN}/>)}</g><g fill={RED} stroke={INK} strokeWidth="2"><circle cx="130" cy="137" r="8"/><circle cx="193" cy="141" r="8"/></g></g>;
}

function PlateMix() {
  return <g><Plate/><rect x="98" y="125" width="105" height="50" rx="20" fill="#c97948" stroke={INK} strokeWidth="6" transform="rotate(-7 150 150)"/><Leaf x={218} y={142} r={8}/><rect x="203" y="162" width="28" height="20" rx="6" fill={ORANGE} stroke={INK} strokeWidth="3"/></g>;
}

function artForSpec(spec: MenuVisualSpec) {
  switch (spec.kind) {
    case "pizza": return <Pizza variant={spec.variant}/>;
    case "protein-plate": return <ProteinPlate variant={spec.variant}/>;
    case "tenders": return <Tenders/>;
    case "potatoes": return <Potatoes/>;
    case "roasted-vegetables": return <RoastedVegetables variant={spec.variant}/>;
    case "green-beans": return <GreenBeans/>;
    case "pasta": return <Pasta variant={spec.variant}/>;
    case "sauce": return <Sauce variant={spec.variant}/>;
    case "bread": return <Bread variant={spec.variant}/>;
    case "meatballs": return <Meatballs/>;
    case "carrots": return <Carrots variant={spec.variant}/>;
    case "dumplings": return <Dumplings/>;
    case "sandwich": return <Sandwich/>;
    case "burger": return <Sandwich burger/>;
    case "hotdog": return <HotDog/>;
    case "fries": return <Fries/>;
    case "sliced-protein": return <SlicedProtein variant={spec.variant}/>;
    case "ingredient": return <Ingredient variant={spec.variant}/>;
    case "spread": return <Spread variant={spec.variant}/>;
    case "cheese": return <Cheese variant={spec.variant}/>;
    case "dressing": return <Dressing variant={spec.variant}/>;
    case "chips": return <Chips variant={spec.variant}/>;
    case "grain": return <Grain variant={spec.variant}/>;
    case "salad-protein": return <SaladProtein variant={spec.variant}/>;
    case "oil": return <Bottle fill="#9bad31"/>;
    case "vinegar": return <Bottle fill={spec.variant === "red-wine" ? "#a43d3f" : "#684436"}/>;
    case "topping": return <Topping variant={spec.variant}/>;
    case "dessert": return <Dessert variant={spec.variant}/>;
    case "soup": return <Soup/>;
    case "crackers": return <Crackers/>;
    case "salad": return <Salad/>;
    default: return <PlateMix/>;
  }
}

export default function MenuFoodIllustration({ name }: { name: string }) {
  const spec = menuVisualForName(name);
  return <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">{artForSpec(spec)}</svg>;
}
