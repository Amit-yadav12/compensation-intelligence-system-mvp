/**
 * Compensation submission validation.
 *
 * The UI may validate for UX, but THIS schema is the authority. The server
 * recomputes totalCompensation — any client-supplied total is stripped here.
 *
 * Rules:
 *  - base/bonus/stock: integers >= 0 (negative money is invalid for this MVP;
 *    missing bonus/stock default to 0 at the service layer after validation)
 *  - yearsExperience: 0..60
 *  - company/location/role/roleFamily/level are resolved by the service layer
 *    against controlled vocabularies — free text is never trusted as identity
 *  - currency: INR | USD (the two currencies in the demo dataset)
 */
import { z } from "zod";

/**
 * Upper bound for any single monetary component. Matches PostgreSQL `integer`
 * (2,147,483,647) with headroom — ₹200Cr / $2B per component is far beyond any
 * real annual figure, so exceeding it is a data-entry error, not a valid value.
 */
export const MAX_MONEY = 2_000_000_000;
const MONEY_MAX_MESSAGE = "exceeds the supported maximum (2,000,000,000).";

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const;
export const SOURCE_TYPES = ["self_reported", "offer_letter", "pay_slip", "anonymous_survey"] as const;
export const CURRENCIES = ["INR", "USD"] as const;

export const compensationSubmissionSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(120),
  roleFamily: z.string().trim().min(1, "Role family is required."),
  role: z.string().trim().min(1, "Role is required."),
  companyLevel: z.string().trim().min(1, "Company-specific level is required.").max(60),
  location: z.string().trim().min(1, "Location is required.").max(120),
  baseSalary: z.coerce
    .number({ message: "Base salary must be a number." })
    .int("Base salary must be a whole number.")
    .min(0, "Base salary must be greater than or equal to 0.")
    .max(MAX_MONEY, `Base salary ${MONEY_MAX_MESSAGE}`),
  annualBonus: z.coerce
    .number()
    .int("Bonus must be a whole number.")
    .min(0, "Bonus must be greater than or equal to 0.")
    .max(MAX_MONEY, `Bonus ${MONEY_MAX_MESSAGE}`)
    .optional(),
  annualStock: z.coerce
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock must be greater than or equal to 0.")
    .max(MAX_MONEY, `Stock ${MONEY_MAX_MESSAGE}`)
    .optional(),
  currency: z.enum(CURRENCIES, { message: "Currency must be INR or USD." }),
  yearsExperience: z.coerce
    .number({ message: "Years of experience must be a number." })
    .int("Years of experience must be a whole number.")
    .min(0, "Years of experience cannot be negative.")
    .max(60, "Years of experience must be 60 or less."),
  yearsAtCompany: z.coerce
    .number()
    .int("Years at company must be a whole number.")
    .min(0, "Years at company cannot be negative.")
    .max(60, "Years at company must be 60 or less.")
    .optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  sourceType: z.enum(SOURCE_TYPES).default("self_reported"),
  sourceReference: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  reportedAt: z.coerce.date({ message: "Reporting date is required." }),
}).refine((v) => v.baseSalary + (v.annualBonus ?? 0) + (v.annualStock ?? 0) <= MAX_MONEY, {
  message: `Total compensation ${MONEY_MAX_MESSAGE}`,
  path: ["baseSalary"],
});

export type CompensationSubmissionInput = z.infer<
  typeof compensationSubmissionSchema
>;

/**
 * Auth schemas. Email + password; password strength is enforced here,
 * never in the database (which only stores a scrypt hash).
 */
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password must be at most 100 characters."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(100),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
