from pathlib import Path

quality = Path("src/services/recommendationMealQuality.ts")
text = quality.read_text()
replacements = {
    "if (sideItems.length >= 2 && denseCount >= 2) score -= 18;": "if (sideItems.length >= 2 && denseCount >= 2) score -= 28;",
    "if (sideItems.length >= 2 && produceCount === 0) score -= 8;": "if (sideItems.length >= 2 && produceCount === 0) score -= 12;",
    'if (style === "handheld" && sideItems.length >= 2 && denseCount >= 2) score -= 10;': 'if (style === "handheld" && sideItems.length >= 2 && denseCount >= 2) score -= 14;',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"meal quality tune target missing: {old}")
    text = text.replace(old, new, 1)
quality.write_text(text)

patch = Path("scripts/recommendation_v2_patch.py")
text = patch.read_text()
old = 'const builds = cartesian(variantGroups, distinctAnchorCount > 1 ? Math.min(2, remaining) : remaining);'
new = '''const isSingleCustomizable = itemSet.length === 1 && itemSet[0]?.kind === "customizable";
    const perSetCap = distinctAnchorCount > 1 && !isSingleCustomizable
      ? Math.min(2, remaining)
      : Math.min(maxCustomVariants, remaining);
    const builds = cartesian(variantGroups, perSetCap);'''
if old not in text:
    raise SystemExit("candidate variant cap patch target missing")
patch.write_text(text.replace(old, new, 1))
