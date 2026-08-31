export type ProfileLanguage = "en" | "es" | "fr" | "zh";

type Entry = { es: string; fr: string; zh: string };

const PROFILE: Record<string, Entry> = {
  "Profile": { es: "Perfil", fr: "Profil", zh: "个人资料" },
  "Your profile": { es: "Tu perfil", fr: "Votre profil", zh: "你的个人资料" },
  "Personal details and dietary preferences used across Falcon Fuel.": { es: "Datos personales y preferencias alimentarias utilizados en Falcon Fuel.", fr: "Vos informations personnelles et préférences alimentaires utilisées dans Falcon Fuel.", zh: "Falcon Fuel 中使用的个人信息和饮食偏好。" },
  "Body information": { es: "Información corporal", fr: "Informations corporelles", zh: "身体信息" },
  "Body details": { es: "Datos corporales", fr: "Données corporelles", zh: "身体详情" },
  "Height": { es: "Altura", fr: "Taille", zh: "身高" },
  "Weight": { es: "Peso", fr: "Poids", zh: "体重" },
  "Not provided": { es: "No proporcionado", fr: "Non renseigné", zh: "未提供" },
  "Account": { es: "Cuenta", fr: "Compte", zh: "账户" },
  "Bentley student": { es: "Estudiante de Bentley", fr: "Étudiant Bentley", zh: "Bentley 学生" },
  "Personal profile": { es: "Perfil personal", fr: "Profil personnel", zh: "个人资料" },
  "View profile": { es: "Ver perfil", fr: "Voir le profil", zh: "查看个人资料" },
  "View plan": { es: "Ver plan", fr: "Voir le plan", zh: "查看计划" },
  "App language": { es: "Idioma de la aplicación", fr: "Langue de l’application", zh: "应用语言" },
  "Profile & settings": { es: "Perfil y ajustes", fr: "Profil et paramètres", zh: "个人资料与设置" },
  "Edit onboarding details": { es: "Editar datos de configuración", fr: "Modifier les informations de configuration", zh: "编辑设置资料" },
  "Nutrition preferences": { es: "Preferencias nutricionales", fr: "Préférences nutritionnelles", zh: "营养偏好" },
  "Your information stays on this device in the current prototype.": { es: "En el prototipo actual, tu información permanece en este dispositivo.", fr: "Dans le prototype actuel, vos informations restent sur cet appareil.", zh: "在当前原型中，你的信息仅保存在此设备上。" },
  "Member since": { es: "Miembro desde", fr: "Membre depuis", zh: "加入时间" },
  "No dietary preferences selected.": { es: "No hay preferencias alimentarias seleccionadas.", fr: "Aucune préférence alimentaire sélectionnée.", zh: "未选择饮食偏好。" },
  "No allergens selected.": { es: "No hay alérgenos seleccionados.", fr: "Aucun allergène sélectionné.", zh: "未选择过敏原。" },
  "Profile home": { es: "Inicio del perfil", fr: "Accueil du profil", zh: "个人资料主页" },
  "Open profile menu": { es: "Abrir menú de perfil", fr: "Ouvrir le menu du profil", zh: "打开个人资料菜单" },
  "Choose the language Falcon Fuel uses across the app.": { es: "Elige el idioma que Falcon Fuel usa en toda la aplicación.", fr: "Choisissez la langue utilisée par Falcon Fuel dans toute l’application.", zh: "选择 Falcon Fuel 在整个应用中使用的语言。" }
};

export function translateProfileText(source: string, language: ProfileLanguage): string {
  if (language === "en") return source;
  return PROFILE[source]?.[language] ?? source;
}
