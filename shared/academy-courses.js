(function exposeAcademyCourses(global) {
  const courses = {
    online_tree_planting: {
      name: "Online tree planting",
      lessons: [
        ["onboarding", "Selfie or photo to complete onboarding"],
        ["lesson_1_child_protection", "Lesson 1: Child Protection"],
        ["lesson_2_climate_change", "Lesson 2: Climate Change"],
        ["lesson_3_tree_health", "Lesson 3: Tree Health"],
        ["lesson_4_tree_planting", "Lesson 4: Tree Planting"],
        ["lesson_5_carbon_dioxide_increase", "Lesson 5: Carbon Dioxide Increase"],
        ["lesson_6_soil_condition", "Lesson 6: Soil Condition"],
        ["lesson_7_mulching", "Lesson 7: Mulching"],
        ["lesson_8_erosion_control", "Lesson 8: Erosion Control"],
        ["tutor_question", "A question to the tutor"],
        ["evaluation", "Evaluation"]
      ]
    },
    arboriculture_1: {
      name: "Arboriculture I",
      lessons: [
        ["onboarding", "Onboarding"],
        ["arb1_module_1_tree_biology", "Module 1: Introduction to Arboriculture"],
        ["arb1_module_2_tree_identification", "Module 2: Observing trees"],
        ["arb1_basic_chemistry_plant_growth", "Module 3: Basic chemistry for plant growth"],
        ["arb1_tree_physiology", "Module 4: Tree Physiology"],
        ["arb1_module_3_soil_and_roots", "Module 5: Soil and roots"],
        ["arb1_module_4_tree_selection", "Module 6: Choosing the right tree"],
        ["arb1_module_5_tree_planting", "Module 7: Tree planting"],
        ["arb1_module_6_tree_care", "Module 8: Young tree care"],
        ["arb1_module_7_tree_health", "Module 9: Tree health assessment"],
        ["arb1_module_8_pruning", "Module 10: Basic pruning"],
        ["tutor_question", "A question to the tutor"],
        ["evaluation", "Evaluation"]
      ]
    },
    donor_investor_funding: {
      name: "Communicate effectively with donors and investors",
      lessons: [
        ["onboarding", "Onboarding"],
        ["donor_module_1_report_writing", "Module 1: Report writing"],
        ["donor_module_2_proposal_writing", "Module 2: Proposal writing"],
        ["donor_module_3_business_plan", "Module 3: Writing a business plan"],
        ["donor_module_4_income_generation_fundraising", "Module 4: Income generating and fundraising"]
      ]
    }
  };

  global.KETSO_ACADEMY_COURSES = courses;
  global.KETSO_DEFAULT_COURSE = "online_tree_planting";
})(window);
