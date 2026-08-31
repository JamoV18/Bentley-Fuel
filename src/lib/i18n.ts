export type AppLanguage = "en" | "es" | "zh";

export const LANGUAGE_STORAGE_KEY = "bentley-fuel-language";

export const LANGUAGE_OPTIONS: Array<{ code: AppLanguage; label: string; greeting: string; locale: string }> = [
  { code: "en", label: "English", greeting: "Hello", locale: "en-US" },
  { code: "es", label: "Español", greeting: "Hola", locale: "es-US" },
  { code: "zh", label: "中文", greeting: "你好", locale: "zh-CN" },
];

type NonEnglish = Exclude<AppLanguage, "en">;

type Entry = { es: string; zh: string };

const PHRASES: Record<string, Entry> = {
  "Language": { es: "Idioma", zh: "语言" },
  "Choose your language": { es: "Elige tu idioma", zh: "选择你的语言" },
  "You can change this during onboarding. Bentley dining and location names stay unchanged.": { es: "Puedes cambiarlo durante la configuración. Los nombres de los comedores y ubicaciones de Bentley no cambian.", zh: "你可以在设置过程中更改语言。Bentley 的餐饮点和地点名称保持不变。" },
  "Today": { es: "Hoy", zh: "今天" },
  "Eat": { es: "Comer", zh: "用餐" },
  "History": { es: "Historial", zh: "历史" },
  "Plan": { es: "Plan", zh: "计划" },
  "All dining": { es: "Todos los comedores", zh: "所有餐饮点" },
  "All locations": { es: "Todas las ubicaciones", zh: "所有地点" },
  "Build my nutrition plan": { es: "Crear mi plan de nutrición", zh: "创建我的营养计划" },
  "Open Falcon Fuel": { es: "Abrir Falcon Fuel", zh: "打开 Falcon Fuel" },
  "View saved profile →": { es: "Ver perfil guardado →", zh: "查看已保存的资料 →" },
  "Eat with purpose.": { es: "Come con propósito.", zh: "有目标地吃。" },
  "Fuel your best.": { es: "Alimenta tu mejor versión.", zh: "为最佳状态补充能量。" },
  "Personalized campus nutrition that turns your goals into simple meal decisions — then learns from what you actually eat.": { es: "Nutrición personalizada en el campus que convierte tus objetivos en decisiones simples sobre qué comer y aprende de lo que realmente consumes.", zh: "个性化校园营养，把你的目标变成简单的用餐选择，并根据你真正吃下的食物持续学习。" },
  "Current menus and nutrition are demo data. Profile data stays on this device.": { es: "Los menús y datos nutricionales actuales son de demostración. Los datos del perfil permanecen en este dispositivo.", zh: "当前菜单和营养信息为演示数据。个人资料数据仅保存在此设备上。" },
  "meal choices": { es: "opciones de comida", zh: "餐食选择" },
  "daily macros": { es: "macros diarios", zh: "每日宏量营养" },
  "recommendations": { es: "recomendaciones", zh: "推荐" },
  "Live": { es: "En vivo", zh: "实时" },
  "Smart": { es: "Inteligente", zh: "智能" },
  "What sounds good?": { es: "¿Qué te apetece?", zh: "想吃什么？" },
  "Pick where you’re eating. Falcon Fuel handles the nutritional reasoning and ranks complete meals for you.": { es: "Elige dónde vas a comer. Falcon Fuel se encarga del análisis nutricional y ordena comidas completas para ti.", zh: "先选择你要去的餐饮点。Falcon Fuel 会完成营养分析并为你排序完整餐食。" },
  "Dining location": { es: "Ubicación de comedor", zh: "餐饮地点" },
  "dining concept": { es: "concepto gastronómico", zh: "餐饮档口" },
  "dining concepts": { es: "conceptos gastronómicos", zh: "餐饮档口" },
  "Demo menu data · not current official Bentley Dining information.": { es: "Datos de menú de demostración · no es información oficial y actual de Bentley Dining.", zh: "演示菜单数据 · 并非 Bentley Dining 当前官方信息。" },
  "Choose the fastest path: let Falcon Fuel rank a complete meal for you, or browse exactly what is available here.": { es: "Elige la ruta más rápida: deja que Falcon Fuel ordene una comida completa para ti o explora exactamente lo que hay disponible aquí.", zh: "选择最快的方式：让 Falcon Fuel 为你排序完整餐食，或直接浏览这里现有的食物。" },
  "Personalized meal": { es: "Comida personalizada", zh: "个性化餐食" },
  "What should I eat here?": { es: "¿Qué debería comer aquí?", zh: "我在这里该吃什么？" },
  "Get my recommendation": { es: "Obtener mi recomendación", zh: "获取我的推荐" },
  "Build my own meal": { es: "Armar mi propia comida", zh: "自己搭配餐食" },
  "Available here": { es: "Disponible aquí", zh: "这里有" },
  "Browse by station": { es: "Explorar por estación", zh: "按档口浏览" },
  "Open a food for details or add it directly to a meal.": { es: "Abre un alimento para ver detalles o agrégalo directamente a una comida.", zh: "打开食物查看详情，或直接加入餐食。" },
  "Dining concept": { es: "Concepto gastronómico", zh: "餐饮档口" },
  "Menu details not added yet.": { es: "Aún no se agregaron los detalles del menú.", zh: "菜单详情尚未添加。" },
  "Custom": { es: "Personalizable", zh: "可自定义" },
  "Customizable": { es: "Personalizable", zh: "可自定义" },
  "Add to meal": { es: "Agregar a la comida", zh: "加入餐食" },
  "Add to my meal": { es: "Agregar a mi comida", zh: "加入我的餐食" },
  "Details →": { es: "Detalles →", zh: "详情 →" },
  "Recommended for you": { es: "Recomendado para ti", zh: "为你推荐" },
  "Build a complete meal": { es: "Arma una comida completa", zh: "搭配一份完整餐食" },
  "Building a recommendation from your profile and this location…": { es: "Creando una recomendación con tu perfil y esta ubicación…", zh: "正在根据你的资料和这个地点生成推荐…" },
  "Balanced around your goals, nutrition remaining today, dietary needs, and recent variety.": { es: "Equilibrado según tus objetivos, lo que te queda hoy, tus necesidades dietéticas y la variedad reciente.", zh: "综合你的目标、今天剩余营养、饮食需求和近期饮食多样性进行平衡。" },
  "Complete your profile to turn this example into a personalized recommendation.": { es: "Completa tu perfil para convertir este ejemplo en una recomendación personalizada.", zh: "完成个人资料后，可将此示例变成个性化推荐。" },
  "Set up profile": { es: "Configurar perfil", zh: "设置资料" },
  "No eligible complete meal is available for this eating window. You can still build your own.": { es: "No hay una comida completa elegible disponible en este horario. Aun así, puedes armar la tuya.", zh: "当前用餐时段没有符合条件的完整餐食。你仍然可以自己搭配。" },
  "Ranked for this location": { es: "Ordenado para esta ubicación", zh: "针对该地点排序" },
  "Top matches": { es: "Mejores opciones", zh: "最佳匹配" },
  "Previous recommendation": { es: "Recomendación anterior", zh: "上一个推荐" },
  "Next recommendation": { es: "Siguiente recomendación", zh: "下一个推荐" },
  "Best match": { es: "Mejor opción", zh: "最佳匹配" },
  "Viewing": { es: "Viendo", zh: "正在查看" },
  "Personalized": { es: "Personalizado", zh: "个性化" },
  "Recommended complete meal": { es: "Comida completa recomendada", zh: "推荐完整餐食" },
  "Example complete meal": { es: "Ejemplo de comida completa", zh: "完整餐食示例" },
  "Complete meal": { es: "Comida completa", zh: "完整餐食" },
  "Station unavailable": { es: "Estación no disponible", zh: "档口不可用" },
  "Complete total unavailable.": { es: "Total completo no disponible.", zh: "完整营养总计不可用。" },
  "Why this meal?": { es: "¿Por qué esta comida?", zh: "为什么推荐这份餐？" },
  "Choose this meal": { es: "Elegir esta comida", zh: "选择这份餐" },
  "Use this meal": { es: "Usar esta comida", zh: "使用这份餐" },
  "Meal selected": { es: "Comida seleccionada", zh: "已选择餐食" },
  "Meal selection needs attention": { es: "La selección necesita atención", zh: "餐食选择需要处理" },
  "Your choice is saved so Falcon Fuel can learn preference and variety patterns.": { es: "Tu elección se guardó para que Falcon Fuel pueda aprender tus preferencias y patrones de variedad.", zh: "你的选择已保存，Falcon Fuel 会据此学习偏好和饮食多样性。" },
  "Customize": { es: "Personalizar", zh: "自定义" },
  "Done customizing": { es: "Terminar personalización", zh: "完成自定义" },
  "Finished eating? Add a quick check-in": { es: "¿Terminaste de comer? Añade un registro rápido", zh: "吃完了吗？快速记录一下" },
  "How much did you finish?": { es: "¿Cuánto terminaste?", zh: "你吃了多少？" },
  "Not now": { es: "Ahora no", zh: "暂不" },
  "Fine tune": { es: "Ajustar", zh: "微调" },
  "Customize this recommendation": { es: "Personaliza esta recomendación", zh: "自定义这份推荐" },
  "Remove what you don’t want, change servings or ingredients, or add another eligible food.": { es: "Quita lo que no quieras, cambia porciones o ingredientes, o agrega otro alimento elegible.", zh: "移除不想要的食物、调整份量或配料，或添加其他符合条件的食物。" },
  "Remove": { es: "Quitar", zh: "移除" },
  "Smart replacements": { es: "Reemplazos inteligentes", zh: "智能替换" },
  "No strong automatic replacement is available right now. Choose anything you want from the stations below.": { es: "No hay un reemplazo automático sólido disponible ahora. Elige lo que quieras de las estaciones de abajo.", zh: "当前没有合适的自动替换选项。你可以从下方档口自由选择。" },
  "I’ll choose something myself": { es: "Elegiré algo yo", zh: "我自己选择" },
  "Allergen information for selected foods": { es: "Información de alérgenos de los alimentos seleccionados", zh: "所选食物的过敏原信息" },
  "Contains:": { es: "Contiene:", zh: "含有：" },
  "May contain:": { es: "Puede contener:", zh: "可能含有：" },
  "Build my meal": { es: "Armar mi comida", zh: "搭配我的餐食" },
  "Already know what you’re eating? Add it here. Falcon Fuel totals the meal while you build it.": { es: "¿Ya sabes qué vas a comer? Agrégalo aquí. Falcon Fuel suma la comida mientras la armas.", zh: "已经知道要吃什么？在这里添加。Falcon Fuel 会在你搭配时自动汇总营养。" },
  "Get a recommendation instead": { es: "Obtener una recomendación", zh: "改用推荐" },
  "Current meal": { es: "Comida actual", zh: "当前餐食" },
  "Your meal": { es: "Tu comida", zh: "你的餐食" },
  "Nothing added yet. Choose foods from the stations on the right.": { es: "Aún no agregaste nada. Elige alimentos de las estaciones de la derecha.", zh: "尚未添加食物。请从右侧档口选择。" },
  "Meal needs attention.": { es: "La comida necesita atención.", zh: "餐食需要处理。" },
  "Save this meal": { es: "Guardar esta comida", zh: "保存这份餐" },
  "Meal saved": { es: "Comida guardada", zh: "餐食已保存" },
  "✓ Meal saved": { es: "✓ Comida guardada", zh: "✓ 餐食已保存" },
  "Finished:": { es: "Terminado:", zh: "已吃：" },
  "Change": { es: "Cambiar", zh: "更改" },
  "Build it yourself": { es: "Ármala tú", zh: "自己搭配" },
  "Add food by station": { es: "Agregar alimentos por estación", zh: "按档口添加食物" },
  "Already know what you are getting? Add it here and Falcon Fuel will total the meal for you.": { es: "¿Ya sabes qué vas a pedir? Agrégalo aquí y Falcon Fuel calculará el total de la comida.", zh: "已经知道要拿什么？在这里添加，Falcon Fuel 会为你汇总整餐营养。" },
  "No menu items are loaded for this eating window yet.": { es: "Aún no hay artículos del menú cargados para este horario.", zh: "当前用餐时段尚未加载菜单项目。" },
  "Configure after adding": { es: "Configurar después de agregar", zh: "添加后配置" },
  "Nutrition shown after adding": { es: "La nutrición se muestra después de agregar", zh: "添加后显示营养信息" },
  "Add another": { es: "Agregar otro", zh: "再加一个" },
  "Add": { es: "Agregar", zh: "添加" },
  "Nutrition": { es: "Nutrición", zh: "营养" },
  "Calories": { es: "Calorías", zh: "卡路里" },
  "Protein": { es: "Proteína", zh: "蛋白质" },
  "Carbs": { es: "Carbohidratos", zh: "碳水" },
  "Fat": { es: "Grasa", zh: "脂肪" },
  "Fiber": { es: "Fibra", zh: "膳食纤维" },
  "Sugar": { es: "Azúcar", zh: "糖" },
  "Added sugar": { es: "Azúcar añadida", zh: "添加糖" },
  "Saturated fat": { es: "Grasa saturada", zh: "饱和脂肪" },
  "Trans fat": { es: "Grasa trans", zh: "反式脂肪" },
  "Cholesterol": { es: "Colesterol", zh: "胆固醇" },
  "Sodium": { es: "Sodio", zh: "钠" },
  "Potassium": { es: "Potasio", zh: "钾" },
  "Calcium": { es: "Calcio", zh: "钙" },
  "Iron": { es: "Hierro", zh: "铁" },
  "Vitamin D": { es: "Vitamina D", zh: "维生素 D" },
  "Per serving": { es: "Por porción", zh: "每份" },
  "Serving:": { es: "Porción:", zh: "份量：" },
  "More nutrition": { es: "Más nutrición", zh: "更多营养信息" },
  "Build it your way": { es: "Hazlo a tu manera", zh: "按你的方式搭配" },
  "Nutrition changes with your choices.": { es: "La nutrición cambia con tus elecciones.", zh: "营养会随你的选择变化。" },
  "Available options in the current dining dataset:": { es: "Opciones disponibles en los datos actuales de comedor:", zh: "当前餐饮数据中的可选项：" },
  "Transparency": { es: "Transparencia", zh: "透明信息" },
  "What’s in it": { es: "Qué contiene", zh: "里面有什么" },
  "Components represented in the current dining data, not a complete ingredient statement.": { es: "Componentes representados en los datos actuales, no una lista completa de ingredientes.", zh: "这里显示的是当前餐饮数据中的组成项，并非完整配料表。" },
  "Dietary notes": { es: "Notas dietéticas", zh: "饮食说明" },
  "At a glance": { es: "Resumen", zh: "一览" },
  "Allergen information": { es: "Información de alérgenos", zh: "过敏原信息" },
  "Possible allergens among available choices:": { es: "Posibles alérgenos entre las opciones disponibles:", zh: "可选项中可能包含的过敏原：" },
  "Loading today…": { es: "Cargando hoy…", zh: "正在加载今天…" },
  "Build your nutrition plan.": { es: "Crea tu plan de nutrición.", zh: "创建你的营养计划。" },
  "A few choices unlock personalized dining recommendations and daily tracking.": { es: "Unas pocas elecciones activan recomendaciones personalizadas y seguimiento diario.", zh: "完成几个选择即可开启个性化餐食推荐和每日追踪。" },
  "Start onboarding": { es: "Comenzar configuración", zh: "开始设置" },
  "Your plan": { es: "Tu plan", zh: "你的计划" },
  "Previous": { es: "Anterior", zh: "前一天" },
  "Selected": { es: "Seleccionado", zh: "已选择" },
  "Next": { es: "Siguiente", zh: "下一天" },
  "Demo menu data · tracking and personalization are functional; menu information is not current official Bentley Dining data.": { es: "Datos de menú de demostración · el seguimiento y la personalización funcionan; la información del menú no es oficial ni actual de Bentley Dining.", zh: "演示菜单数据 · 追踪和个性化功能可用；菜单信息并非 Bentley Dining 当前官方数据。" },
  "eaten": { es: "consumidas", zh: "已摄入" },
  "remaining": { es: "restantes", zh: "剩余" },
  "recorded": { es: "registradas", zh: "已记录" },
  "burned": { es: "quemadas", zh: "消耗" },
  "tracked": { es: "registrado", zh: "已追踪" },
  "Macros at a glance": { es: "Macros de un vistazo", zh: "宏量营养一览" },
  "Edit goals": { es: "Editar objetivos", zh: "编辑目标" },
  "A clean snapshot of how today’s intake is tracking against your plan.": { es: "Una vista clara de cómo va tu consumo de hoy frente a tu plan.", zh: "清晰查看今天的摄入量与计划目标相比进展如何。" },
  "Time to eat?": { es: "¿Hora de comer?", zh: "该吃饭了吗？" },
  "Get a personalized recommendation or build a meal.": { es: "Obtén una recomendación personalizada o arma una comida.", zh: "获取个性化推荐或自己搭配餐食。" },
  "Did you finish?": { es: "¿Terminaste?", zh: "吃完了吗？" },
  "Quick meal check-in": { es: "Registro rápido de comida", zh: "快速用餐记录" },
  "Waiting": { es: "Pendiente", zh: "待记录" },
  "Loading history…": { es: "Cargando historial…", zh: "正在加载历史…" },
  "No profile yet.": { es: "Aún no hay perfil.", zh: "还没有个人资料。" },
  "Patterns, not judgment. See what you recorded and learn what works.": { es: "Patrones, no juicio. Mira lo que registraste y aprende qué te funciona.", zh: "关注规律，而不是评判。查看你的记录并了解什么最适合你。" },
  "Yesterday": { es: "Ayer", zh: "昨天" },
  "Week": { es: "Semana", zh: "周" },
  "Month": { es: "Mes", zh: "月" },
  "This week": { es: "Esta semana", zh: "本周" },
  "This month": { es: "Este mes", zh: "本月" },
  "Getting started": { es: "Empezando", zh: "刚开始" },
  "Mostly confirmed": { es: "Mayormente confirmado", zh: "大多已确认" },
  "Well confirmed": { es: "Bien confirmado", zh: "确认充分" },
  "Recorded nutrition": { es: "Nutrición registrada", zh: "已记录营养" },
  "days confirmed": { es: "días confirmados", zh: "天已确认" },
  "Falcon Fuel only summarizes meals you saved. Missing logs are never treated as skipped food or a failed day.": { es: "Falcon Fuel solo resume las comidas que guardaste. Los registros faltantes nunca se consideran comida omitida ni un día fallido.", zh: "Falcon Fuel 只汇总你保存的餐食。缺失记录不会被视为漏吃或失败的一天。" },
  "Recorded calories": { es: "Calorías registradas", zh: "已记录卡路里" },
  "Avg calories": { es: "Calorías promedio", zh: "平均卡路里" },
  "Recorded protein": { es: "Proteína registrada", zh: "已记录蛋白质" },
  "Avg protein": { es: "Proteína promedio", zh: "平均蛋白质" },
  "Recorded carbs": { es: "Carbohidratos registrados", zh: "已记录碳水" },
  "Avg carbs": { es: "Carbohidratos promedio", zh: "平均碳水" },
  "Recorded fat": { es: "Grasa registrada", zh: "已记录脂肪" },
  "Avg fat": { es: "Grasa promedio", zh: "平均脂肪" },
  "Consistency": { es: "Consistencia", zh: "一致性" },
  "Daily view": { es: "Vista diaria", zh: "每日视图" },
  "Recorded only": { es: "Solo registrado", zh: "仅已记录" },
  "Timeline": { es: "Cronología", zh: "时间线" },
  "Recent meals": { es: "Comidas recientes", zh: "最近餐食" },
  "No recent meals recorded.": { es: "No hay comidas recientes registradas.", zh: "没有最近的餐食记录。" },
  "Loading your profile…": { es: "Cargando tu perfil…", zh: "正在加载你的资料…" },
  "Build your plan.": { es: "Crea tu plan.", zh: "创建你的计划。" },
  "Complete onboarding to create a personalized nutrition profile.": { es: "Completa la configuración para crear un perfil nutricional personalizado.", zh: "完成设置即可创建个性化营养资料。" },
  "The quiet engine underneath Today and every meal recommendation.": { es: "El motor silencioso detrás de Hoy y de cada recomendación de comida.", zh: "支撑“今天”和每一份餐食推荐的核心引擎。" },
  "Nutrition identity": { es: "Identidad nutricional", zh: "营养定位" },
  "Primary": { es: "Principal", zh: "主要" },
  "Weight-loss intensity": { es: "Intensidad de pérdida de peso", zh: "减重强度" },
  "Units": { es: "Unidades", zh: "单位" },
  "Also helping with": { es: "También ayudando con", zh: "同时帮助" },
  "What you told us": { es: "Lo que nos dijiste", zh: "你告诉我们的内容" },
  "Dietary preferences": { es: "Preferencias dietéticas", zh: "饮食偏好" },
  "Allergens to avoid": { es: "Alérgenos a evitar", zh: "需避免的过敏原" },
  "None selected": { es: "Ninguno seleccionado", zh: "未选择" },
  "Plan trajectory": { es: "Trayectoria del plan", zh: "计划进展" },
  "Maintenance": { es: "Mantenimiento", zh: "维持" },
  "Progress": { es: "Progreso", zh: "进展" },
  "Progress chart": { es: "Gráfico de progreso", zh: "进展图表" },
  "Log a weight below to start your progress line.": { es: "Registra un peso abajo para iniciar tu línea de progreso.", zh: "在下方记录体重即可开始生成进展曲线。" },
  "Weight trend": { es: "Tendencia de peso", zh: "体重趋势" },
  "Only weights you record are used.": { es: "Solo se usan los pesos que registras.", zh: "只使用你记录的体重。" },
  "Current": { es: "Actual", zh: "当前" },
  "Target": { es: "Objetivo", zh: "目标" },
  "Dashed line = target": { es: "Línea punteada = objetivo", zh: "虚线 = 目标" },
  "Update progress": { es: "Actualizar progreso", zh: "更新进展" },
  "Optional": { es: "Opcional", zh: "可选" },
  "Weight in kg": { es: "Peso en kg", zh: "体重（kg）" },
  "Weight in lb": { es: "Peso en lb", zh: "体重（lb）" },
  "Save": { es: "Guardar", zh: "保存" },
  "Enter a valid weight.": { es: "Ingresa un peso válido.", zh: "请输入有效体重。" },
  "That weight is outside the supported range.": { es: "Ese peso está fuera del rango admitido.", zh: "该体重超出支持范围。" },
  "Progress updated.": { es: "Progreso actualizado.", zh: "进展已更新。" },
  "Personalization": { es: "Personalización", zh: "个性化" },
  "What are your goals?": { es: "¿Cuáles son tus objetivos?", zh: "你的目标是什么？" },
  "Choose up to 3. Your first selection is primary; the rest add context to your recommendations.": { es: "Elige hasta 3. Tu primera selección es la principal; las demás añaden contexto a tus recomendaciones.", zh: "最多选择 3 个。第一个为主要目标，其余目标为推荐提供额外背景。" },
  "Lose weight": { es: "Perder peso", zh: "减重" },
  "Maintain weight": { es: "Mantener peso", zh: "维持体重" },
  "Gain weight": { es: "Ganar peso", zh: "增重" },
  "Build muscle": { es: "Ganar músculo", zh: "增肌" },
  "Eat healthier": { es: "Comer más saludable", zh: "吃得更健康" },
  "Athletic performance": { es: "Rendimiento deportivo", zh: "运动表现" },
  "Choose your intensity": { es: "Elige tu intensidad", zh: "选择强度" },
  "Light": { es: "Ligera", zh: "轻度" },
  "Moderate": { es: "Moderada", zh: "中等" },
  "Optimal": { es: "Óptima", zh: "最佳" },
  "Extreme · not recommended": { es: "Extrema · no recomendada", zh: "极高 · 不推荐" },
  "What else should Falcon Fuel help with?": { es: "¿Con qué más debería ayudarte Falcon Fuel?", zh: "Falcon Fuel 还应该帮助你什么？" },
  "Gain more control over my eating habits": { es: "Tener más control sobre mis hábitos alimenticios", zh: "更好地掌控饮食习惯" },
  "Be more consistent": { es: "Ser más constante", zh: "保持更稳定" },
  "Make healthier choices": { es: "Tomar decisiones más saludables", zh: "做出更健康的选择" },
  "Eat enough protein": { es: "Consumir suficiente proteína", zh: "摄入足够蛋白质" },
  "Fuel training better": { es: "Alimentar mejor el entrenamiento", zh: "更好地为训练补充能量" },
  "Try more variety": { es: "Probar más variedad", zh: "增加饮食多样性" },
  "Tell us more": { es: "Cuéntanos más", zh: "告诉我们更多" },
  "Preferences": { es: "Preferencias", zh: "偏好" },
  "What works for you?": { es: "¿Qué funciona para ti?", zh: "什么适合你？" },
  "Everything here is optional.": { es: "Todo aquí es opcional.", zh: "这里的所有内容都是可选的。" },
  "Your baseline": { es: "Tu punto de partida", zh: "你的基础信息" },
  "A little about you": { es: "Un poco sobre ti", zh: "关于你的一些信息" },
  "Optional. Complete the supported fields to unlock individualized calorie and macro targets.": { es: "Opcional. Completa los campos compatibles para obtener objetivos personalizados de calorías y macros.", zh: "可选。填写支持的字段后可解锁个性化卡路里和宏量营养目标。" },
  "Age": { es: "Edad", zh: "年龄" },
  "Sex": { es: "Sexo", zh: "性别" },
  "Height (feet)": { es: "Altura (pies)", zh: "身高（英尺）" },
  "Height (inches)": { es: "Altura (pulgadas)", zh: "身高（英寸）" },
  "Weight (pounds)": { es: "Peso (libras)", zh: "体重（磅）" },
  "Height (cm)": { es: "Altura (cm)", zh: "身高（cm）" },
  "Weight (kg)": { es: "Peso (kg)", zh: "体重（kg）" },
  "Target weight": { es: "Peso objetivo", zh: "目标体重" },
  "Activity level": { es: "Nivel de actividad", zh: "活动水平" },
  "Inactive": { es: "Inactivo", zh: "不活跃" },
  "Low active": { es: "Actividad baja", zh: "低活动量" },
  "Active": { es: "Activo", zh: "活跃" },
  "Very active": { es: "Muy activo", zh: "非常活跃" },
  "Clear activity level": { es: "Borrar nivel de actividad", zh: "清除活动水平" },
  "Ready to personalize": { es: "Listo para personalizar", zh: "准备个性化" },
  "Your plan at a glance": { es: "Tu plan de un vistazo", zh: "计划一览" },
  "Falcon Fuel handles the nutrition math underneath the surface.": { es: "Falcon Fuel se encarga de los cálculos nutricionales por debajo.", zh: "Falcon Fuel 会在后台完成营养计算。" },
  "Selected goals": { es: "Objetivos seleccionados", zh: "已选目标" },
  "Estimated maintenance": { es: "Mantenimiento estimado", zh: "估算维持热量" },
  "You don’t need to calculate calories, protein, carbs, or fat yourself.": { es: "No necesitas calcular calorías, proteína, carbohidratos o grasa por tu cuenta.", zh: "你不需要自己计算卡路里、蛋白质、碳水或脂肪。" },
  "Back": { es: "Atrás", zh: "返回" },
  "Continue": { es: "Continuar", zh: "继续" },
  "Save profile": { es: "Guardar perfil", zh: "保存资料" },
  "About one minute": { es: "Aproximadamente un minuto", zh: "大约一分钟" },
  "Choose at least one goal.": { es: "Elige al menos un objetivo.", zh: "请至少选择一个目标。" },
  "Choose a weight-loss intensity.": { es: "Elige una intensidad de pérdida de peso.", zh: "请选择减重强度。" },
  "Choose up to 3 goals.": { es: "Elige hasta 3 objetivos.", zh: "最多选择 3 个目标。" }
};

