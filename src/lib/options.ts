// Option lists used by forms (US-focused for v1).

export const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","District of Columbia","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York",
  "North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
].map((s) => ({ value: s, label: s }));

const o = (...vals: [string, string][]) => vals.map(([value, label]) => ({ value, label }));

export const EMPLOYMENT_TYPES = o(
  ["W2", "W-2 Employee"],
  ["1099", "1099 Contractor"],
  ["C2C", "Corp-to-Corp"],
  ["FULL_TIME", "Full-time (salaried)"],
  ["PART_TIME", "Part-time"],
);
export const employmentTypeLabel = (v: string) => EMPLOYMENT_TYPES.find((x) => x.value === v)?.label ?? v;

export const GENDERS = o(["MALE", "Male"], ["FEMALE", "Female"], ["NON_BINARY", "Non-binary"], ["UNDISCLOSED", "Prefer not to say"]);
export const ETHNICITIES = o(
  ["HISPANIC", "Hispanic or Latino"],
  ["WHITE", "White"],
  ["BLACK", "Black or African American"],
  ["ASIAN", "Asian"],
  ["NATIVE", "American Indian or Alaska Native"],
  ["PACIFIC", "Native Hawaiian or Pacific Islander"],
  ["MULTI", "Two or more races"],
  ["UNDISCLOSED", "Prefer not to say"],
);
export const MARITAL = o(["SINGLE", "Single"], ["MARRIED", "Married"], ["DIVORCED", "Divorced"], ["WIDOWED", "Widowed"]);
export const VETERAN = o(["NOT_VETERAN", "Not a veteran"], ["PROTECTED", "Protected veteran"], ["UNDISCLOSED", "Prefer not to say"]);
export const WORK_AUTH = o(
  ["US_CITIZEN", "US Citizen"],
  ["GREEN_CARD", "Green Card"],
  ["H1B", "H-1B"],
  ["H4_EAD", "H-4 EAD"],
  ["L1", "L-1"],
  ["L2_EAD", "L-2 EAD"],
  ["OPT_EAD", "OPT EAD"],
  ["STEM_OPT", "STEM OPT"],
  ["CPT", "CPT"],
  ["TN", "TN Visa"],
  ["GC_EAD", "GC EAD"],
  ["OTHER", "Other"],
);
export const workAuthLabel = (v: string | null) => (v ? WORK_AUTH.find((x) => x.value === v)?.label ?? v : null);
export const CATEGORIES = o(["CONSULTANT", "Consultant"], ["INTERNAL", "Internal staff"], ["INTERN", "Intern"], ["CONTRACT_TO_HIRE", "Contract-to-hire"]);
export const EMPLOYEE_STATUS = o(["ACTIVE", "Active"], ["INACTIVE", "Inactive"], ["TERMINATED", "Terminated"]);
export const PAY_TYPES = o(["HOURLY", "Hourly"], ["SALARY", "Salary (per pay period)"]);
export const USER_ROLES = o(["EMPLOYEE", "Employee"], ["MANAGER", "Manager"], ["ACCOUNTANT", "Accountant"], ["ADMIN", "Administrator"]);
export const PAYMENT_METHODS = o(["ACH", "ACH"], ["WIRE", "Wire transfer"], ["CHECK", "Check"], ["CARD", "Card"], ["OTHER", "Other"]);
export const INDUSTRIES = o(
  ["IT", "Information Technology"], ["FINANCE", "Banking & Finance"], ["HEALTHCARE", "Healthcare"], ["RETAIL", "Retail"],
  ["MANUFACTURING", "Manufacturing"], ["TELECOM", "Telecom"], ["GOVERNMENT", "Government"], ["OTHER", "Other"],
);
