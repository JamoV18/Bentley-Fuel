import type { AppLanguage } from "@/lib/i18n";

type Entry = { es: string; zh: string };

const COMMON: Record<string, Entry> = {
  "Female": { es: "Femenino", zh: "女性" },
  "Male": { es: "Masculino", zh: "男性" },
  "Other": { es: "Otro", zh: "其他" },
  "Prefer not to say": { es: "Prefiero no decirlo", zh: "不愿透露" },
  "Select (optional)": { es: "Seleccionar (opcional)", zh: "选择（可选）" },
  "Mostly sitting with little intentional physical activity": { es: "Mayormente sentado, con poca actividad física intencional", zh: "大部分时间坐着，很少进行主动身体活动" },
  "Some regular walking or light exercise": { es: "Algo de caminata regular o ejercicio ligero", zh: "有规律地走路或进行轻度运动" },
  "Regular exercise or training plus a generally active daily routine": { es: "Ejercicio o entrenamiento regular y una rutina diaria generalmente activa", zh: "规律运动或训练，并且日常活动量较高" },
  "Frequent hard training and/or a highly physically active daily routine": { es: "Entrenamiento intenso frecuente y/o una rutina diaria de mucha actividad física", zh: "频繁高强度训练和/或日常身体活动量非常高" },
  "A planning level relative to estimated maintenance — not a promised weekly loss rate.": { es: "Un nivel de planificación relativo al mantenimiento estimado, no una tasa semanal de pérdida garantizada.", zh: "相对于估算维持热量的计划强度，并不代表保证的每周减重速度。" },
  "About 10% below estimated maintenance. Gentle and easier to sustain.": { es: "Aproximadamente 10% por debajo del mantenimiento estimado. Suave y más fácil de mantener.", zh: "约低于估算维持热量 10%。较温和，更容易坚持。" },
  "About 15% below estimated maintenance. A steady middle-ground reduction.": { es: "Aproximadamente 15% por debajo del mantenimiento estimado. Una reducción estable e intermedia.", zh: "约低于估算维持热量 15%。属于稳定的中等减幅。" },
  "About 20% below estimated maintenance. Falcon Fuel's stronger balanced option.": { es: "Aproximadamente 20% por debajo del mantenimiento estimado. La opción equilibrada más intensa de Falcon Fuel.", zh: "约低于估算维持热量 20%。这是 Falcon Fuel 较强但仍平衡的选项。" },
  "About 25% below estimated maintenance.": { es: "Aproximadamente 25% por debajo del mantenimiento estimado.", zh: "约低于估算维持热量 25%。" },
  "Aggressive weight loss can be inappropriate for some people. Consider qualified medical or dietitian guidance.": { es: "La pérdida de peso agresiva puede no ser apropiada para algunas personas. Considera orientación médica o de un dietista cualificado.", zh: "激进减重对部分人可能不合适。建议咨询合格的医疗专业人员或注册营养师。" },
  "After you reach it, the plan transitions to maintenance.": { es: "Cuando lo alcances, el plan pasará a mantenimiento.", zh: "达到目标后，计划会转为维持阶段。" },
  "Your chosen intensity creates a lower daily target from this estimate. It is not a promised rate of weight change.": { es: "La intensidad elegida crea un objetivo diario menor a partir de esta estimación. No garantiza una velocidad de cambio de peso.", zh: "你选择的强度会基于该估算生成更低的每日目标，但不代表保证的体重变化速度。" },
  "There isn’t enough supported body information for an individualized calorie target yet. Goal-based recommendations still work.": { es: "Aún no hay suficiente información corporal compatible para calcular un objetivo calórico individual. Las recomendaciones basadas en objetivos siguen funcionando.", zh: "目前支持的身体信息不足以生成个性化卡路里目标，但基于目标的推荐仍然可用。" },
  "Extreme is not recommended. Qualified medical or dietitian guidance is recommended for aggressive weight-loss planning.": { es: "La opción extrema no se recomienda. Para una planificación agresiva de pérdida de peso se recomienda orientación médica o de un dietista cualificado.", zh: "不建议选择极高强度。进行激进减重计划时，建议获得合格医疗专业人员或注册营养师的指导。" },
  "Falcon Fuel turns this profile into meals and adapts as you track.": { es: "Falcon Fuel convierte este perfil en comidas y se adapta a medida que registras.", zh: "Falcon Fuel 会把这份资料转化为餐食建议，并随着你的记录持续调整。" },
  "Primary": { es: "Principal", zh: "主要" },
  "#2": { es: "#2", zh: "#2" },
  "#3": { es: "#3", zh: "#3" },
  "Clear activity level": { es: "Borrar nivel de actividad", zh: "清除活动水平" },
  "Allergen information is based on the available dining data and is not a substitute for confirming with dining staff.": { es: "La información sobre alérgenos se basa en los datos disponibles del comedor y no sustituye la confirmación con el personal.", zh: "过敏原信息基于现有餐饮数据，不能替代向餐饮工作人员确认。" },
  "None": { es: "Ninguno", zh: "无" },
  "Breakfast": { es: "Desayuno", zh: "早餐" },
  "Brunch": { es: "Brunch", zh: "早午餐" },
  "Lunch": { es: "Almuerzo", zh: "午餐" },
  "Dinner": { es: "Cena", zh: "晚餐" },
  "All day": { es: "Todo el día", zh: "全天" },
  "Late night": { es: "Noche", zh: "深夜" }
};

