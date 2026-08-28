import { FR_PART_1 } from "./frenchTranslations.part1";
import { FR_PART_2 } from "./frenchTranslations.part2";
import { FR_PART_3 } from "./frenchTranslations.part3";
import { FR_PART_4 } from "./frenchTranslations.part4";

const FR: Record<string, string> = { ...FR_PART_1, ...FR_PART_2, ...FR_PART_3, ...FR_PART_4 };

const MONTHS: Record<string, string> = {
  Jan: "janv.", January: "janvier", Feb: "févr.", February: "février", Mar: "mars", March: "mars",
  Apr: "avr.", April: "avril", May: "mai", Jun: "juin", June: "juin", Jul: "juil.", July: "juillet",
  Aug: "août", August: "août", Sep: "sept.", September: "septembre", Oct: "oct.", October: "octobre",
  Nov: "nov.", November: "novembre", Dec: "déc.", December: "décembre"
};

const WEEKDAYS: Record<string, string> = {
  Mon: "lun.", Monday: "lundi", Tue: "mar.", Tuesday: "mardi", Wed: "mer.", Wednesday: "mercredi",
  Thu: "jeu.", Thursday: "jeudi", Fri: "ven.", Friday: "vendredi", Sat: "sam.", Saturday: "samedi", Sun: "dim.", Sunday: "dimanche"
};

function translateDate(source: string): string | undefined {
  if (WEEKDAYS[source]) return WEEKDAYS[source];

  let match = source.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
  if (match) return `${WEEKDAYS[match[1]]} ${match[3]} ${MONTHS[match[2]]}`;

  match = source.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
  if (match) return `${WEEKDAYS[match[1]]} ${match[3]} ${MONTHS[match[2]]}`;

  match = source.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
  if (match) return `${match[2]} ${MONTHS[match[1]]}`;

  match = source.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (match) {
    let hour = Number(match[3]);
    if (match[5] === "PM" && hour !== 12) hour += 12;
    if (match[5] === "AM" && hour === 12) hour = 0;
    return `${match[2]} ${MONTHS[match[1]]}, ${hour.toString().padStart(2, "0")}:${match[4]}`;
  }
  return undefined;
}

function translateDynamic(source: string): string | undefined {
  let match = source.match(/^Step (\d+) of (\d+)$/);
  if (match) return `Étape ${match[1]} sur ${match[2]}`;
  match = source.match(/^(\d+) of (\d+)$/);
  if (match) return `${match[1]} sur ${match[2]}`;
  match = source.match(/^Match #(\d+)$/);
  if (match) return `Correspondance n° ${match[1]}`;
  match = source.match(/^(\d+) (item|items)$/);
  if (match) return `${match[1]} ${match[1] === "1" ? "article" : "articles"}`;
  match = source.match(/^(\d+) (dining concept|dining concepts)$/);
  if (match) return `${match[1]} ${match[1] === "1" ? "concept de restauration" : "concepts de restauration"}`;
  match = source.match(/^In your meal: (\d+) serving(s?)$/);
  if (match) return `Dans votre repas : ${match[1]} ${match[1] === "1" ? "portion" : "portions"}`;
  match = source.match(/^(\d+) serving(s?)$/);
  if (match) return `${match[1]} ${match[1] === "1" ? "portion" : "portions"}`;
  match = source.match(/^(\d+)g left$/);
  if (match) return `${match[1]} g restants`;
  match = source.match(/^of (.+)$/);
  if (match) return `sur ${match[1]}`;
  match = source.match(/^(\d+) confirmed · (\d+) pending$/);
  if (match) return `${match[1]} confirmés · ${match[2]} en attente`;
  match = source.match(/^Your order · (.+)$/);
  if (match) return `Votre commande · ${match[1]}`;
  match = source.match(/^Replace (.+)\?$/);
  if (match) return `Remplacer ${match[1]} ?`;
  match = source.match(/^Target (.+)$/);
  if (match) return `Objectif ${match[1]}`;
  match = source.match(/^Current (.+)$/);
  if (match) return `Actuel ${match[1]}`;
  match = source.match(/^Estimated goal date: (.+)\. This is a projection, not a guarantee\.$/);
  if (match) return `Date estimée de l’objectif : ${match[1]}. Il s’agit d’une projection, pas d’une garantie.`;
  match = source.match(/^(\d+)\/3 selected · weight-direction goals are mutually exclusive\.$/);
  if (match) return `${match[1]}/3 sélectionnés · les objectifs de direction du poids sont mutuellement exclusifs.`;
  match = source.match(/^Bentley Fuel compares eligible foods across (.+) and ranks complete meals around your goals, restrictions, current nutrition, and recent variety\.$/);
  if (match) return `Bentley Fuel compare les aliments admissibles de ${match[1]} et classe des repas complets selon vos objectifs, restrictions, nutrition actuelle et variété récente.`;
  return undefined;
}

export function translateFrenchText(source: string): string {
  const direct = FR[source];
  if (direct) return direct;

  if (source.includes(" · ")) {
    const parts = source.split(" · ");
    const translated = parts.map((part) => translateFrenchText(part));
    if (translated.some((part, index) => part !== parts[index])) return translated.join(" · ");
  }

  return translateDynamic(source) ?? translateDate(source) ?? source;
}