export function localeForLanguage(language: AppLanguage) {
  return LANGUAGE_OPTIONS.find((option) => option.code === language)?.locale ?? "en-US";
}

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "en" || value === "es" || value === "zh";
}

function translateDynamic(source: string, language: NonEnglish): string | undefined {
  let match = source.match(/^Step (\d+) of (\d+)$/);
  if (match) return language === "es" ? `Paso ${match[1]} de ${match[2]}` : `第 ${match[1]} 步，共 ${match[2]} 步`;

  match = source.match(/^(\d+) of (\d+)$/);
  if (match) return language === "es" ? `${match[1]} de ${match[2]}` : `${match[1]} / ${match[2]}`;

  match = source.match(/^Match #(\d+)$/);
  if (match) return language === "es" ? `Opción #${match[1]}` : `匹配 #${match[1]}`;

  match = source.match(/^(\d+) (item|items)$/);
  if (match) return language === "es" ? `${match[1]} ${match[1] === "1" ? "artículo" : "artículos"}` : `${match[1]} 项`;

  match = source.match(/^(\d+) (dining concept|dining concepts)$/);
  if (match) return language === "es" ? `${match[1]} ${match[1] === "1" ? "concepto gastronómico" : "conceptos gastronómicos"}` : `${match[1]} 个餐饮档口`;

  match = source.match(/^In your meal: (\d+) serving(s?)$/);
  if (match) return language === "es" ? `En tu comida: ${match[1]} ${match[1] === "1" ? "porción" : "porciones"}` : `你的餐食中：${match[1]} 份`;

  match = source.match(/^(\d+) serving(s?)$/);
  if (match) return language === "es" ? `${match[1]} ${match[1] === "1" ? "porción" : "porciones"}` : `${match[1]} 份`;

  match = source.match(/^(\d+)g left$/);
  if (match) return language === "es" ? `${match[1]}g restantes` : `剩余 ${match[1]}g`;

  match = source.match(/^of (.+)$/);
  if (match) return language === "es" ? `de ${match[1]}` : `目标 ${match[1]}`;

  match = source.match(/^(\d+) confirmed · (\d+) pending$/);
  if (match) return language === "es" ? `${match[1]} confirmadas · ${match[2]} pendientes` : `${match[1]} 已确认 · ${match[2]} 待确认`;

  match = source.match(/^Your order · (.+)$/);
  if (match) return language === "es" ? `Tu pedido · ${match[1]}` : `你的订单 · ${match[1]}`;

  match = source.match(/^Replace (.+)\?$/);
  if (match) return language === "es" ? `¿Reemplazar ${match[1]}?` : `替换 ${match[1]}？`;

  match = source.match(/^Target (.+)$/);
  if (match) return language === "es" ? `Objetivo ${match[1]}` : `目标 ${match[1]}`;

  match = source.match(/^Current (.+)$/);
  if (match) return language === "es" ? `Actual ${match[1]}` : `当前 ${match[1]}`;

  match = source.match(/^Estimated goal date: (.+)\. This is a projection, not a guarantee\.$/);
  if (match) return language === "es" ? `Fecha estimada del objetivo: ${match[1]}. Es una proyección, no una garantía.` : `预计达成日期：${match[1]}。这是预测，并非保证。`;

  match = source.match(/^(\d+)\/3 selected · weight-direction goals are mutually exclusive\.$/);
  if (match) return language === "es" ? `${match[1]}/3 seleccionados · los objetivos de dirección de peso son mutuamente excluyentes.` : `已选 ${match[1]}/3 · 体重方向目标不能同时选择。`;

  match = source.match(/^Falcon Fuel compares eligible foods across (.+) and ranks complete meals around your goals, restrictions, current nutrition, and recent variety\.$/);
  if (match) return language === "es" ? `Falcon Fuel compara los alimentos elegibles de ${match[1]} y ordena comidas completas según tus objetivos, restricciones, nutrición actual y variedad reciente.` : `Falcon Fuel 会比较 ${match[1]} 中符合条件的食物，并根据你的目标、限制、当前营养和近期饮食多样性排序完整餐食。`;

  return undefined;
}

export function translateText(source: string, language: AppLanguage): string {
  if (language === "en") return source;
  const direct = PHRASES[source]?.[language];
  if (direct) return direct;

  if (source.includes(" · ")) {
    const parts = source.split(" · ");
    const translated = parts.map((part) => translateText(part, language));
    if (translated.some((part, index) => part !== parts[index])) return translated.join(" · ");
  }

  return translateDynamic(source, language) ?? source;
}

export function translatePreservingWhitespace(value: string, language: AppLanguage) {
  const match = value.match(/^(\s*)(.*?)(\s*)$/s);
  if (!match) return value;
  const [, before, core, after] = match;
  if (!core) return value;
  return `${before}${translateText(core, language)}${after}`;
}
