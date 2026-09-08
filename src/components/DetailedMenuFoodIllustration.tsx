import { menuVisualForName } from "@/lib/menuIllustrationCatalog";

const INK = "#10263d";
const PLATE = "#fffdf8";
const RIM = "#d7e2e8";
const RED = "#df493d";
const TOMATO = "#d84635";
const GREEN = "#2f8f46";
const DARK_GREEN = "#1f6f36";
const LIGHT_GREEN = "#87bd58";
const GOLD = "#efb83f";
const ORANGE = "#e78a34";
const CREAM = "#fff2cc";
const BROWN = "#9a603b";
const DARK_BROWN = "#65402d";
const PURPLE = "#8b4e8f";
const PINK = "#df8da6";
const YELLOW = "#f3c84d";
const BROTH = "#d99a3f";

function Shadow({ cx = 160, cy = 196, rx = 112, ry = 17 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(16,38,61,.08)" />;
}

function Plate() {
  return (
    <g>
      <Shadow cy={201} rx={116} ry={15} />
      <ellipse cx="160" cy="154" rx="126" ry="58" fill={PLATE} stroke={INK} strokeWidth="7" />
      <ellipse cx="160" cy="154" rx="106" ry="44" fill="none" stroke={RIM} strokeWidth="3" />
    </g>
  );
}

function Bowl() {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <Shadow cy={203} rx={82} ry={13} />
      <ellipse cx="160" cy="126" rx="82" ry="35" fill={PLATE} strokeWidth="7" />
      <path d="M78 126c7 58 39 82 82 82s75-24 82-82c-22 21-51 31-82 31s-60-10-82-31Z" fill={PLATE} strokeWidth="7" />
      <path d="M101 164c16 21 36 31 59 31s44-10 59-31" fill="none" stroke={RIM} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Ramekin({ fill }: { fill: string }) {
  return (
    <g stroke={INK} strokeLinejoin="round">
      <Shadow cy={192} rx={63} ry={10} />
      <ellipse cx="160" cy="128" rx="67" ry="30" fill={PLATE} strokeWidth="6" />
      <path d="M98 128c5 47 27 67 62 67s57-20 62-67c-17 16-39 23-62 23s-45-7-62-23Z" fill={PLATE} strokeWidth="6" />
      <ellipse cx="160" cy="128" rx="54" ry="22" fill={fill} stroke={INK} strokeWidth="4" />
      <path d="M126 128c17-9 47-9 67 0" fill="none" stroke="rgba(255,255,255,.46)" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Leaf({ x, y, rotate = 0, fill = GREEN, scale = 1 }: { x: number; y: number; rotate?: number; fill?: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M-18 8C-13-18 10-26 23-9C34 6 19 26-2 25C-16 24-25 17-18 8Z" fill={fill} stroke={INK} strokeWidth="3" />
      <path d="M-10 11C0 5 10-2 17-12" fill="none" stroke="rgba(255,255,255,.62)" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function TomatoSlice({ x, y, r = 24 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={TOMATO} stroke={INK} strokeWidth="4" />
      <circle cx={x} cy={y} r={Math.max(6, r * .28)} fill="#f7a36b" />
      {[0, 120, 240].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <ellipse key={a} cx={x + Math.cos(rad) * r * .5} cy={y + Math.sin(rad) * r * .5} rx="4" ry="2" fill={CREAM} transform={`rotate(${a} ${x + Math.cos(rad) * r * .5} ${y + Math.sin(rad) * r * .5})`} />;
      })}
    </g>
  );
}

function CucumberSlice({ x, y, r = 21, pickle = false }: { x: number; y: number; r?: number; pickle?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={pickle ? "#7f9f3d" : "#9dcd65"} stroke={INK} strokeWidth="4" />
      <circle cx={x} cy={y} r={r * .62} fill={pickle ? "#a5b95d" : "#d6eaa0"} stroke={DARK_GREEN} strokeWidth="2" />
      {[0, 120, 240].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <ellipse key={a} cx={x + Math.cos(rad) * r * .28} cy={y + Math.sin(rad) * r * .28} rx="3" ry="1.7" fill={CREAM} />;
      })}
    </g>
  );
}

function OnionRing({ x, y, r = 25 }: { x: number; y: number; r?: number }) {
  return <g fill="none" stroke={PURPLE}><circle cx={x} cy={y} r={r} strokeWidth="7"/><circle cx={x} cy={y} r={r * .55} strokeWidth="4"/></g>;
}

function MushroomSlice({ x, y, rotate = 0, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} stroke={INK} strokeLinejoin="round">
      <path d="M-25 4C-22-16-8-28 10-27C29-25 36-10 31 5Z" fill="#b88a66" strokeWidth="4" />
      <path d="M-3 3L-8 24H11L7 3Z" fill="#e3c7a4" strokeWidth="4" />
      <path d="M-18 1C-8-6 13-7 24 0" fill="none" stroke="#8a6045" strokeWidth="3" />
    </g>
  );
}

function CarrotCoin({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  return <g><circle cx={x} cy={y} r={r} fill={ORANGE} stroke={INK} strokeWidth="3"/><path d={`M${x-r*.45} ${y}h${r*.9}`} stroke="#f7c06a" strokeWidth="2" strokeLinecap="round"/></g>;
}

function PepperStrip({ x, y, color = RED, rotate = 0 }: { x: number; y: number; color?: string; rotate?: number }) {
  return <path d={`M${x-21} ${y+5}C${x-5} ${y-13},${x+8} ${y-13},${x+22} ${y+3}`} transform={`rotate(${rotate} ${x} ${y})`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />;
}

function DetailedSandwich({ variant }: { variant?: string }) {
  const rye = variant?.includes("rye") || variant?.includes("ham-swiss");
  return (
    <g>
      <Plate />
      <g transform="translate(0 1) rotate(-2 160 150)">
        <path d="M93 129Q96 100 124 98H196Q224 101 227 129L218 143H101Z" fill={rye ? "#a76b42" : "#d8a365"} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        {rye && <g fill="#6a452f">{[[120,112],[147,106],[174,115],[202,108]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="3" ry="2" transform={`rotate(${i%2?20:-20} ${x} ${y})`}/>)}</g>}
        <path d="M105 145C126 136 140 153 158 144C178 134 194 149 215 143" fill="none" stroke={PINK} strokeWidth="16" strokeLinecap="round" />
        <path d="M108 153L151 146L186 153L214 146" fill="none" stroke={YELLOW} strokeWidth="12" strokeLinecap="round" />
        {variant?.includes("swiss") && <g fill={PLATE}><circle cx="136" cy="149" r="4"/><circle cx="178" cy="151" r="4"/><circle cx="198" cy="148" r="3"/></g>}
        <path d="M111 159C133 149 152 170 171 158C186 149 200 164 215 157" fill="none" stroke="#d8a83d" strokeWidth="5" strokeLinecap="round" />
        <path d="M94 164H226L219 188Q215 201 197 203H122Q104 201 100 188Z" fill={rye ? "#9d643d" : "#d4a064"} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        <path d="M113 181C134 176 185 176 209 181" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  );
}

function DetailedSoup() {
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="126" rx="68" ry="27" fill={BROTH} stroke={INK} strokeWidth="4" />
      <CarrotCoin x={125} y={123} r={10} />
      <CarrotCoin x={190} y={137} r={9} />
      <g fill={GREEN} stroke={INK} strokeWidth="2"><circle cx="148" cy="135" r="7"/><circle cx="205" cy="120" r="6"/><circle cx="170" cy="116" r="6"/></g>
      <g stroke={DARK_GREEN} strokeWidth="5" strokeLinecap="round"><path d="M108 138l18-9"/><path d="M181 132l18-10"/></g>
      <g fill="#f2d8a0" stroke={INK} strokeWidth="2"><path d="M133 111q12-9 24 0q-12 9-24 0Z"/><path d="M160 143q12-8 24 0q-12 9-24 0Z"/></g>
      <path d="M116 117c18-8 43-12 65-4" fill="none" stroke="rgba(255,255,255,.36)" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function DetailedEggPieces() {
  const pieces = [[120,132,-12],[154,118,7],[190,134,13],[145,158,-6],[184,160,5]] as const;
  return (
    <g>
      {pieces.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><path d={`M${x-20} ${y+7}Q${x} ${y-20} ${x+20} ${y+7}Q${x} ${y+24} ${x-20} ${y+7}Z`} fill={PLATE} stroke={INK} strokeWidth="4"/><circle cx={x} cy={y+2} r="8" fill={YELLOW} stroke="#c38c29" strokeWidth="2"/></g>)}
    </g>
  );
}

function DetailedRoastedVegetables() {
  return (
    <g>
      <Plate />
      <CucumberSlice x={110} y={145} r={18} />
      <CucumberSlice x={151} y={124} r={18} />
      <CarrotCoin x={181} y={151} r={15} />
      <CarrotCoin x={219} y={132} r={13} />
      <PepperStrip x={135} y={164} color={RED} rotate={9} />
      <PepperStrip x={196} y={116} color={GREEN} rotate={-8} />
      <MushroomSlice x={205} y={166} rotate={8} scale={.68} />
      <g fill={DARK_GREEN}><circle cx="126" cy="125" r="4"/><circle cx="172" cy="167" r="4"/><circle cx="224" cy="153" r="4"/></g>
    </g>
  );
}

function DetailedPasta({ variant }: { variant?: string }) {
  const tubes = [[112,132,-18],[141,117,7],[171,132,-8],[202,116,15],[126,151,8],[159,154,-10],[193,151,6],[213,139,-8]] as const;
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="126" rx="68" ry="27" fill="#f1c46b" stroke={INK} strokeWidth="4" />
      {tubes.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><rect x={x-15} y={y-6} width="30" height="12" rx="5" fill="#e8ad50" stroke={INK} strokeWidth="2.5"/><line x1={x-8} y1={y-2} x2={x+8} y2={y+2} stroke="#c57d37" strokeWidth="2"/></g>)}
      {variant === "dinner" && <><path d="M113 136c18-18 72-22 96 1" fill="none" stroke={TOMATO} strokeWidth="10" strokeLinecap="round"/><g fill={GREEN}><circle cx="133" cy="128" r="4"/><circle cx="179" cy="145" r="4"/><circle cx="203" cy="126" r="4"/></g></>}
    </g>
  );
}

function DetailedPizza({ variant }: { variant?: string }) {
  return (
    <g>
      <Plate />
      <path d="M86 178L160 88L236 178Q160 205 86 178Z" fill="#e7b657" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M105 159Q160 133 216 159" fill="none" stroke={TOMATO} strokeWidth="17" strokeLinecap="round" />
      <path d="M111 151Q160 132 210 151" fill="none" stroke="#f3df7e" strokeWidth="15" strokeLinecap="round" />
      <path d="M122 174Q160 188 201 173" fill="none" stroke="#c7833f" strokeWidth="8" strokeLinecap="round" />
      {variant === "pepperoni" && <g fill={RED} stroke={INK} strokeWidth="3"><circle cx="137" cy="139" r="11"/><circle cx="169" cy="128" r="11"/><circle cx="194" cy="148" r="11"/></g>}
      {variant === "sausage" && <g fill={BROWN} stroke={INK} strokeWidth="3">{[[132,141],[160,127],[193,148],[166,154]].map(([x,y],i)=><path key={i} d={`M${x-9} ${y+3}q8-15 18-3q4 10-7 15q-10 5-11-9Z`}/>)}</g>}
      <g fill={GREEN}><circle cx="153" cy="145" r="3"/><circle cx="183" cy="137" r="3"/></g>
    </g>
  );
}

function DetailedProtein({ variant = "" }: { variant?: string }) {
  const lower = variant.toLowerCase();
  const isFish = /salmon|fish/.test(lower);
  const isSteak = /steak|beef/.test(lower);
  const fill = isFish ? "#ea936a" : isSteak ? "#8f5338" : "#c87949";
  return (
    <g>
      <Plate />
      <path d="M98 151C103 122 128 108 163 111C196 113 219 132 217 159C214 182 190 192 156 188C120 185 94 173 98 151Z" fill={fill} stroke={INK} strokeWidth="7" />
      <path d="M119 128c15 10 27 25 39 43M145 119c14 12 28 30 38 50M172 119c11 13 21 28 29 43" fill="none" stroke={isFish ? "#c96950" : "#74462f"} strokeWidth="4" strokeLinecap="round" />
      {!isSteak && !isFish && <path d="M112 145c20-12 58-14 87-4" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="4" strokeLinecap="round" />}
      <Leaf x={224} y={138} rotate={12} scale={.75} />
      <Leaf x={220} y={164} rotate={-10} fill={LIGHT_GREEN} scale={.68} />
      {lower.includes("bbq") && <path d="M111 151c27 10 55 3 86-2" fill="none" stroke="#8f3027" strokeWidth="8" strokeLinecap="round" />}
    </g>
  );
}

function DetailedBurger() {
  return (
    <g>
      <Plate />
      <g stroke={INK} strokeLinejoin="round">
        <path d="M93 136Q100 99 160 94Q220 99 227 136Z" fill="#dda457" strokeWidth="7" />
        <g fill={CREAM} stroke="none">{[[126,112],[151,106],[178,111],[198,120]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="4" ry="2" transform={`rotate(${i%2?20:-20} ${x} ${y})`}/>)}</g>
        <path d="M103 143c26-14 87-14 114 0" fill="none" stroke={GREEN} strokeWidth="12" strokeLinecap="round" />
        <path d="M108 151h104" stroke={TOMATO} strokeWidth="12" strokeLinecap="round" />
        <rect x="103" y="156" width="114" height="28" rx="13" fill={BROWN} strokeWidth="6" />
        <path d="M107 183h106" stroke={YELLOW} strokeWidth="10" strokeLinecap="round" />
        <path d="M100 190Q160 211 220 190L214 204Q160 218 106 204Z" fill="#d69b50" strokeWidth="6" />
      </g>
    </g>
  );
}

function DetailedHotDog() {
  return (
    <g>
      <Plate />
      <path d="M79 166Q92 125 119 123H202Q228 126 241 166Q218 193 160 195Q102 193 79 166Z" fill="#dfa552" stroke={INK} strokeWidth="7" />
      <rect x="101" y="130" width="119" height="38" rx="19" fill="#b84f39" stroke={INK} strokeWidth="5" transform="rotate(-2 160 149)" />
      <path d="M113 148q12-16 24 0t24 0t24 0t24 0" fill="none" stroke={YELLOW} strokeWidth="6" strokeLinecap="round" />
      <path d="M94 173c26 10 91 12 132 0" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function DetailedFries() {
  const fries = [[104,157,-18],[122,137,13],[145,154,-6],[165,132,9],[185,151,-11],[207,137,15],[134,171,6],[175,170,-6],[212,161,-14]] as const;
  return <g><Plate/><g fill={GOLD} stroke={INK} strokeWidth="3.5">{fries.map(([x,y,r],i)=><rect key={i} x={x-22} y={y-6} width="44" height="12" rx="5" transform={`rotate(${r} ${x} ${y})`}/>)}</g><g stroke="#c98b2e" strokeWidth="2">{fries.slice(0,5).map(([x,y,r],i)=><line key={i} x1={x-13} y1={y-1} x2={x+13} y2={y+1} transform={`rotate(${r} ${x} ${y})`}/>)}</g></g>;
}

function DetailedBread({ variant = "" }: { variant?: string }) {
  if (variant.includes("pita") || variant.includes("tortilla")) return <g><Shadow cy={190} rx={92} ry={11}/><ellipse cx="160" cy="146" rx="100" ry="58" fill="#efd7a4" stroke={INK} strokeWidth="7"/><path d="M105 143c25-16 77-22 109-4" fill="none" stroke="#d3af72" strokeWidth="4" strokeLinecap="round"/></g>;
  if (variant.includes("hoagie") || variant.includes("roll") || variant.includes("slider")) return <g><Shadow cy={190} rx={85} ry={11}/><path d="M76 148Q89 106 126 104H197Q232 108 244 148Q230 186 197 190H121Q88 187 76 148Z" fill="#dfa55a" stroke={INK} strokeWidth="7"/><path d="M100 136c38-18 86-18 123 0" fill="none" stroke="#f2c982" strokeWidth="5" strokeLinecap="round"/></g>;
  return <g><Shadow cy={198} rx={84} ry={11}/><path d="M91 111Q94 90 117 90H202Q224 93 228 114L221 203H98Z" fill={variant.includes("rye")||variant.includes("multigrain")||variant.includes("whole")?"#a96f47":"#dfb06b"} stroke={INK} strokeWidth="7"/><path d="M113 122c22-9 71-9 94 0" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="4" strokeLinecap="round"/><g fill={DARK_BROWN}>{[[125,139],[153,128],[184,144],[139,169],[195,173]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="3" ry="2" transform={`rotate(${i%2?20:-20} ${x} ${y})`}/>)}</g></g>;
}

function DetailedMeatballs() {
  const balls = [[116,145],[151,125],[190,143],[143,168],[181,168]] as const;
  return <g><Plate/><g fill={BROWN} stroke={INK} strokeWidth="5">{balls.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="22"/><path d={`M${x-10} ${y-6}q10-7 20 1`} fill="none" stroke="#c3875c" strokeWidth="3" strokeLinecap="round"/></g>)}</g><path d="M101 126c35 19 80 19 119-2" fill="none" stroke="#c98731" strokeWidth="9" strokeLinecap="round"/><g fill={GREEN}><circle cx="134" cy="137" r="4"/><circle cx="188" cy="157" r="4"/></g></g>;
}

function DetailedCarrots({ harissa = false }: { harissa?: boolean }) {
  return <g><Plate/>{[[111,143],[142,126],[172,147],[201,127],[218,153],[145,166],[184,166]].map(([x,y],i)=><CarrotCoin key={i} x={x} y={y} r={i%2?13:15}/>)}{harissa && <path d="M105 148c28-15 65-20 102-7" fill="none" stroke="#c94b2f" strokeWidth="7" strokeLinecap="round"/>}<g fill={GREEN}><circle cx="131" cy="133" r="4"/><circle cx="183" cy="153" r="4"/></g></g>;
}

function DetailedDumplings() {
  const dumplings = [[118,143,-12],[160,126,4],[199,144,12],[146,166,-5],[184,165,7]] as const;
  return <g><Plate/><g fill="#eed6a3" stroke={INK} strokeWidth="5">{dumplings.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><path d={`M${x-23} ${y+10}Q${x} ${y-24} ${x+23} ${y+10}L${x+17} ${y+26}H${x-17}Z`}/><path d={`M${x-13} ${y+3}q13-8 26 0`} fill="none" stroke="#cda66f" strokeWidth="2.5"/></g>)}</g><g fill={GREEN}><circle cx="136" cy="130" r="4"/><circle cx="190" cy="153" r="4"/></g></g>;
}

function DetailedIngredient({ variant = "" }: { variant?: string }) {
  if (variant.includes("spinach") || variant.includes("romaine") || variant.includes("iceberg")) return <g>{[[112,139,-18],[142,119,8],[171,139,-6],[200,122,15],[135,163,8],[181,163,-9]].map(([x,y,r],i)=><Leaf key={i} x={x} y={y} rotate={r} fill={variant.includes("iceberg")?LIGHT_GREEN:i%2?GREEN:DARK_GREEN}/>)}</g>;
  if (variant.includes("tomato-slices")) return <g><TomatoSlice x={136} y={139} r={34}/><TomatoSlice x={187} y={146} r={33}/></g>;
  if (variant.includes("cherry-tomatoes")) return <g>{[[116,135],[145,120],[176,137],[204,123],[139,159],[183,160]].map(([x,y],i)=><TomatoSlice key={i} x={x} y={y} r={14}/>)}</g>;
  if (variant.includes("red-onion")) return <g><OnionRing x={132} y={139} r={30}/><OnionRing x={187} y={145} r={28}/></g>;
  if (variant.includes("pickle") || variant.includes("cucumber") || variant.includes("jalapeno")) return <g>{[[121,136],[160,121],[198,142],[145,161],[186,162]].map(([x,y],i)=><CucumberSlice key={i} x={x} y={y} r={18} pickle={variant.includes("pickle")||variant.includes("jalapeno")}/>)}</g>;
  if (variant.includes("red-pepper") || variant.includes("mixed-peppers")) return <g><PepperStrip x={119} y={135} color={RED} rotate={-12}/><PepperStrip x={157} y={151} color={GREEN} rotate={15}/><PepperStrip x={194} y={130} color={RED} rotate={-8}/><PepperStrip x={206} y={158} color={GREEN} rotate={11}/></g>;
  if (variant.includes("shredded-carrots")) return <g stroke={ORANGE} strokeWidth="8" strokeLinecap="round">{[[111,131,45],[131,146,-40],[155,128,35],[178,147,-35],[201,133,45],[146,163,15]].map(([x,y,r],i)=><line key={i} x1={x-18} y1={y} x2={x+18} y2={y} transform={`rotate(${r} ${x} ${y})`}/>)}</g>;
  return <DetailedRoastedVegetables/>;
}

function DetailedSpread({ variant = "" }: { variant?: string }) {
  const fill = variant.includes("pimento") ? "#e9a13f" : variant.includes("hummus") ? "#d5a35a" : variant.includes("egg-salad") ? "#efdb7a" : "#cf8e42";
  return <g><Bowl/><ellipse cx="160" cy="126" rx="68" ry="27" fill={fill} stroke={INK} strokeWidth="4"/><path d="M121 129c19-17 56-18 78-2c-12 17-56 22-78 2Z" fill="rgba(255,255,255,.12)"/><g fill={GREEN}><circle cx="136" cy="124" r="4"/><circle cx="178" cy="138" r="4"/></g></g>;
}

function DetailedCheese({ variant = "" }: { variant?: string }) {
  if (variant.includes("grated")) return <g fill="#f0db93" stroke={INK} strokeWidth="2">{[[117,143],[136,128],[155,145],[176,127],[196,146],[146,163],[181,162]].map(([x,y],i)=><path key={i} d={`M${x-10} ${y+2}l18-8l4 7l-18 8Z`}/>)}</g>;
  return <g fill={variant.includes("swiss")?"#f0dd78":variant.includes("american")?YELLOW:ORANGE} stroke={INK} strokeWidth="5"><path d="M103 119L218 111L222 176L109 185Z"/>{variant.includes("swiss") && <g fill={PLATE} stroke="none"><circle cx="136" cy="137" r="7"/><circle cx="178" cy="151" r="8"/><circle cx="158" cy="169" r="6"/></g>}</g>;
}

function DetailedDressing({ variant = "" }: { variant?: string }) {
  const fill = variant.includes("pesto") ? "#85aa55" : variant.includes("bbq") ? "#c9794f" : variant.includes("mustard") ? YELLOW : variant.includes("balsamic") ? "#754538" : variant.includes("blue") ? "#eee9dc" : CREAM;
  return <g><Ramekin fill={fill}/><path d="M132 132c15-9 35-9 54-1" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="3" strokeLinecap="round"/></g>;
}

function DetailedChips() {
  const chips = [[103,145,-18],[129,124,12],[156,145,-7],[185,125,14],[215,145,-11],[137,165,8],[178,165,-7]] as const;
  return <g><Plate/><g fill={GOLD} stroke={INK} strokeWidth="4">{chips.map(([x,y,r],i)=><path key={i} d={`M${x-19} ${y+10}Q${x} ${y-23} ${x+19} ${y+10}Q${x} ${y+19} ${x-19} ${y+10}Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g><g fill="#d18e2f">{[[116,142],[156,135],[194,151]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2.5"/>)}</g></g>;
}

function DetailedGrain() {
  return <g><Bowl/><ellipse cx="160" cy="126" rx="67" ry="27" fill="#d9b775" stroke={INK} strokeWidth="4"/><g fill="#f1d69d" stroke="#9d7446" strokeWidth="1.5">{[[119,124,-8],[139,137,12],[162,120,5],[184,136,-9],[205,122,8],[134,150,-6],[175,150,10],[201,148,-8]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="8" ry="4" transform={`rotate(${r} ${x} ${y})`}/>)}</g></g>;
}

function DetailedSaladProtein({ variant = "" }: { variant?: string }) {
  if (variant.includes("eggs")) return <DetailedEggPieces/>;
  if (variant.includes("tofu")) return <g>{[[118,136,-8],[151,120,7],[184,139,-6],[143,161,9],[182,162,-9]].map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><rect x={x-16} y={y-13} width="32" height="26" rx="5" fill="#ead6ac" stroke={INK} strokeWidth="4"/><path d={`M${x-9} ${y-5}l18 10`} stroke="#c4a471" strokeWidth="2"/></g>)}</g>;
  return <DetailedProtein variant="chicken"/>;
}

function DetailedBottle({ fill }: { fill: string }) {
  return <g stroke={INK} strokeLinejoin="round"><Shadow cy={205} rx={45} ry={8}/><rect x="138" y="68" width="44" height="34" rx="8" fill="#c88956" strokeWidth="6"/><path d="M126 100H194L205 200H115Z" fill={fill} strokeWidth="7"/><path d="M130 120H190" stroke="rgba(255,255,255,.5)" strokeWidth="5"/><path d="M142 135h36" stroke="rgba(255,255,255,.28)" strokeWidth="3"/></g>;
}

function DetailedTopping({ variant = "" }: { variant?: string }) {
  if (variant.includes("cranberries")) return <g fill="#a53b52" stroke={INK} strokeWidth="3">{[[118,138],[145,121],[177,140],[204,124],[141,161],[185,160]].map(([x,y],i)=><path key={i} d={`M${x-10} ${y}q10-13 20 0q-10 12-20 0Z`}/>)}</g>;
  if (variant.includes("fried-onions") || variant.includes("chow-mein")) return <g fill="none" stroke="#d6a14f" strokeWidth="8" strokeLinecap="round">{[[111,133,24],[138,150,-28],[166,128,17],[194,150,-20],[212,130,28],[155,166,8]].map(([x,y,r],i)=><path key={i} d={`M${x-18} ${y}q18-15 36 0`} transform={`rotate(${r} ${x} ${y})`}/>)}</g>;
  return <g fill={variant.includes("oregano")?GREEN:variant.includes("pepper")?RED:"#d39a49"} stroke={INK} strokeWidth="2.5">{[[118,138],[146,121],[175,139],[202,124],[141,161],[185,160]].map(([x,y],i)=><path key={i} d={`M${x-9} ${y+2}l14-10l7 9l-14 9Z`}/>)}</g>;
}

function DetailedDessert({ variant = "" }: { variant?: string }) {
  if (variant.includes("cookie")) return <g><Plate/><g fill="#764b34" stroke={INK} strokeWidth="6"><circle cx="132" cy="149" r="45"/><circle cx="191" cy="154" r="42"/></g><g fill="#34251f">{[[118,132],[145,158],[181,137],[203,163],[155,122],[211,139]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5"/>)}</g><path d="M108 149c15-15 38-17 55-6" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4"/></g>;
  return <g><Plate/><path d="M105 112H216L225 196H96Z" fill={variant.includes("cocoa")?"#77513b":"#e4b458"} stroke={INK} strokeWidth="7" strokeLinejoin="round"/><path d="M117 126c28-8 58-8 87 0" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="4"/><g fill={variant.includes("cocoa")?"#4a3127":CREAM}>{[[126,145],[164,159],[196,137],[143,180],[190,177]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5"/>)}</g></g>;
}

function DetailedCrackers() {
  return <g><Shadow cy={201} rx={78} ry={9}/><g fill="#eed49b" stroke={INK} strokeWidth="5"><rect x="91" y="105" width="88" height="112" rx="9" transform="rotate(-8 135 160)"/><rect x="156" y="111" width="88" height="112" rx="9" transform="rotate(8 200 167)"/></g><g fill={INK}>{[[114,135],[145,148],[124,179],[185,139],[210,160],[191,192]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3"/>)}</g><g stroke="#c4a86f" strokeWidth="2"><path d="M102 155h58"/><path d="M175 166h54"/></g></g>;
}

function DetailedSalad() {
  return <g><Bowl/><Leaf x={118} y={132} rotate={-18} scale={.72}/><Leaf x={145} y={116} rotate={10} fill={LIGHT_GREEN} scale={.72}/><Leaf x={174} y={133} rotate={-6} scale={.72}/><Leaf x={202} y={117} rotate={16} fill={LIGHT_GREEN} scale={.72}/><Leaf x={140} y={151} rotate={7} scale={.72}/><Leaf x={183} y={151} rotate={-10} fill={LIGHT_GREEN} scale={.72}/><TomatoSlice x={129} y={139} r={10}/><TomatoSlice x={194} y={142} r={10}/><CucumberSlice x={160} y={128} r={12}/></g>;
}

function DetailedPlateMix({ variant = "" }: { variant?: string }) {
  if (variant.includes("drink")) return <g stroke={INK} strokeWidth="6" strokeLinejoin="round"><Shadow cy={207} rx={42} ry={8}/><path d="M120 76H200L190 201Q160 216 130 201Z" fill="#e986a2"/><path d="M126 95H194" stroke="rgba(255,255,255,.52)" strokeWidth="5"/><path d="M177 51L187 97" stroke={INK} strokeWidth="6" strokeLinecap="round"/></g>;
  return <DetailedRoastedVegetables/>;
}

export default function DetailedMenuFoodIllustration({ name }: { name: string }) {
  const spec = menuVisualForName(name);
  let art;
  switch (spec.kind) {
    case "pizza": art = <DetailedPizza variant={spec.variant}/>; break;
    case "protein-plate": art = <DetailedProtein variant={spec.variant}/>; break;
    case "tenders": art = <DetailedProtein variant="chicken tenders"/>; break;
    case "potatoes": art = <DetailedFries/>; break;
    case "roasted-vegetables": art = <DetailedRoastedVegetables/>; break;
    case "green-beans": art = <DetailedIngredient variant="green-beans"/>; break;
    case "pasta": art = <DetailedPasta variant={spec.variant}/>; break;
    case "sauce": art = <DetailedDressing variant={spec.variant}/>; break;
    case "bread": art = <DetailedBread variant={spec.variant}/>; break;
    case "meatballs": art = <DetailedMeatballs/>; break;
    case "carrots": art = <DetailedCarrots harissa={spec.variant === "harissa"}/>; break;
    case "dumplings": art = <DetailedDumplings/>; break;
    case "sandwich": art = <DetailedSandwich variant={spec.variant}/>; break;
    case "burger": art = <DetailedBurger/>; break;
    case "hotdog": art = <DetailedHotDog/>; break;
    case "fries": art = <DetailedFries/>; break;
    case "sliced-protein": art = <DetailedProtein variant={spec.variant}/>; break;
    case "ingredient": art = <DetailedIngredient variant={spec.variant}/>; break;
    case "spread": art = <DetailedSpread variant={spec.variant}/>; break;
    case "cheese": art = <DetailedCheese variant={spec.variant}/>; break;
    case "dressing": art = <DetailedDressing variant={spec.variant}/>; break;
    case "chips": art = <DetailedChips/>; break;
    case "grain": art = <DetailedGrain/>; break;
    case "salad-protein": art = <DetailedSaladProtein variant={spec.variant}/>; break;
    case "oil": art = <DetailedBottle fill="#9bad31"/>; break;
    case "vinegar": art = <DetailedBottle fill={spec.variant === "red-wine" ? "#a43d3f" : "#684436"}/>; break;
    case "topping": art = <DetailedTopping variant={spec.variant}/>; break;
    case "dessert": art = <DetailedDessert variant={spec.variant}/>; break;
    case "soup": art = <DetailedSoup/>; break;
    case "crackers": art = <DetailedCrackers/>; break;
    case "salad": art = <DetailedSalad/>; break;
    default: art = <DetailedPlateMix variant={spec.variant}/>; break;
  }
  return <svg className="ff-food-art ff-food-art-detailed" viewBox="0 0 320 240" aria-hidden="true" focusable="false">{art}</svg>;
}
