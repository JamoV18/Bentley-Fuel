import { menuVisualForName, type MenuVisualSpec } from "@/lib/menuIllustrationCatalog";

const INK = "#10263d";
const PLATE = "#fffdf9";
const RIM = "#d6e2e9";
const RED = "#e94b3c";
const TOMATO = "#d84434";
const GREEN = "#2f963f";
const DARK_GREEN = "#196a32";
const LIGHT_GREEN = "#8bc65b";
const GOLD = "#f3b83f";
const ORANGE = "#ed8b34";
const CREAM = "#fff1c9";
const BROWN = "#a76b43";
const DARK_BROWN = "#65412f";
const PURPLE = "#874b8f";
const PINK = "#e999ae";
const CHEESE = "#f6d45d";

function Defs() {
  return (
    <defs>
      <linearGradient id="ff-plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#f2f6f8" />
      </linearGradient>
      <linearGradient id="ff-bread" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#efbb72" />
        <stop offset="1" stopColor="#c98648" />
      </linearGradient>
      <linearGradient id="ff-soup" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e0a54a" />
        <stop offset="1" stopColor="#c77a2e" />
      </linearGradient>
      <linearGradient id="ff-cheese" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe77b" />
        <stop offset="1" stopColor="#efb93f" />
      </linearGradient>
      <filter id="ff-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#10263d" floodOpacity=".13" />
      </filter>
    </defs>
  );
}

