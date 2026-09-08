const INK = "#10263d";
const PLATE = "#fffdf8";
const RED = "#ef4a3c";
const TOMATO = "#d94132";
const GREEN = "#2f9d3a";
const DARK_GREEN = "#1f6f31";
const LIGHT_GREEN = "#72bd49";
const GOLD = "#f3b536";
const ORANGE = "#e98b2f";
const CREAM = "#fff5dd";
const BEAN = "#49354c";
const MUSHROOM = "#9b6844";
const LENTIL = "#b86e36";
const PASTA = "#efb85d";
const SAUCE = "#d8612e";

const NORMALIZE = (value: string) => value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

function Plate() {
  return (
    <g>
      <ellipse cx="160" cy="154" rx="126" ry="58" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="154" rx="106" ry="44" fill="none" stroke="#dfe8ed" strokeWidth="3" />
    </g>
  );
}

function Bowl({ x = 160, y = 128, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK} strokeLinejoin="round">
      <ellipse cx="0" cy="0" rx="79" ry="34" fill={PLATE} strokeWidth="6" />
      <path d="M-79 0c8 55 38 78 79 78S71 55 79 0C57 20 30 29 0 29S-58 20-79 0Z" fill={PLATE} strokeWidth="6" />
    </g>
  );
}

function Ramekin({ fill, accent }: { fill: string; accent?: string }) {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <ellipse cx="160" cy="130" rx="66" ry="30" fill={PLATE} strokeWidth="6" />
      <path d="M98 130c6 50 28 67 62 67s56-17 62-67c-18 16-39 23-62 23s-44-7-62-23Z" fill={PLATE} strokeWidth="6" />
      <ellipse cx="160" cy="129" rx="54" ry="22" fill={fill} stroke={accent || INK} strokeWidth="4" />
    </g>
  );
}

function Penne({ x, y, rotate = 0, fill = PASTA }: { x: number; y: number; rotate?: number; fill?: string }) {
  return (
    <g transform={`rotate(${rotate} ${x} ${y})`}>
      <rect x={x - 18} y={y - 7} width="36" height="14" rx="6" fill={fill} stroke={INK} strokeWidth="3" />
      <line x1={x - 10} y1={y - 4} x2={x + 10} y2={y + 4} stroke="#d99443" strokeWidth="2" />
    </g>
  );
}

function LentilBolognesePasta() {
  const pasta = [[96,142,-16],[126,126,9],[160,142,-8],[191,124,13],[220,145,-10],[119,163,8],[155,166,14],[193,163,-5]] as const;
  const lentils = [[117,130],[144,139],[170,127],[195,143],[133,154],[160,154],[186,154],[208,136]] as const;
  return (
    <g>
      <Plate />
      {pasta.map(([x,y,r],i)=><Penne key={i} x={x} y={y} rotate={r} />)}
      <path d="M96 130c27-34 104-37 132 3-3 22-28 35-66 35-40 0-64-13-66-38Z" fill={SAUCE} stroke={INK} strokeWidth="4" />
      {lentils.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill={LENTIL} stroke={INK} strokeWidth="2"/>)}
      <g fill={GREEN}><circle cx="134" cy="124" r="4"/><circle cx="181" cy="136" r="4"/><circle cx="157" cy="149" r="4"/></g>
    </g>
  );
}

function LentilBolognese() {
  const lentils = [[120,119],[145,112],[170,120],[195,113],[131,137],[158,139],[186,135],[210,130]] as const;
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="128" rx="67" ry="26" fill={SAUCE} stroke={INK} strokeWidth="4" />
      {lentils.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill={LENTIL} stroke={INK} strokeWidth="2"/>)}
      <g fill={GREEN}><circle cx="151" cy="113" r="4"/><circle cx="181" cy="127" r="4"/><circle cx="137" cy="136" r="4"/></g>
    </g>
  );
}

function ChickpeaVegetablePasta() {
  const pasta = [[100,138,-12],[129,121,7],[158,142,-5],[188,122,9],[218,143,-11],[121,161,6],[155,165,12],[193,160,-4]] as const;
  const chickpeas = [[116,130],[146,132],[178,130],[201,145],[133,151],[168,154],[191,151]] as const;
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="128" rx="69" ry="27" fill="#f5c873" stroke={INK} strokeWidth="4" />
      {pasta.map(([x,y,r],i)=><Penne key={i} x={x} y={y} rotate={r} fill="#f0ba60"/>)}
      {chickpeas.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill="#e8d08b" stroke={INK} strokeWidth="2"/>)}
      <g stroke={INK} strokeWidth="2"><circle cx="128" cy="122" r="8" fill={GREEN}/><circle cx="183" cy="141" r="8" fill={GREEN}/><rect x="206" y="122" width="13" height="13" rx="3" fill={RED}/><rect x="145" y="150" width="12" height="12" rx="3" fill="#e6a33b"/></g>
    </g>
  );
}

