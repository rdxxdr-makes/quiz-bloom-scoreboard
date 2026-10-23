export const BRANCHES = ["CSE-A", "CSE-B", "AI-DS", "CSE(AI)", "ECE"] as const;
export type Branch = (typeof BRANCHES)[number];

export const ADMIN_TOKEN_KEY = "rdx_admin_token";

export const APP_NAME = "Harsh Quiz Portal";
