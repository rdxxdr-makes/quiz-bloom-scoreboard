export const BRANCHES = ["CSE-A", "CSE-B", "AI-DS", "CSE(AI)", "ECE"] as const;
export type Branch = (typeof BRANCHES)[number];

/** PINs are validated directly in the app (client-side), per the simplified auth model. */
export const ADMIN_PIN = "Harsh@100031";
export const STUDENT_PIN = "333444";

export const ADMIN_TOKEN_KEY = "rdx_admin_token";
export const STUDENT_PROFILE_KEY = "rdx_student_profile";

export const APP_NAME = "Harsh Quiz Portal";
