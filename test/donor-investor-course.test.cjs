const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const courseSource = fs.readFileSync(path.join(root, "shared", "academy-courses.js"), "utf8");
const window = {};
vm.runInNewContext(courseSource, { window });

const courseKey = "donor_investor_funding";
const expectedLessons = [
  ["onboarding", "Onboarding"],
  ["donor_module_1_report_writing", "Module 1: Report writing"],
  ["donor_module_2_proposal_writing", "Module 2: Proposal writing"],
  ["donor_module_3_business_plan", "Module 3: Writing a business plan"],
  ["donor_module_4_income_generation_fundraising", "Module 4: Income generating and fundraising"]
];

test("shared config exposes the donor course under its canonical identifier", () => {
  const course = window.KETSO_ACADEMY_COURSES[courseKey];
  assert.equal(course.name, "Communicate effectively with donors and investors");
  assert.deepEqual(JSON.parse(JSON.stringify(course.lessons)), expectedLessons);
  assert.deepEqual(JSON.parse(JSON.stringify(course.submissionSections)), [
    ["onboarding", "Onboarding"], ["cover_page", "Part 1: Cover page"],
    ["results", "Part 2: Results"], ["impact", "Part 3: Impact"],
    ["conclusions", "Part 4: Conclusions"], ["finances", "Part 5: Finances"]
  ]);
  assert.equal(Object.keys(window.KETSO_ACADEMY_COURSES).length, 3);
});

test("uploader, gallery and profile pass the donor course through the existing flow", () => {
  const startPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const uploader = fs.readFileSync(path.join(root, "academy-onboarding", "index.html"), "utf8");
  const gallery = fs.readFileSync(path.join(root, "student-gallery", "index.html"), "utf8");
  const profile = fs.readFileSync(path.join(root, "student-profile", "index.html"), "utf8");

  assert.match(
  uploader,
  /activeCourseKey = courseKeyFromInterest\(interestArea\.value\)/
);
  assert.match(
  uploader,
  /value === "distance_certificate_course"[\s\S]*return "arboriculture_1"/
);

assert.match(
  uploader,
  /value === "donor_investor_funding"[\s\S]*return "donor_investor_funding"/
);
  assert.match(uploader, /course_key: activeCourseKey/);
  assert.match(uploader, /lesson_key: lessonKey\.value/);
  assert.match(startPage, /data-programme="donor_investor_funding"/);
  assert.match(startPage, /Communicate effectively with donors and investors/);
  assert.match(app, /coursePurposes\(activeCourseKey\)/);
  assert.match(app, /course_key: activeCourseKey/);
  assert.match(app, /submission_section: purpose\.submissionSection \|\| null/);
  assert.match(app, /lesson_key: activeStudent \|\| !staffUnlocked \? purpose\.lessonKey/);
  assert.match(app, /programmeSelectedByStudent/);
  assert.match(app, /if \(!programmeSelectedByStudent\)/);
  assert.match(gallery, /option value="donor_investor_funding"/);
  assert.match(gallery, /student-profile\/\?student_id=.*course_key=/s);
  assert.match(profile, /KETSO_ACADEMY_COURSES\?\.\[requestedCourseKey\]/);
  assert.match(profile, /find\(\(\[key\]\) => key === value\)/);
  assert.match(profile, /labelSubmissionSection\(upload\.submission_section\)/);
});

test("extra-course enrolment link is token-gated and opens safely", () => {
  const startPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(startPage, /id="extraCourseEnrolmentLink"[\s\S]*target="_blank"[\s\S]*rel="noopener"[\s\S]*hidden/);
  assert.match(app, /new URL\(EXTRA_COURSE_ENROLMENT_FORM_URL\)/);
  assert.match(app, /new URLSearchParams\(\{ token: academyToken \}\)/);
  assert.match(app, /extraCourseEnrolmentLink\.hidden = false/);
  const onboarding = fs.readFileSync(path.join(root, "academy-onboarding", "index.html"), "utf8");
  assert.match(onboarding, /id="extraCourseEnrolmentLink"[\s\S]*target="_blank"[\s\S]*rel="noopener"[\s\S]*hidden/);
  assert.match(onboarding, /new URL\(EXTRA_COURSE_ENROLMENT_FORM_URL\)/);
  assert.match(onboarding, /new URLSearchParams\(\{ token \}\)/);
  assert.match(onboarding, /extraCourseEnrolmentLink\.hidden = false/);
});