const MONTHS: Record<string, { es: string; zh: string }> = {
  Jan: { es: "ene", zh: "1月" }, January: { es: "enero", zh: "1月" },
  Feb: { es: "feb", zh: "2月" }, February: { es: "febrero", zh: "2月" },
  Mar: { es: "mar", zh: "3月" }, March: { es: "marzo", zh: "3月" },
  Apr: { es: "abr", zh: "4月" }, April: { es: "abril", zh: "4月" },
  May: { es: "may", zh: "5月" },
  Jun: { es: "jun", zh: "6月" }, June: { es: "junio", zh: "6月" },
  Jul: { es: "jul", zh: "7月" }, July: { es: "julio", zh: "7月" },
  Aug: { es: "ago", zh: "8月" }, August: { es: "agosto", zh: "8月" },
  Sep: { es: "sept", zh: "9月" }, September: { es: "septiembre", zh: "9月" },
  Oct: { es: "oct", zh: "10月" }, October: { es: "octubre", zh: "10月" },
  Nov: { es: "nov", zh: "11月" }, November: { es: "noviembre", zh: "11月" },
  Dec: { es: "dic", zh: "12月" }, December: { es: "diciembre", zh: "12月" }
};

const WEEKDAYS: Record<string, Entry> = {
  Mon: { es: "lun", zh: "周一" }, Monday: { es: "lunes", zh: "星期一" },
  Tue: { es: "mar", zh: "周二" }, Tuesday: { es: "martes", zh: "星期二" },
  Wed: { es: "mié", zh: "周三" }, Wednesday: { es: "miércoles", zh: "星期三" },
  Thu: { es: "jue", zh: "周四" }, Thursday: { es: "jueves", zh: "星期四" },
  Fri: { es: "vie", zh: "周五" }, Friday: { es: "viernes", zh: "星期五" },
  Sat: { es: "sáb", zh: "周六" }, Saturday: { es: "sábado", zh: "星期六" },
  Sun: { es: "dom", zh: "周日" }, Sunday: { es: "domingo", zh: "星期日" }
};

function translateDate(source: string, language: Exclude<AppLanguage, "en">): string | undefined {
  if (WEEKDAYS[source]) return WEEKDAYS[source][language];

  let match = source.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
  if (match) {
    const weekday = WEEKDAYS[match[1]][language];
    const month = MONTHS[match[2]][language];
    return language === "es" ? `${weekday}, ${match[3]} ${month}` : `${month}${match[3]}日 ${weekday}`;
  }

  match = source.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
  if (match) {
    const weekday = WEEKDAYS[match[1]][language];
    const month = MONTHS[match[2]][language];
    return language === "es" ? `${weekday}, ${match[3]} ${month}` : `${month}${match[3]}日 ${weekday}`;
  }

  match = source.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
  if (match) {
    const month = MONTHS[match[1]][language];
    return language === "es" ? `${match[2]} ${month}` : `${month}${match[2]}日`;
  }

  match = source.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (match) {
    const month = MONTHS[match[1]][language];
    let hour = Number(match[3]);
    if (match[5] === "PM" && hour !== 12) hour += 12;
    if (match[5] === "AM" && hour === 12) hour = 0;
    const time = `${hour.toString().padStart(2, "0")}:${match[4]}`;
    return language === "es" ? `${match[2]} ${month}, ${time}` : `${month}${match[2]}日 ${time}`;
  }

  return undefined;
}

export function translateRuntimeText(source: string, language: AppLanguage): string {
  if (language === "en") return source;
  return COMMON[source]?.[language] ?? translateDate(source, language) ?? source;
}
