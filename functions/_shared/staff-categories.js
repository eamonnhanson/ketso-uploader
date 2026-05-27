export const STAFF_CATEGORIES = [
  "forest_hero",
  "nursery",
  "training",
  "vocational_training",
  "charcoal_making",
  "truck",
  "wilde_ganzen",
  "hoorn_foundation",
  "josephina_foundation",
  "care_international",
  "woord_en_daad",
  "plant_een_boom",
  "other"
];

export function isAllowedStaffCategory(value) {
  return STAFF_CATEGORIES.includes(value);
}
