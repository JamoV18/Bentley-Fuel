import type {
  FoodComponent,
  HardDietaryRestriction,
  MenuItem,
  RecommendationContext,
  RecommendationEligibilityAssessment,
  RecommendationEligibilityIssue,
} from "@/types";
import { HARD_DIETARY_RESTRICTIONS } from "@/types";

const issue = (
  code: RecommendationEligibilityIssue["code"],
  message: string,
  extra?: Omit<RecommendationEligibilityIssue, "code" | "message">,
): RecommendationEligibilityIssue => ({ code, message, ...extra });

const hardDietaryRestrictions = (context: RecommendationContext): HardDietaryRestriction[] =>
  context.profile.dietaryPreferences.filter(
    (tag): tag is HardDietaryRestriction =>
      HARD_DIETARY_RESTRICTIONS.includes(tag as HardDietaryRestriction),
  );

const periodMatches = (item: MenuItem, context: RecommendationContext): boolean => {
  if (!context.mealPeriod || !item.availability || item.availability.length === 0) return true;
  return item.availability.includes("all-day") || item.availability.includes(context.mealPeriod);
};

/**
 * Hard eligibility pass used before scoring/ranking.
 *
 * Customizable items deliberately do not use their aggregate allergen/dietary
 * metadata as a hard rejection because those fields describe the superset of
 * possible components. They must be configured first, then the completed build
 * is validated by the Phase 6 meal resolver.
 */
export function assessMenuItemEligibility(
  item: MenuItem,
  context: RecommendationContext,
  components: readonly FoodComponent[] = [],
): RecommendationEligibilityAssessment {
  const issues: RecommendationEligibilityIssue[] = [];

  if (item.locationId !== context.locationId) {
    issues.push(
      issue("LOCATION_MISMATCH", `${item.name} is not available at the selected physical location.`, {
        menuItemId: item.id,
      }),
    );
  }

  if (!periodMatches(item, context)) {
    issues.push(
      issue("MEAL_PERIOD_UNAVAILABLE", `${item.name} is not available during this meal period.`, {
        menuItemId: item.id,
      }),
    );
  }

  if (item.kind === "customizable") {
    return {
      isEligible: issues.length === 0,
      requiresConfiguration: true,
      issues,
    };
  }

  for (const allergen of context.profile.allergensToAvoid) {
    if (item.allergens.includes(allergen)) {
      issues.push(
        issue("ALLERGEN_CONFLICT", `${item.name} contains an allergen the student avoids.`, {
          menuItemId: item.id,
          allergen,
        }),
      );
    } else if (item.mayContainAllergens?.includes(allergen)) {
      issues.push(
        issue("ALLERGEN_CROSS_CONTACT", `${item.name} may contain an allergen the student avoids.`, {
          menuItemId: item.id,
          allergen,
        }),
      );
    }
  }

  for (const restriction of hardDietaryRestrictions(context)) {
    if (!item.dietaryTags.includes(restriction)) {
      issues.push(
        issue("DIETARY_RESTRICTION_MISMATCH", `${item.name} does not satisfy the student's ${restriction} restriction.`, {
          menuItemId: item.id,
          dietaryRestriction: restriction,
        }),
      );
    }
  }

  const disliked = new Set(context.profile.dislikedComponentIds ?? []);
  if (disliked.size > 0 && item.componentIds?.length) {
    const componentById = new Map(components.map((component) => [component.id, component]));
    for (const componentId of new Set(item.componentIds)) {
      if (!disliked.has(componentId)) continue;
      issues.push(
        issue(
          "DISLIKED_COMPONENT",
          `${item.name} contains ${componentById.get(componentId)?.name ?? "a component"} the student does not want.`,
          { menuItemId: item.id, componentId },
        ),
      );
    }
  }

  return {
    isEligible: issues.length === 0,
    requiresConfiguration: false,
    issues,
  };
}

/** Filter helper for candidate generation; scoring never sees hard-ineligible items. */
export function filterEligibleMenuItems(
  items: readonly MenuItem[],
  context: RecommendationContext,
  components: readonly FoodComponent[] = [],
): MenuItem[] {
  return items.filter((item) => assessMenuItemEligibility(item, context, components).isEligible);
}