function SauteedSpinachOnion() {
  const leaves = [
    [113,126,-18],[142,112,12],[172,121,-8],[202,112,18],[122,151,8],[156,145,-14],[190,151,12],[216,139,-12],
  ] as const;
  const onions = [[126,126,-28],[173,130,16],[208,132,-18],[149,157,24],[196,158,-20]] as const;
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="129" rx="67" ry="27" fill="#225d2d" stroke={INK} strokeWidth="4" />
      {leaves.map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y}c8-18 28-20 37-3 8 14-3 29-20 29-16 0-24-12-17-26Z`} transform={`rotate(${r} ${x} ${y})`} fill={i%2?DARK_GREEN:GREEN} stroke={INK} strokeWidth="3"/>)}
      {onions.map(([x,y,r],i)=><path key={i} d={`M${x-14} ${y-8}q15 18 30 0`} transform={`rotate(${r} ${x} ${y})`} fill="none" stroke={CREAM} strokeWidth="8" strokeLinecap="round"/>)}
      <g stroke={LIGHT_GREEN} strokeWidth="3" strokeLinecap="round"><path d="M104 133l20 9"/><path d="M158 118l18 11"/><path d="M187 148l18 5"/></g>
    </g>
  );
}

function PestoSauce() {
  return <Ramekin fill="#65a943" accent={INK} />;
}

function TortillaChips({ assembled = false }: { assembled?: boolean }) {
  const chips = [[105,143,-13],[132,123,8],[160,144,-7],[188,124,11],[215,144,-10],[128,163,7],[164,166,12],[199,161,-6]] as const;
  return (
    <g>
      <Plate />
      <g fill={GOLD} stroke={INK} strokeWidth="4" strokeLinejoin="round">
        {chips.map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y+11}L${x} ${y-17}L${x+18} ${y+11}Z`} transform={`rotate(${r} ${x} ${y})`}/>) }
      </g>
      {assembled && <>
        <g fill={BEAN} stroke={INK} strokeWidth="2"><circle cx="126" cy="141" r="7"/><circle cx="176" cy="132" r="7"/><circle cx="193" cy="154" r="7"/></g>
        <g fill={RED} stroke={INK} strokeWidth="2"><rect x="138" y="129" width="11" height="11" rx="2"/><rect x="165" y="151" width="11" height="11" rx="2"/><rect x="207" y="135" width="11" height="11" rx="2"/></g>
        <path d="M144 137c12-13 28-12 36 1" fill="none" stroke={CREAM} strokeWidth="8" strokeLinecap="round"/>
        <g fill={GREEN} stroke={INK} strokeWidth="2"><circle cx="117" cy="153" r="7"/><circle cx="184" cy="145" r="7"/><circle cx="212" cy="155" r="7"/></g>
      </>}
    </g>
  );
}

function SpicyJalapenoChicken() {
  return (
    <g>
      <Plate />
      <g fill="#c66c3b" stroke={INK} strokeWidth="4"><rect x="105" y="130" width="44" height="25" rx="10" transform="rotate(-8 127 143)"/><rect x="145" y="119" width="48" height="27" rx="10" transform="rotate(8 169 133)"/><rect x="178" y="146" width="47" height="26" rx="10" transform="rotate(-5 201 159)"/><rect x="123" y="157" width="45" height="25" rx="10" transform="rotate(6 146 170)"/></g>
      <g fill={GREEN} stroke={INK} strokeWidth="3"><circle cx="122" cy="126" r="10"/><circle cx="181" cy="149" r="10"/><circle cx="212" cy="130" r="10"/></g>
      <g fill={CREAM}><circle cx="122" cy="126" r="3"/><circle cx="181" cy="149" r="3"/><circle cx="212" cy="130" r="3"/></g>
    </g>
  );
}

function RoastedMushrooms() {
  const mushrooms = [[105,143,-8],[133,121,10],[164,144,-5],[193,124,12],[219,147,-10],[134,165,7],[178,165,-7]] as const;
  return (
    <g>
      <Plate />
      <g fill={MUSHROOM} stroke={INK} strokeWidth="4">{mushrooms.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><ellipse cx={x} cy={y} rx="20" ry="14"/><rect x={x-5} y={y+8} width="10" height="17" rx="4" fill="#d7b18b"/></g>)}</g>
      <path d="M226 146l24 12-20 18Z" fill="#b9d94f" stroke={INK} strokeWidth="4"/>
      <g fill={GREEN}><circle cx="125" cy="137" r="4"/><circle cx="172" cy="123" r="4"/><circle cx="204" cy="161" r="4"/></g>
    </g>
  );
}