function GroundShadow({ cx = 160, cy = 204, rx = 112, ry = 15 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(16,38,61,.10)" />;
}

function Plate() {
  return (
    <g filter="url(#ff-shadow)">
      <GroundShadow cy={206} rx={118} ry={14} />
      <ellipse cx="160" cy="156" rx="126" ry="59" fill="url(#ff-plate)" stroke={INK} strokeWidth="6" />
      <ellipse cx="160" cy="156" rx="106" ry="44" fill="none" stroke={RIM} strokeWidth="3" />
      <path d="M72 147c18-35 56-48 88-49 37-1 74 14 92 49" fill="none" stroke="rgba(255,255,255,.95)" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

function Bowl() {
  return (
    <g filter="url(#ff-shadow)" stroke={INK} strokeLinejoin="round">
      <GroundShadow cy={211} rx={85} ry={12} />
      <ellipse cx="160" cy="125" rx="84" ry="35" fill="url(#ff-plate)" strokeWidth="6" />
      <path d="M76 125c8 62 40 87 84 87s76-25 84-87c-24 23-54 33-84 33s-60-10-84-33Z" fill="url(#ff-plate)" strokeWidth="6" />
      <path d="M101 166c15 23 36 34 59 34 24 0 45-11 59-34" fill="none" stroke={RIM} strokeWidth="3" strokeLinecap="round" />
      <path d="M101 132c31 20 86 20 118 0" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Leaf({ x, y, rotate = 0, scale = 1, fill = GREEN }: { x: number; y: number; rotate?: number; scale?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M-19 8C-15-18 11-28 25-10C36 6 19 27-3 25C-18 24-26 16-19 8Z" fill={fill} stroke={INK} strokeWidth="3" />
      <path d="M-11 11C0 5 10-2 19-13" fill="none" stroke="rgba(255,255,255,.68)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M-2 8L7 1M4 5L13 3" fill="none" stroke={DARK_GREEN} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function TomatoSlice({ x, y, r = 22 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={TOMATO} stroke={INK} strokeWidth="3.5" />
      <circle cx={x} cy={y} r={r * .3} fill="#f3a36f" />
      {[0, 90, 180, 270].map((a) => {
        const rad = (a * Math.PI) / 180;
        const sx = x + Math.cos(rad) * r * .52;
        const sy = y + Math.sin(rad) * r * .52;
        return <ellipse key={a} cx={sx} cy={sy} rx="4" ry="2.2" fill={CREAM} transform={`rotate(${a} ${sx} ${sy})`} />;
      })}
      <circle cx={x-r*.32} cy={y-r*.35} r={r*.12} fill="rgba(255,255,255,.35)" />
    </g>
  );
}

function CucumberSlice({ x, y, r = 20 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#54a84b" stroke={INK} strokeWidth="3.5" />
      <circle cx={x} cy={y} r={r*.68} fill="#cce69e" stroke={DARK_GREEN} strokeWidth="2" />
      {[0, 90, 180, 270].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <ellipse key={a} cx={x + Math.cos(rad)*r*.3} cy={y + Math.sin(rad)*r*.3} rx="3.2" ry="1.5" fill={CREAM} />;
      })}
      <path d={`M${x-r*.35} ${y-r*.42}q${r*.28}-${r*.18} ${r*.52} 0`} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

function CarrotCoin({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={ORANGE} stroke={INK} strokeWidth="3" />
      <circle cx={x} cy={y} r={r*.45} fill="none" stroke="#f7bc65" strokeWidth="2" strokeDasharray="4 3" />
      <path d={`M${x-r*.38} ${y-r*.25}q${r*.25}-${r*.2} ${r*.5} 0`} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function MushroomSlice({ x, y, rotate = 0, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} stroke={INK} strokeLinejoin="round">
      <path d="M-26 4C-24-17-8-29 10-28C30-27 37-11 32 5Z" fill="#b98461" strokeWidth="3.5" />
      <path d="M-3 3L-8 27H12L8 3Z" fill="#e6c7a2" strokeWidth="3.5" />
      <path d="M-20 0C-7-7 15-8 25 0" fill="none" stroke="#7d573f" strokeWidth="2.5" />
      <path d="M-18-6c10-10 27-10 37-2" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" strokeLinecap="round" />
      <path d="M-12 5L-3 12M15 4L7 13" stroke="#8b6248" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function PepperStrip({ x, y, color = RED, rotate = 0, scale = 1 }: { x: number; y: number; color?: string; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M-23 7C-8-12 9-13 24 3" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
      <path d="M-23 7C-8-12 9-13 24 3" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      <path d="M-17 2C-6-7 4-8 14-1" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.3" strokeLinecap="round" />
    </g>
  );
}

function BroccoliFloret({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK} strokeLinejoin="round">
      <path d="M-3 4L-8 25H9L5 4Z" fill="#73a94a" strokeWidth="3" />
      <g fill="#4d9b3f" strokeWidth="2.5"><circle cx="-12" cy="0" r="10"/><circle cx="0" cy="-7" r="11"/><circle cx="12" cy="0" r="10"/><circle cx="2" cy="5" r="10"/></g>
      <g fill="rgba(255,255,255,.22)"><circle cx="-5" cy="-9" r="3"/><circle cx="8" cy="-3" r="2.5"/></g>
    </g>
  );
}

function BreadSlice({ x=160, y=145, scale=1, dark=false, seeded=false }: { x?: number; y?: number; scale?: number; dark?: boolean; seeded?: boolean }) {
  const holes = [[-39,-26,6,3],[-17,-32,4,2],[8,-29,5,3],[34,-22,4,2],[-31,-8,4,2],[-8,-5,6,3],[19,-10,4,2],[38,1,5,2],[-36,14,5,2],[-12,16,4,2],[13,14,5,2],[32,22,4,2],[-4,31,5,2]] as const;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#ff-shadow)">
      <path d="M-66 47L-70-23Q-68-58-35-66H35Q68-58 70-23L66 47Z" fill={dark ? "#a46d47" : "url(#ff-bread)"} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M-58 37L-61-21Q-58-49-30-55H29Q56-50 60-21L57 38Z" fill={dark ? "#bf8658" : "#edbd80"} stroke="#b36f3f" strokeWidth="2.5" />
      <path d="M-51-31Q-15-49 46-31" fill="none" stroke="rgba(255,255,255,.43)" strokeWidth="4" strokeLinecap="round" />
      <g fill={dark ? DARK_BROWN : "#a66c40"}>{holes.map(([hx,hy,rx,ry],i)=><ellipse key={i} cx={hx} cy={hy} rx={rx} ry={ry}/>)}</g>
      {seeded && <g fill="#f1d69c" stroke="#7d5737" strokeWidth="1.2">{[[-45,43],[-25,46],[-4,44],[19,46],[39,42]].map(([sx,sy],i)=><ellipse key={i} cx={sx} cy={sy} rx="5" ry="2.3" transform={`rotate(${i%2?18:-18} ${sx} ${sy})`}/>)}</g>}
    </g>
  );
}

function DetailedBread({ variant }: { variant?: string }) {
  const dark = /rye|whole|multigrain/.test(variant || "");
  if (variant === "hoagie") {
    return <g filter="url(#ff-shadow)"><GroundShadow/><path d="M59 161Q66 106 113 101H207Q252 107 261 161Q242 184 160 188Q78 184 59 161Z" fill="url(#ff-bread)" stroke={INK} strokeWidth="6"/><path d="M79 150Q111 118 238 141" fill="none" stroke="#f4d394" strokeWidth="6" strokeLinecap="round"/><path d="M86 135q45-27 132-17" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="4" strokeLinecap="round"/></g>;
  }
  if (variant === "pita" || variant === "tortilla") {
    return <g filter="url(#ff-shadow)"><GroundShadow/><ellipse cx="160" cy="151" rx="102" ry="59" fill={variant === "pita" ? "#efd7a6" : "#f0d7a0"} stroke={INK} strokeWidth="6"/><g fill="#d8a664">{[[112,132],[143,119],[180,128],[207,148],[136,162],[177,171],[211,167]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="5" ry="3"/>)}</g>{variant === "tortilla" && <g fill={GREEN}><circle cx="127" cy="145" r="3"/><circle cx="188" cy="141" r="3"/><circle cx="169" cy="166" r="3"/></g>}</g>;
  }
  if (/potato|slider|dinner/.test(variant || "")) {
    return <g filter="url(#ff-shadow)"><GroundShadow/><path d="M87 157Q90 103 160 98Q230 103 233 157Q221 191 160 194Q99 191 87 157Z" fill="url(#ff-bread)" stroke={INK} strokeWidth="6"/><path d="M109 130Q155 108 210 132" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="7" strokeLinecap="round"/><path d="M101 158Q160 172 220 158" fill="none" stroke="#c27e43" strokeWidth="4"/></g>;
  }
  return <g><GroundShadow/><BreadSlice dark={dark} seeded={variant === "multigrain" || variant === "whole-wheat"} /></g>;
}

function DetailedSoup({ variant }: { variant?: string }) {
  const carrots = [[118,122,11],[192,137,10],[208,119,8]] as const;
  const peas = [[143,113],[154,140],[183,113],[219,139],[127,144]] as const;
  const potatoes = [[136,128,-8],[170,121,10],[178,146,-5]] as const;
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="125" rx="69" ry="27" fill="url(#ff-soup)" stroke={INK} strokeWidth="3.5" />
      {carrots.map(([x,y,r],i)=><CarrotCoin key={i} x={x} y={y} r={r}/>) }
      <g fill="#87bc4f" stroke={INK} strokeWidth="2">{peas.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6"/>)}</g>
      <g fill="#f2d38f" stroke={INK} strokeWidth="2.5">{potatoes.map(([x,y,r],i)=><path key={i} d={`M${x-11} ${y+7}l5-17 16 3 5 15-12 9Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g>
      <g fill={DARK_GREEN}><circle cx="132" cy="112" r="3"/><circle cx="174" cy="137" r="3"/><circle cx="205" cy="130" r="3"/><circle cx="151" cy="119" r="2.5"/></g>
      <path d="M111 116c22-11 60-14 92-5" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="4" strokeLinecap="round" />
      {variant === "garden-vegetable" && <BroccoliFloret x={218} y={146} scale={.45}/>} 
    </g>
  );
}

function DetailedVegetables() {
  return (
    <g>
      <Plate />
      <CucumberSlice x={111} y={146} r={21}/>
      <CucumberSlice x={151} y={121} r={19}/>
      <CarrotCoin x={185} y={151} r={17}/>
      <CarrotCoin x={218} y={124} r={14}/>
      <PepperStrip x={140} y={166} color={RED} rotate={9}/>
      <PepperStrip x={198} y={112} color={GREEN} rotate={-8}/>
      <MushroomSlice x={206} y={165} rotate={7} scale={.75}/>
      <MushroomSlice x={176} y={132} rotate={-8} scale={.62}/>
      <BroccoliFloret x={127} y={116} scale={.5}/>
      <g fill={DARK_GREEN}><circle cx="129" cy="135" r="3.2"/><circle cx="173" cy="170" r="3.2"/><circle cx="226" cy="151" r="3.2"/></g>
    </g>
  );
}

function DetailedSandwich({ variant }: { variant?: string }) {
  const rye = /rye/.test(variant || "");
  return (
    <g>
      <Plate />
      <g transform="translate(0 3) rotate(-2 160 150)">
        <BreadSlice x={160} y={118} scale={.72} dark={rye} seeded={rye}/>
        <path d="M103 146C124 133 143 153 162 142C181 132 198 149 217 141" fill="none" stroke={PINK} strokeWidth="18" strokeLinecap="round" />
        <path d="M106 154L148 146L177 155L216 146" fill="none" stroke="url(#ff-cheese)" strokeWidth="13" strokeLinecap="round" />
        {variant?.includes("swiss") && <g fill={PLATE}><circle cx="139" cy="149" r="4"/><circle cx="176" cy="151" r="4"/><circle cx="199" cy="147" r="3.5"/></g>}
        <path d="M112 161C135 149 151 170 172 158C190 148 202 164 216 158" fill="none" stroke="#d5a93f" strokeWidth="6" strokeLinecap="round" />
        <Leaf x={125} y={166} rotate={-12} scale={.62}/><Leaf x={196} y={164} rotate={14} scale={.58}/>
        <BreadSlice x={160} y={183} scale={.72} dark={rye} seeded={rye}/>
      </g>
    </g>
  );
}

function DetailedPizza({ variant }: { variant?: string }) {
  return (
    <g>
      <Plate />
      <path d="M86 180L160 88L236 180Q160 207 86 180Z" fill="#e9b755" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M104 160Q159 131 216 160" fill="none" stroke={TOMATO} strokeWidth="18" strokeLinecap="round" />
      <path d="M111 151Q159 133 210 151" fill="none" stroke="url(#ff-cheese)" strokeWidth="16" strokeLinecap="round" />
      <path d="M122 178Q160 189 201 176" fill="none" stroke="#bd743c" strokeWidth="8" strokeLinecap="round" />
      <path d="M128 171Q161 180 196 169" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="3" strokeLinecap="round" />
      {variant === "pepperoni" && <g>{[[137,140],[168,128],[194,151]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="11" fill={RED} stroke={INK} strokeWidth="3"/><circle cx={x-3} cy={y-3} r="3" fill="#f27d62"/></g>)}</g>}
      {variant === "sausage" && <g fill={BROWN} stroke={INK} strokeWidth="2.5">{[[136,140],[165,129],[195,150],[164,156]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="8"/>)}</g>}
    </g>
  );
}

function DetailedPasta({ variant }: { variant?: string }) {
  const tubes = [[111,132,-18],[141,117,7],[171,132,-8],[202,116,15],[126,151,8],[159,154,-10],[193,151,6],[213,139,-8]] as const;
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="125" rx="69" ry="27" fill="#efc36e" stroke={INK} strokeWidth="3.5" />
      {tubes.map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><rect x={x-15} y={y-6} width="30" height="12" rx="5" fill="#e6ab50" stroke={INK} strokeWidth="2.2"/><line x1={x-8} y1={y-2} x2={x+8} y2={y+2} stroke="#bd7b35" strokeWidth="1.8"/><path d={`M${x-9} ${y-4}q7-3 14 0`} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.6"/></g>)}
      {variant === "dinner" && <path d="M111 136c19-18 72-23 99 1" fill="none" stroke={TOMATO} strokeWidth="10" strokeLinecap="round"/>}
      <g fill={DARK_GREEN}><circle cx="133" cy="126" r="3"/><circle cx="178" cy="145" r="3"/><circle cx="205" cy="126" r="3"/></g>
    </g>
  );
}

function ProteinPlate({ variant }: { variant?: string }) {
  const v = variant || "";
  const fish = /salmon|fish/.test(v);
  const steak = /steak|beef/.test(v);
  const fill = fish ? "#ee9368" : steak ? "#9c5f3d" : "#c77a48";
  return (
    <g>
      <Plate />
      <g transform="rotate(-7 151 151)" filter="url(#ff-shadow)">
        <path d="M91 145Q95 117 121 112H185Q211 119 214 145L203 175Q175 187 123 181Q99 174 91 145Z" fill={fill} stroke={INK} strokeWidth="6" />
        <path d="M104 130c24-11 63-10 91 0" fill="none" stroke="rgba(255,255,255,.33)" strokeWidth="5" strokeLinecap="round" />
        <g stroke={steak ? "#633b29" : "#8b4c31"} strokeWidth="4" strokeLinecap="round"><path d="M111 124l52 47"/><path d="M133 116l53 47"/><path d="M156 114l43 38"/></g>
      </g>
      <Leaf x={220} y={143} rotate={11} scale={.65}/><Leaf x={219} y={166} rotate={-7} scale={.55} fill={LIGHT_GREEN}/>
    </g>
  );
}

function DetailedBurger() {
  return (
    <g>
      <Plate />
      <g filter="url(#ff-shadow)">
        <path d="M91 130Q96 90 160 88Q224 91 229 130Z" fill="url(#ff-bread)" stroke={INK} strokeWidth="6" />
        <g fill="#f4d89b">{[[116,110],[143,101],[171,104],[199,113]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="5" ry="2.2" transform={`rotate(${i%2?18:-18} ${x} ${y})`}/>)}</g>
        <Leaf x={119} y={137} rotate={-8} scale={.55}/><Leaf x={195} y={137} rotate={12} scale={.55}/>
        <TomatoSlice x={137} y={147} r={17}/><TomatoSlice x={185} y={148} r={17}/>
        <path d="M102 151L159 141L218 152L210 165L160 159L111 166Z" fill="url(#ff-cheese)" stroke={INK} strokeWidth="3" />
        <rect x="100" y="159" width="120" height="31" rx="15" fill={BROWN} stroke={INK} strokeWidth="5" />
        <path d="M108 170c25-8 76-8 104 0" fill="none" stroke="#70462f" strokeWidth="3" strokeLinecap="round" />
        <path d="M95 190Q160 208 225 190Q218 215 160 217Q103 215 95 190Z" fill="url(#ff-bread)" stroke={INK} strokeWidth="6" />
      </g>
    </g>
  );
}

function DetailedSalad() {
  return (
    <g>
      <Bowl />
      <ellipse cx="160" cy="126" rx="70" ry="28" fill="#cbe7a2" stroke={INK} strokeWidth="3" />
      <Leaf x={114} y={126} rotate={-20} scale={.62}/><Leaf x={143} y={113} rotate={8} scale={.6} fill={LIGHT_GREEN}/><Leaf x={178} y={120} rotate={-8} scale={.62}/><Leaf x={207} y={139} rotate={16} scale={.58} fill={LIGHT_GREEN}/><Leaf x={145} y={147} rotate={-12} scale={.56}/>
      <TomatoSlice x={121} y={146} r={13}/><CucumberSlice x={182} y={145} r={13}/><CarrotCoin x={208} y={119} r={9}/>
    </g>
  );
}

function DetailedCheese({ variant }: { variant?: string }) {
  const swiss = variant === "swiss";
  return (
    <g filter="url(#ff-shadow)" stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M86 160L139 103L232 132L180 193Z" fill={variant === "cheddar-slice" ? "#f29f33" : "url(#ff-cheese)"} />
      <path d="M98 168L151 111L220 134L171 183Z" fill="rgba(255,255,255,.15)" stroke="none" />
      {swiss && <g fill={PLATE}>{[[138,132,9],[170,147,7],[190,129,6],[149,164,6]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r}/>)}</g>}
    </g>
  );
}

function DetailedIngredient({ variant }: { variant?: string }) {
  if (/tomato/.test(variant || "")) return <g><TomatoSlice x={138} y={146} r={30}/><TomatoSlice x={186} y={130} r={28}/></g>;
  if (/cucumber|pickle/.test(variant || "")) return <g><CucumberSlice x={131} y={146} r={29}/><CucumberSlice x={185} y={129} r={27}/></g>;
  if (/onion/.test(variant || "")) return <g fill="none" stroke={PURPLE}><circle cx="137" cy="146" r="34" strokeWidth="8"/><circle cx="137" cy="146" r="19" strokeWidth="5"/><circle cx="192" cy="129" r="28" strokeWidth="7"/><circle cx="192" cy="129" r="15" strokeWidth="4"/></g>;
  if (/pepper/.test(variant || "")) return <g><PepperStrip x={137} y={145} color={RED} rotate={-8} scale={1.3}/><PepperStrip x={191} y={130} color={GREEN} rotate={9} scale={1.15}/></g>;
  if (/spinach|romaine|iceberg/.test(variant || "")) return <g><Leaf x={129} y={150} rotate={-18} scale={1.1}/><Leaf x={173} y={128} rotate={9} scale={1.05} fill={LIGHT_GREEN}/><Leaf x={202} y={160} rotate={17} scale={.95}/></g>;
  return <DetailedVegetables/>;
}

function DetailedDessert({ variant }: { variant?: string }) {
  if (variant === "cookie") return <g filter="url(#ff-shadow)"><GroundShadow/><circle cx="160" cy="145" r="70" fill="#b97943" stroke={INK} strokeWidth="6"/><g fill={DARK_BROWN}>{[[125,118],[157,108],[193,126],[139,154],[179,162],[203,151],[117,171]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="7"/>)}</g><path d="M115 123c23-24 64-26 91-4" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="5" strokeLinecap="round"/></g>;
  return <g filter="url(#ff-shadow)"><GroundShadow/><path d="M94 113H226L214 194H106Z" fill={variant === "blondie" ? "#d7a35b" : "#6c432f"} stroke={INK} strokeWidth="6"/><path d="M108 128c31-13 75-13 104 0" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="5" strokeLinecap="round"/><g fill={DARK_BROWN}><circle cx="132" cy="146" r="5"/><circle cx="171" cy="160" r="5"/><circle cx="198" cy="139" r="5"/></g></g>;
}

function DetailedSauce({ variant }: { variant?: string }) {
  const fill = /mayo|ranch|caesar|alfredo|sour|blue-cheese/.test(variant || "") ? "#fff2d6" : /mustard/.test(variant || "") ? GOLD : /pesto/.test(variant || "") ? "#62a84a" : TOMATO;
  return <g><Bowl/><ellipse cx="160" cy="125" rx="68" ry="27" fill={fill} stroke={INK} strokeWidth="3.5"/><path d="M118 118c21-8 56-8 80 0" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="4" strokeLinecap="round"/></g>;
}

function DetailedGrain() {
  return <g><Bowl/><ellipse cx="160" cy="125" rx="69" ry="27" fill="#c69b60" stroke={INK} strokeWidth="3.5"/><g fill="#eed39b" stroke="#795339" strokeWidth="1.4">{[[116,120],[133,133],[149,113],[164,128],[180,116],[196,135],[210,121],[143,145],[176,145],[204,147]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="7" ry="4" transform={`rotate(${i%2?18:-18} ${x} ${y})`}/>)}</g></g>;
}

function PremiumVisual({ spec }: { spec: MenuVisualSpec }) {
  switch (spec.kind) {
    case "bread": return <DetailedBread variant={spec.variant}/>;
    case "soup": return <DetailedSoup variant={spec.variant}/>;
    case "roasted-vegetables": return <DetailedVegetables/>;
    case "sandwich": return <DetailedSandwich variant={spec.variant}/>;
    case "pizza": return <DetailedPizza variant={spec.variant}/>;
    case "pasta": return <DetailedPasta variant={spec.variant}/>;
    case "protein-plate":
    case "salad-protein": return <ProteinPlate variant={spec.variant}/>;
    case "burger": return <DetailedBurger/>;
    case "salad": return <DetailedSalad/>;
    case "cheese": return <DetailedCheese variant={spec.variant}/>;
    case "ingredient": return <DetailedIngredient variant={spec.variant}/>;
    case "dessert": return <DetailedDessert variant={spec.variant}/>;
    case "sauce":
    case "spread":
    case "dressing": return <DetailedSauce variant={spec.variant}/>;
    case "grain": return <DetailedGrain/>;
    case "carrots": return <g><Plate/><CarrotCoin x={118} y={145} r={18}/><CarrotCoin x={154} y={124} r={16}/><CarrotCoin x={188} y={148} r={18}/><CarrotCoin x={216} y={127} r={15}/></g>;
    case "tenders": return <g><Plate/><ProteinPlate variant="chicken"/></g>;
    case "potatoes": return <g><Plate/><g fill="#d7a152" stroke={INK} strokeWidth="3.5">{[[117,143,-10],[150,125,8],[184,144,-6],[213,130,10],[152,165,5],[196,166,-6]].map(([x,y,r],i)=><path key={i} d={`M${x-17} ${y+8}l7-23 23 4 7 22-17 13Z`} transform={`rotate(${r} ${x} ${y})`}/>)}</g></g>;
    case "green-beans": return <g><Plate/><g stroke={INK} strokeWidth="9" strokeLinecap="round">{[[112,134,15],[139,150,-8],[165,129,9],[192,149,-11],[214,132,12],[161,165,-4]].map(([x,y,r],i)=><g key={i} transform={`rotate(${r} ${x} ${y})`}><line x1={x-20} y1={y} x2={x+20} y2={y} stroke={i%2?GREEN:LIGHT_GREEN}/><line x1={x-16} y1={y-2} x2={x+13} y2={y-2} stroke="rgba(255,255,255,.28)" strokeWidth="2.5"/></g>)}</g></g>;
    default: return <DetailedVegetables/>;
  }
}

export default function PremiumMenuFoodIllustration({ name }: { name: string }) {
  const spec = menuVisualForName(name);
  return (
    <svg className="ff-food-art ff-food-art-premium" viewBox="0 0 320 240" aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
      <Defs />
      <PremiumVisual spec={spec} />
    </svg>
  );
}