function SmashedBlackBeans() {
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="129" rx="66" ry="26" fill={BEAN} stroke={INK} strokeWidth="4" />
      <path d="M115 132c15-15 31 4 47-7 18-12 31 10 49-1" fill="none" stroke="#694d6a" strokeWidth="7" strokeLinecap="round"/>
      <g fill={GREEN}><circle cx="144" cy="119" r="4"/><circle cx="176" cy="134" r="4"/><circle cx="198" cy="122" r="4"/></g>
    </g>
  );
}

function Pico() {
  return (
    <g>
      <Ramekin fill="#f15b48" />
      <g stroke={INK} strokeWidth="2"><rect x="124" y="119" width="12" height="12" rx="2" fill={RED}/><rect x="145" y="133" width="12" height="12" rx="2" fill="#f39b72"/><rect x="168" y="119" width="12" height="12" rx="2" fill={RED}/><rect x="189" y="132" width="12" height="12" rx="2" fill="#e24b35"/></g>
      <g fill={GREEN}><circle cx="139" cy="123" r="4"/><circle cx="178" cy="137" r="4"/><circle cx="201" cy="121" r="4"/></g>
    </g>
  );
}

function MangoPineappleSalsa() {
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="129" rx="66" ry="26" fill="#f2bf47" stroke={INK} strokeWidth="4" />
      <g stroke={INK} strokeWidth="2">{[[120,120,GOLD],[144,135,"#f3a63b"],[170,119,GOLD],[197,136,"#ef8e35"],[213,119,GOLD],[133,147,"#e66b49"],[183,147,"#f3a63b"]].map(([x,y,c],i)=><rect key={i} x={Number(x)-7} y={Number(y)-7} width="14" height="14" rx="3" fill={String(c)}/>)}</g>
      <g fill={GREEN}><circle cx="151" cy="120" r="4"/><circle cx="204" cy="144" r="4"/></g>
    </g>
  );
}

function Romaine() {
  const leaves = [[116,145,-20],[141,124,12],[164,148,-8],[190,126,15],[211,148,-12],[139,163,8],[181,164,-10]] as const;
  return (
    <g transform="translate(0 2)">
      {leaves.map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y+12}c3-24 15-38 30-42 7 11 8 25 1 41-9 17-23 23-31 1Z`} transform={`rotate(${r} ${x} ${y})`} fill={i%2?LIGHT_GREEN:GREEN} stroke={INK} strokeWidth="4"/>)}
      <g stroke="#dff0a5" strokeWidth="3" strokeLinecap="round"><path d="M112 129l8 29"/><path d="M164 132l-2 30"/><path d="M198 130l5 28"/></g>
    </g>
  );
}

function GreenOnions() {
  const pieces = [[112,142,-8],[137,124,11],[164,145,-6],[190,127,12],[214,147,-10],[132,161,7],[173,164,-7]] as const;
  return <g fill={GREEN} stroke={INK} strokeWidth="4">{pieces.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><rect x={x-13} y={y-7} width="26" height="14" rx="5"/><ellipse cx={x} cy={y} rx="7" ry="5" fill={LIGHT_GREEN}/></g>)}</g>;
}

export default function LunchFoodIllustration({ name }: { name: string }) {
  const value = NORMALIZE(name);
  let body = null;

  if (value === "lentil bolognese pasta") body = <LentilBolognesePasta />;
  else if (value === "lentil bolognese") body = <LentilBolognese />;
  else if (value === "pasta, chickpeas and vegetable marinara") body = <ChickpeaVegetablePasta />;
  else if (value === "sautéed spinach and onion" || value === "sauteed spinach and onion") body = <SauteedSpinachOnion />;
  else if (value === "pesto sauce") body = <PestoSauce />;
  else if (value === "build your own nachos") body = <TortillaChips assembled />;
  else if (value === "crispy tortilla chips") body = <TortillaChips />;
  else if (value === "spicy jalapeno chicken") body = <SpicyJalapenoChicken />;
  else if (value === "roasted mushrooms, garlic and lime") body = <RoastedMushrooms />;
  else if (value === "smashed black beans") body = <SmashedBlackBeans />;
  else if (value === "spicy chipotle crema") body = <Ramekin fill="#e7a063" />;
  else if (value === "sour cream") body = <Ramekin fill="#fffdf8" />;
  else if (value === "pico de gallo") body = <Pico />;
  else if (value === "mango pineapple salsa") body = <MangoPineappleSalsa />;
  else if (value === "shredded romaine") body = <Romaine />;
  else if (value === "chopped green onions") body = <GreenOnions />;

  if (!body) return null;
  return <svg className="ff-food-art" viewBox="0 0 320 240" aria-hidden="true" focusable="false">{body}</svg>;
}
