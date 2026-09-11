/**
 * Deterministic seed for CompScope.
 *
 * - Fixed PRNG seed → identical data on every run.
 * - Reference data is upserted (idempotent).
 * - Compensation is inserted only when the table is empty, so reruns never
 *   create uncontrolled duplicates.
 * - All records are SYNTHETIC, verificationStatus = "unverified",
 *   sourceType = "self_reported". The UI labels them as demo data.
 *
 * Run: npx tsx src/db/seed.ts
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import { db } from "./index";
import {
  users,
  companies,
  companyAliases,
  roleFamilies,
  roles,
  canonicalLevels,
  companyLevels,
  locations,
  compensation,
} from "./schema";
import { sql } from "drizzle-orm";
import { generateDedupeKey, reportedMonth } from "../lib/utils/dedupe";
import { normalizeCompanyText } from "../lib/normalization/company";
import { normalizeLevelText } from "../lib/normalization/level";
import { hashPassword } from "../lib/auth/session";

/* ------------------------------ PRNG -------------------------------- */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260117);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/* --------------------------- canonical levels ------------------------ */

const LEVELS = [
  { id: "c1", rank: 1, name: "C1 · Entry", description: "New graduate / 0–1 years. Learning the craft." },
  { id: "c2", rank: 2, name: "C2 · Junior", description: "1–3 years. Executes well-defined tasks." },
  { id: "c3", rank: 3, name: "C3 · Early Career", description: "2–4 years. Owns small features end to end." },
  { id: "c4", rank: 4, name: "C4 · Mid", description: "4–6 years. Fully independent; the core comparison band." },
  { id: "c5", rank: 5, name: "C5 · Mid-Senior", description: "6–8 years. Leads small projects, mentors juniors." },
  { id: "c6", rank: 6, name: "C6 · Senior", description: "8–11 years. Deep specialist or broad owner." },
  { id: "c7", rank: 7, name: "C7 · Lead", description: "10–14 years. Leads teams or major technical bets." },
  { id: "c8", rank: 8, name: "C8 · Staff", description: "13–17 years. Organization-level technical impact." },
  { id: "c9", rank: 9, name: "C9 · Principal", description: "16–20 years. Rare; sets strategy across orgs." },
  { id: "c10", rank: 10, name: "C10 · Director", description: "18+ years. Executive-level technical leadership." },
];

/* ----------------------------- locations ----------------------------- */

type LocDef = {
  id: string;
  city: string;
  state: string | null;
  country: string;
  normalizedName: string;
  aliases: string[];
  currency: "INR" | "USD";
  factor: number;
};

const LOCATIONS: LocDef[] = [
  { id: "bengaluru", city: "Bengaluru", state: "Karnataka", country: "India", normalizedName: "bengaluru", aliases: ["bangalore"], currency: "INR", factor: 1.0 },
  { id: "hyderabad", city: "Hyderabad", state: "Telangana", country: "India", normalizedName: "hyderabad", aliases: [], currency: "INR", factor: 0.92 },
  { id: "pune", city: "Pune", state: "Maharashtra", country: "India", normalizedName: "pune", aliases: [], currency: "INR", factor: 0.85 },
  { id: "mumbai", city: "Mumbai", state: "Maharashtra", country: "India", normalizedName: "mumbai", aliases: ["bombay"], currency: "INR", factor: 0.97 },
  { id: "delhi-ncr", city: "Delhi NCR", state: "Delhi", country: "India", normalizedName: "delhi ncr", aliases: ["gurgaon", "gurugram", "noida", "new delhi", "delhi"], currency: "INR", factor: 0.95 },
  { id: "chennai", city: "Chennai", state: "Tamil Nadu", country: "India", normalizedName: "chennai", aliases: ["madras"], currency: "INR", factor: 0.9 },
  { id: "ahmedabad", city: "Ahmedabad", state: "Gujarat", country: "India", normalizedName: "ahmedabad", aliases: [], currency: "INR", factor: 0.78 },
  { id: "jaipur", city: "Jaipur", state: "Rajasthan", country: "India", normalizedName: "jaipur", aliases: [], currency: "INR", factor: 0.72 },
  { id: "kochi", city: "Kochi", state: "Kerala", country: "India", normalizedName: "kochi", aliases: ["cochin"], currency: "INR", factor: 0.75 },
  { id: "chandigarh", city: "Chandigarh", state: "Chandigarh", country: "India", normalizedName: "chandigarh", aliases: [], currency: "INR", factor: 0.74 },
  { id: "kolkata", city: "Kolkata", state: "West Bengal", country: "India", normalizedName: "kolkata", aliases: ["calcutta"], currency: "INR", factor: 0.76 },
  { id: "indore", city: "Indore", state: "Madhya Pradesh", country: "India", normalizedName: "indore", aliases: [], currency: "INR", factor: 0.68 },
  { id: "sf-bay-area", city: "San Francisco Bay Area", state: "California", country: "United States", normalizedName: "san francisco bay area", aliases: ["san francisco", "sf", "bay area", "silicon valley"], currency: "USD", factor: 1.25 },
  { id: "seattle", city: "Seattle", state: "Washington", country: "United States", normalizedName: "seattle", aliases: [], currency: "USD", factor: 1.15 },
  { id: "new-york", city: "New York", state: "New York", country: "United States", normalizedName: "new york", aliases: ["nyc", "new york city"], currency: "USD", factor: 1.2 },
  { id: "austin", city: "Austin", state: "Texas", country: "United States", normalizedName: "austin", aliases: [], currency: "USD", factor: 0.9 },
  { id: "denver", city: "Denver", state: "Colorado", country: "United States", normalizedName: "denver", aliases: [], currency: "USD", factor: 0.95 },
  { id: "boston", city: "Boston", state: "Massachusetts", country: "United States", normalizedName: "boston", aliases: [], currency: "USD", factor: 1.05 },
];

/* --------------------------- role taxonomy --------------------------- */

const ROLE_FAMILIES = [
  { id: "software-engineering", name: "Software Engineering", description: "Product engineering across the stack.", roles: ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "Mobile Engineer", "Embedded Engineer", "Systems Engineer", "Graphics Engineer", "Solutions Architect"] },
  { id: "data", name: "Data", description: "Data science, engineering and analytics.", roles: ["Data Scientist", "Data Engineer", "ML Engineer", "Data Analyst", "Research Scientist", "Analytics Engineer", "BI Engineer"] },
  { id: "product", name: "Product Management", description: "Product strategy and execution.", roles: ["Product Manager", "Technical Product Manager", "Group Product Manager", "Product Lead", "Product Analyst", "Senior Product Manager"] },
  { id: "design", name: "Design", description: "Product and experience design.", roles: ["Product Designer", "UX Designer", "Visual Designer", "Design Lead", "UX Researcher", "Interaction Designer"] },
  { id: "engineering-management", name: "Engineering Management", description: "People and delivery leadership.", roles: ["Engineering Manager", "Senior Engineering Manager", "Director of Engineering", "Engineering Lead"] },
  { id: "devops-sre", name: "DevOps & SRE", description: "Infrastructure, reliability and platforms.", roles: ["DevOps Engineer", "Site Reliability Engineer", "Platform Engineer", "Cloud Engineer", "Infrastructure Engineer", "Release Engineer"] },
  { id: "qa", name: "Quality & Testing", description: "Quality assurance and test automation.", roles: ["QA Engineer", "Automation Engineer", "Test Lead", "QA Lead", "Performance Engineer"] },
  { id: "security", name: "Security", description: "Application and infrastructure security.", roles: ["Security Engineer", "Application Security Engineer", "Security Analyst", "Penetration Tester", "Security Architect"] },
  { id: "marketing", name: "Marketing", description: "Growth, brand and content.", roles: ["Marketing Manager", "Growth Marketer", "Content Strategist", "Product Marketing Manager", "SEO Specialist"] },
  { id: "sales", name: "Sales", description: "Revenue and solutions.", roles: ["Account Executive", "Sales Manager", "Solutions Engineer", "Account Manager", "Business Development Representative"] },
  { id: "finance", name: "Finance", description: "Planning, accounting and analysis.", roles: ["Financial Analyst", "Finance Manager", "Accountant", "FP&A Analyst", "Tax Analyst"] },
  { id: "hr", name: "HR & People", description: "People operations and recruiting.", roles: ["HR Manager", "Technical Recruiter", "People Partner", "HR Business Partner", "Recruiter"] },
];

/* ------------------------------ companies ---------------------------- */

type Archetype = "balanced" | "high_equity" | "high_base" | "high_bonus" | "cash_heavy";

const ARCHETYPE_MIX: Record<Archetype, { base: number; stock: number; bonus: number }> = {
  balanced: { base: 0.7, stock: 0.16, bonus: 0.14 },
  high_equity: { base: 0.6, stock: 0.3, bonus: 0.1 },
  high_base: { base: 0.82, stock: 0.07, bonus: 0.11 },
  high_bonus: { base: 0.68, stock: 0.1, bonus: 0.22 },
  cash_heavy: { base: 0.95, stock: 0.0, bonus: 0.05 },
};

const L = (map: Record<string, string>) => map;

const googleLadder = L({ L3: "c2", L4: "c3", L5: "c4", L6: "c5", L7: "c6", L8: "c7", L9: "c8" });
const msftLadder = L({ 60: "c2", 61: "c3", 62: "c4", 63: "c5", 64: "c6", 65: "c7", 66: "c8" });
const amazonLadder = L({ "SDE I": "c2", "SDE II": "c4", "SDE III": "c5", "L6 SDE": "c6", "Principal SDE": "c8" });
const metaLadder = L({ E3: "c2", E4: "c3", E5: "c4", E6: "c6", E7: "c8" });
const appleLadder = L({ ICT2: "c2", ICT3: "c3", ICT4: "c4", ICT5: "c5", ICT6: "c6" });
const uberLadder = L({ L3: "c3", L4: "c4", L5: "c5", L6: "c6", L7: "c7" });
const stripeLadder = L({ L3: "c3", L4: "c4", L5: "c5", L6: "c6", L7: "c7" });
const genericLadder = L({ Junior: "c2", Mid: "c4", Senior: "c6", Lead: "c7", Staff: "c8", Principal: "c9" });
const indianLadder = L({ "SDE 1": "c2", "SDE 2": "c4", "Senior SDE": "c6", "Lead SDE": "c7", "Staff SDE": "c8", "Principal SDE": "c9" });
const flipkartLadder = L({ "SDE-1": "c2", "SDE-2": "c4", "SDE-3": "c5", "Senior SDE": "c6" });
const adobeLadder = L({ "SDE 1": "c2", "SDE 2": "c4", "Senior SDE": "c6", "Lead SDE": "c7" });
const linkedinLadder = L({ L3: "c3", L4: "c4", L5: "c5", L6: "c6", L7: "c7" });
const netflixLadder = L({ "SWE": "c3", "Senior SWE": "c5", "Staff SWE": "c7" });
const bankLadder = L({ Analyst: "c2", Associate: "c4", "Vice President": "c6", "Executive Director": "c8", "Managing Director": "c10" });
const servicesLadder = L({ "Systems Engineer": "c1", "Senior Systems Engineer": "c2", "Technology Analyst": "c3", "Technology Lead": "c5", "Senior Technology Architect": "c7" });

type CompanyDef = {
  id: string;
  name: string;
  aliases: string[];
  website: string;
  description: string;
  archetype: Archetype;
  tier: number;
  locations: string[];
  ladder: Record<string, string>;
};

const COMPANIES: CompanyDef[] = [
  { id: "google", name: "Google", aliases: ["Google India", "Alphabet", "Google LLC", "Google India Pvt Ltd"], website: "https://google.com", description: "Search, cloud and AI giant. Known for top-of-market equity grants at senior levels.", archetype: "high_equity", tier: 1.28, locations: ["bengaluru", "hyderabad", "sf-bay-area", "seattle"], ladder: googleLadder },
  { id: "microsoft", name: "Microsoft", aliases: ["Microsoft Corporation", "MSFT", "Microsoft India"], website: "https://microsoft.com", description: "Cloud, productivity and AI. Balanced packages with strong refreshers.", archetype: "balanced", tier: 1.18, locations: ["hyderabad", "bengaluru", "seattle", "sf-bay-area"], ladder: msftLadder },
  { id: "amazon", name: "Amazon", aliases: ["Amazon India", "AWS", "Amazon.com"], website: "https://amazon.com", description: "E-commerce and AWS. Base-heavy comp with structured level bands.", archetype: "balanced", tier: 1.12, locations: ["bengaluru", "hyderabad", "seattle", "sf-bay-area"], ladder: amazonLadder },
  { id: "meta", name: "Meta", aliases: ["Facebook", "Meta Platforms", "Instagram"], website: "https://meta.com", description: "Social and AI. Aggressive equity, strong refreshers, high variance at senior levels.", archetype: "high_equity", tier: 1.3, locations: ["bengaluru", "hyderabad", "sf-bay-area", "new-york"], ladder: metaLadder },
  { id: "apple", name: "Apple", aliases: ["Apple India", "Apple Inc"], website: "https://apple.com", description: "Consumer hardware and services. Cash-heavy, predictable equity.", archetype: "high_base", tier: 1.15, locations: ["bengaluru", "hyderabad", "sf-bay-area", "austin"], ladder: appleLadder },
  { id: "netflix", name: "Netflix", aliases: ["Netflix Inc"], website: "https://netflix.com", description: "Streaming. Famously cash-heavy: top-of-market salary, no equity.", archetype: "cash_heavy", tier: 1.35, locations: ["sf-bay-area", "new-york"], ladder: netflixLadder },
  { id: "uber", name: "Uber", aliases: ["Uber Technologies", "Uber India"], website: "https://uber.com", description: "Mobility platform. Equity-heavy packages with strong upside.", archetype: "high_equity", tier: 1.08, locations: ["bengaluru", "sf-bay-area", "new-york"], ladder: uberLadder },
  { id: "airbnb", name: "Airbnb", aliases: ["Airbnb Inc"], website: "https://airbnb.com", description: "Travel marketplace. Equity-heavy, design-obsessed culture.", archetype: "high_equity", tier: 1.1, locations: ["sf-bay-area", "bengaluru"], ladder: uberLadder },
  { id: "stripe", name: "Stripe", aliases: ["Stripe Inc", "Stripe India"], website: "https://stripe.com", description: "Payments infrastructure. High equity, strong engineering brand.", archetype: "high_equity", tier: 1.15, locations: ["sf-bay-area", "bengaluru"], ladder: stripeLadder },
  { id: "atlassian", name: "Atlassian", aliases: ["Atlassian India"], website: "https://atlassian.com", description: "Collaboration software (Jira, Confluence). Base-focused with steady bonuses.", archetype: "high_base", tier: 1.02, locations: ["bengaluru", "sf-bay-area"], ladder: adobeLadder },
  { id: "adobe", name: "Adobe", aliases: ["Adobe India", "Adobe Inc"], website: "https://adobe.com", description: "Creative and document cloud. Balanced, lower-variance packages.", archetype: "balanced", tier: 0.98, locations: ["bengaluru", "delhi-ncr", "sf-bay-area"], ladder: adobeLadder },
  { id: "salesforce", name: "Salesforce", aliases: ["Salesforce India", "Salesforce Inc"], website: "https://salesforce.com", description: "CRM leader. Bonus-heavy structure with on-target earnings.", archetype: "high_bonus", tier: 1.0, locations: ["hyderabad", "bengaluru", "sf-bay-area"], ladder: adobeLadder },
  { id: "oracle", name: "Oracle", aliases: ["Oracle India", "Oracle Corp"], website: "https://oracle.com", description: "Enterprise software and cloud. Conservative, base-heavy pay.", archetype: "high_base", tier: 0.92, locations: ["bengaluru", "hyderabad", "austin"], ladder: genericLadder },
  { id: "ibm", name: "IBM", aliases: ["IBM India", "IBM Corp"], website: "https://ibm.com", description: "Enterprise IT and services. Broad levels, below-market cash.", archetype: "high_base", tier: 0.8, locations: ["bengaluru", "pune", "austin"], ladder: genericLadder },
  { id: "intel", name: "Intel", aliases: ["Intel India", "Intel Corp"], website: "https://intel.com", description: "Semiconductors. Hardware-leaning comp with good base.", archetype: "high_base", tier: 0.95, locations: ["bengaluru", "sf-bay-area", "austin"], ladder: genericLadder },
  { id: "cisco", name: "Cisco", aliases: ["Cisco Systems", "Cisco India"], website: "https://cisco.com", description: "Networking and collaboration. Balanced, steady employer.", archetype: "balanced", tier: 0.95, locations: ["bengaluru", "pune", "sf-bay-area"], ladder: genericLadder },
  { id: "nvidia", name: "NVIDIA", aliases: ["NVIDIA India", "NVIDIA Corp"], website: "https://nvidia.com", description: "AI and GPU computing. Equity-rich, explosive upside in recent years.", archetype: "high_equity", tier: 1.3, locations: ["bengaluru", "pune", "sf-bay-area"], ladder: genericLadder },
  { id: "vmware", name: "VMware", aliases: ["VMware India", "VMware Inc"], website: "https://vmware.com", description: "Virtualization and multi-cloud. Balanced packages.", archetype: "balanced", tier: 0.95, locations: ["bengaluru", "pune", "sf-bay-area"], ladder: genericLadder },
  { id: "sap", name: "SAP", aliases: ["SAP India", "SAP Labs"], website: "https://sap.com", description: "Enterprise ERP. Bonus-heavy with structured performance cycles.", archetype: "high_bonus", tier: 0.95, locations: ["bengaluru", "delhi-ncr"], ladder: genericLadder },
  { id: "servicenow", name: "ServiceNow", aliases: ["ServiceNow India"], website: "https://servicenow.com", description: "Enterprise workflow platform. Balanced and growing.", archetype: "balanced", tier: 1.0, locations: ["hyderabad", "bengaluru"], ladder: adobeLadder },
  { id: "workday", name: "Workday", aliases: ["Workday Inc"], website: "https://workday.com", description: "Finance and HR cloud. Balanced, predictable comp.", archetype: "balanced", tier: 0.98, locations: ["pune", "austin"], ladder: genericLadder },
  { id: "paypal", name: "PayPal", aliases: ["PayPal India", "PayPal Inc"], website: "https://paypal.com", description: "Payments. Balanced with strong India presence.", archetype: "balanced", tier: 0.95, locations: ["bengaluru", "chennai", "sf-bay-area"], ladder: genericLadder },
  { id: "linkedin", name: "LinkedIn", aliases: ["LinkedIn India", "LinkedIn Corp"], website: "https://linkedin.com", description: "Professional network. Equity-rich, strong perks.", archetype: "high_equity", tier: 1.12, locations: ["bengaluru", "sf-bay-area"], ladder: linkedinLadder },
  { id: "spotify", name: "Spotify", aliases: ["Spotify AB", "Spotify India"], website: "https://spotify.com", description: "Audio streaming. Balanced, mission-driven culture.", archetype: "balanced", tier: 0.95, locations: ["new-york", "bengaluru"], ladder: uberLadder },
  { id: "dropbox", name: "Dropbox", aliases: ["Dropbox Inc"], website: "https://dropbox.com", description: "Cloud storage. Equity-heavy, small but highly paid.", archetype: "high_equity", tier: 1.05, locations: ["sf-bay-area"], ladder: uberLadder },
  { id: "github", name: "GitHub", aliases: ["GitHub Inc", "GitHub India"], website: "https://github.com", description: "Developer platform. Base-friendly with solid equity.", archetype: "high_base", tier: 1.05, locations: ["sf-bay-area", "hyderabad"], ladder: uberLadder },
  { id: "gitlab", name: "GitLab", aliases: ["GitLab Inc"], website: "https://gitlab.com", description: "DevSecOps platform, all-remote. Balanced, location-adjusted.", archetype: "balanced", tier: 0.9, locations: ["bengaluru", "sf-bay-area", "austin"], ladder: genericLadder },
  { id: "datadog", name: "Datadog", aliases: ["Datadog Inc", "Datadog India"], website: "https://datadoghq.com", description: "Observability platform. Equity-heavy, fast growth.", archetype: "high_equity", tier: 1.05, locations: ["new-york", "hyderabad"], ladder: uberLadder },
  { id: "snowflake", name: "Snowflake", aliases: ["Snowflake Inc", "Snowflake India"], website: "https://snowflake.com", description: "Data cloud. Equity-rich with high upside.", archetype: "high_equity", tier: 1.15, locations: ["sf-bay-area", "bengaluru"], ladder: uberLadder },
  { id: "databricks", name: "Databricks", aliases: ["Databricks Inc"], website: "https://databricks.com", description: "Data and AI platform. Top-of-market equity grants.", archetype: "high_equity", tier: 1.2, locations: ["sf-bay-area", "bengaluru"], ladder: uberLadder },
  { id: "coinbase", name: "Coinbase", aliases: ["Coinbase Inc", "Coinbase India"], website: "https://coinbase.com", description: "Crypto exchange. Equity-heavy, crypto-tied upside.", archetype: "high_equity", tier: 1.15, locations: ["sf-bay-area", "bengaluru"], ladder: uberLadder },
  { id: "robinhood", name: "Robinhood", aliases: ["Robinhood Inc"], website: "https://robinhood.com", description: "Retail brokerage. Equity-heavy with growth upside.", archetype: "high_equity", tier: 1.1, locations: ["sf-bay-area"], ladder: uberLadder },
  { id: "doordash", name: "DoorDash", aliases: ["DoorDash Inc"], website: "https://doordash.com", description: "On-demand delivery. Equity-rich, high velocity.", archetype: "high_equity", tier: 1.0, locations: ["sf-bay-area", "new-york"], ladder: uberLadder },
  { id: "walmart-global-tech", name: "Walmart Global Tech", aliases: ["Walmart Global Tech India", "Walmart Labs"], website: "https://walmart.com", description: "Retail tech. Bonus-heavy with stable cash.", archetype: "high_bonus", tier: 0.95, locations: ["bengaluru", "chennai"], ladder: indianLadder },
  { id: "target", name: "Target", aliases: ["Target India", "Target Corporation"], website: "https://target.com", description: "Retail technology. Bonus-heavy, structured levels.", archetype: "high_bonus", tier: 0.9, locations: ["bengaluru", "sf-bay-area"], ladder: indianLadder },
  { id: "flipkart", name: "Flipkart", aliases: ["Flipkart Internet", "Flipkart India"], website: "https://flipkart.com", description: "Indian e-commerce. Bonus-heavy with ESOP upside.", archetype: "high_bonus", tier: 1.0, locations: ["bengaluru", "delhi-ncr"], ladder: flipkartLadder },
  { id: "swiggy", name: "Swiggy", aliases: ["Swiggy India", "Bundl Technologies"], website: "https://swiggy.com", description: "Food delivery. Balanced post-IPO packages.", archetype: "balanced", tier: 0.95, locations: ["bengaluru", "mumbai"], ladder: indianLadder },
  { id: "zomato", name: "Zomato", aliases: ["Zomato Ltd", "Zomato India"], website: "https://zomato.com", description: "Food delivery and dining. Balanced with ESOPs.", archetype: "balanced", tier: 0.95, locations: ["delhi-ncr", "mumbai", "bengaluru"], ladder: indianLadder },
  { id: "paytm", name: "Paytm", aliases: ["One97 Communications", "Paytm India"], website: "https://paytm.com", description: "Fintech and payments. Base-heavy, conservative equity.", archetype: "high_base", tier: 0.85, locations: ["delhi-ncr", "mumbai"], ladder: indianLadder },
  { id: "phonepe", name: "PhonePe", aliases: ["PhonePe India"], website: "https://phonepe.com", description: "UPI payments. Cash-focused with ESOP upside.", archetype: "high_base", tier: 0.95, locations: ["bengaluru"], ladder: indianLadder },
  { id: "razorpay", name: "Razorpay", aliases: ["Razorpay Software", "Razorpay India"], website: "https://razorpay.com", description: "Payments infrastructure. Balanced, fast growth.", archetype: "balanced", tier: 1.0, locations: ["bengaluru"], ladder: indianLadder },
  { id: "zerodha", name: "Zerodha", aliases: ["Zerodha Broking"], website: "https://zerodha.com", description: "Discount broker. Famously cash-only, no ESOPs, high base.", archetype: "cash_heavy", tier: 0.9, locations: ["bengaluru"], ladder: indianLadder },
  { id: "cred", name: "CRED", aliases: ["Dreamplug"], website: "https://cred.club", description: "Fintech rewards. Equity-heavy with high burn-era grants.", archetype: "high_equity", tier: 1.05, locations: ["bengaluru"], ladder: indianLadder },
  { id: "meesho", name: "Meesho", aliases: ["Fashnear Technologies"], website: "https://meesho.com", description: "Social e-commerce. Balanced, ESOP-heavy history.", archetype: "balanced", tier: 0.9, locations: ["bengaluru"], ladder: indianLadder },
  { id: "groww", name: "Groww", aliases: ["Nextbillion Technology"], website: "https://groww.in", description: "Investing platform. Balanced with equity upside.", archetype: "balanced", tier: 0.92, locations: ["bengaluru", "mumbai"], ladder: indianLadder },
  { id: "postman", name: "Postman", aliases: ["Postman Inc", "Postman India"], website: "https://postman.com", description: "API platform. Balanced with strong equity.", archetype: "balanced", tier: 1.0, locations: ["bengaluru", "sf-bay-area"], ladder: uberLadder },
  { id: "zoho", name: "Zoho", aliases: ["Zoho Corp", "Zoho Corporation"], website: "https://zoho.com", description: "Bootstrapped SaaS. Cash-only, no outside equity culture.", archetype: "cash_heavy", tier: 0.85, locations: ["chennai"], ladder: indianLadder },
  { id: "freshworks", name: "Freshworks", aliases: ["Freshdesk", "Freshworks Inc"], website: "https://freshworks.com", description: "Customer engagement SaaS. Balanced with public-company equity.", archetype: "balanced", tier: 0.88, locations: ["chennai"], ladder: indianLadder },
  { id: "goldman-sachs", name: "Goldman Sachs", aliases: ["Goldman Sachs Services", "GS", "Goldman"], website: "https://goldmansachs.com", description: "Investment bank with a large engineering org. Bonus-heavy, title-driven ladder.", archetype: "high_bonus", tier: 1.05, locations: ["bengaluru", "hyderabad", "new-york"], ladder: bankLadder },
  { id: "jpmorgan", name: "JPMorgan Chase", aliases: ["JP Morgan", "JPMC", "J.P. Morgan"], website: "https://jpmorganchase.com", description: "Global bank; one of the largest tech employers in India. Base-heavy with annual bonus.", archetype: "high_bonus", tier: 0.98, locations: ["bengaluru", "hyderabad", "mumbai", "new-york"], ladder: bankLadder },
  { id: "morgan-stanley", name: "Morgan Stanley", aliases: ["MS", "Morgan Stanley Advantage Services"], website: "https://morganstanley.com", description: "Investment bank. Cash-heavy compensation with performance bonus.", archetype: "high_bonus", tier: 1.0, locations: ["bengaluru", "mumbai", "new-york"], ladder: bankLadder },
  { id: "qualcomm", name: "Qualcomm", aliases: ["Qualcomm India", "Qualcomm Inc"], website: "https://qualcomm.com", description: "Wireless semiconductors. Balanced packages, strong hardware/embedded roles.", archetype: "balanced", tier: 1.0, locations: ["bengaluru", "hyderabad", "chennai"], ladder: genericLadder },
  { id: "texas-instruments", name: "Texas Instruments", aliases: ["TI", "Texas Instruments India"], website: "https://ti.com", description: "Analog semiconductors. Base-heavy, low variance, long tenures.", archetype: "high_base", tier: 0.9, locations: ["bengaluru"], ladder: genericLadder },
  { id: "tcs", name: "Tata Consultancy Services", aliases: ["TCS", "Tata Consultancy", "TCS Digital"], website: "https://tcs.com", description: "India's largest IT services firm. Cash-only, standardized bands, below product-company market.", archetype: "cash_heavy", tier: 0.42, locations: ["bengaluru", "pune", "chennai", "hyderabad", "kolkata"], ladder: servicesLadder },
  { id: "infosys", name: "Infosys", aliases: ["Infosys Ltd", "Infosys Technologies"], website: "https://infosys.com", description: "IT services and consulting. Cash-only bands with variable pay.", archetype: "cash_heavy", tier: 0.44, locations: ["bengaluru", "pune", "hyderabad", "chennai"], ladder: servicesLadder },
  { id: "wipro", name: "Wipro", aliases: ["Wipro Ltd", "Wipro Technologies"], website: "https://wipro.com", description: "IT services. Cash-only standardized bands.", archetype: "cash_heavy", tier: 0.4, locations: ["bengaluru", "pune", "hyderabad"], ladder: servicesLadder },
  { id: "accenture", name: "Accenture", aliases: ["Accenture India", "Accenture Solutions"], website: "https://accenture.com", description: "Consulting and technology services. Cash-heavy with variable bonus.", archetype: "cash_heavy", tier: 0.5, locations: ["bengaluru", "pune", "mumbai", "delhi-ncr"], ladder: servicesLadder },
  { id: "deloitte", name: "Deloitte", aliases: ["Deloitte USI", "Deloitte Consulting"], website: "https://deloitte.com", description: "Professional services; large US-India engineering footprint. Cash-heavy.", archetype: "cash_heavy", tier: 0.55, locations: ["hyderabad", "bengaluru", "delhi-ncr"], ladder: servicesLadder },
  { id: "shopify", name: "Shopify", aliases: ["Shopify Inc"], website: "https://shopify.com", description: "Commerce platform, remote-first. Flexible cash/equity split.", archetype: "balanced", tier: 1.05, locations: ["new-york", "austin"], ladder: uberLadder },
  { id: "twilio", name: "Twilio", aliases: ["Twilio Inc", "Twilio India"], website: "https://twilio.com", description: "Communications APIs. Equity-leaning, strong Bengaluru office.", archetype: "high_equity", tier: 1.0, locations: ["bengaluru", "sf-bay-area"], ladder: uberLadder },
];

/**
 * Role-specific pay multipliers applied on top of level × company × location.
 * Reflects broadly observed market premia (ML/data premium, management
 * premium, QA discount). Synthetic — tuned for internal coherence, not
 * presented as measured market data.
 */
const ROLE_MULTIPLIER: Record<string, number> = {
  "ML Engineer": 1.12,
  "Research Scientist": 1.15,
  "Data Scientist": 1.06,
  "Data Engineer": 1.02,
  "Analytics Engineer": 0.98,
  "Security Engineer": 1.05,
  "Site Reliability Engineer": 1.03,
  "Platform Engineer": 1.02,
  "Infrastructure Engineer": 1.0,
  "DevOps Engineer": 0.95,
  "Mobile Engineer": 1.0,
  "Frontend Engineer": 0.97,
  "Backend Engineer": 1.02,
  "Full Stack Engineer": 0.99,
  "Systems Engineer": 1.01,
  "Solutions Architect": 1.04,
  "QA Engineer": 0.82,
  "Engineering Manager": 1.22,
  "Product Manager": 1.08,
};

/* ------------------------- comp tables (annual) ---------------------- */

const INR_BASE: Record<string, number> = {
  c1: 1_100_000, c2: 1_700_000, c3: 2_500_000, c4: 3_700_000, c5: 5_100_000,
  c6: 6_900_000, c7: 9_400_000, c8: 12_500_000, c9: 16_000_000, c10: 21_000_000,
};
const USD_BASE: Record<string, number> = {
  c1: 95_000, c2: 125_000, c3: 160_000, c4: 195_000, c5: 235_000,
  c6: 280_000, c7: 325_000, c8: 375_000, c9: 430_000, c10: 490_000,
};
const EXPERIENCE_BAND: Record<string, [number, number]> = {
  c1: [0, 1], c2: [1, 3], c3: [2, 4], c4: [4, 6], c5: [6, 8],
  c6: [8, 11], c7: [10, 14], c8: [13, 17], c9: [16, 20], c10: [18, 24],
};

/* ------------------------------ seeding ------------------------------ */

async function seed() {
  console.log("[seed] starting…");

  // Users (one demo account for the authenticated submission flow).
  const demoEmail = "demo@compscope.dev";
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({
      id: "user_demo",
      email: demoEmail,
      name: "Demo Contributor",
      passwordHash: hashPassword("demo1234"),
    });
    console.log("[seed] demo user created → demo@compscope.dev / demo1234");
  }

  // Canonical levels
  for (const level of LEVELS) {
    await db.insert(canonicalLevels).values(level).onConflictDoNothing();
  }

  // Locations + aliases
  for (const loc of LOCATIONS) {
    await db
      .insert(locations)
      .values({
        id: loc.id,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        normalizedName: loc.normalizedName,
        slug: loc.id,
        currency: loc.currency,
      })
      .onConflictDoNothing();
    // Location aliases (bangalore, bombay, gurgaon, …) are resolved in code by
    // lib/normalization/location.ts — they are NOT separate location entities.
  }

  // Role families + roles
  const roleIds = new Map<string, string>();
  const roleFamilyByRole = new Map<string, string>();
  for (const family of ROLE_FAMILIES) {
    await db
      .insert(roleFamilies)
      .values({ id: family.id, name: family.name, normalizedName: family.name.toLowerCase(), slug: family.id, description: family.description })
      .onConflictDoNothing();
    for (const roleName of family.roles) {
      const roleId = `role_${roleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      roleIds.set(roleName, roleId);
      roleFamilyByRole.set(roleName, family.id);
      await db
        .insert(roles)
        .values({ id: roleId, roleFamilyId: family.id, name: roleName, normalizedName: roleName.toLowerCase() })
        .onConflictDoNothing();
    }
  }

  // Companies + aliases + company levels
  for (const c of COMPANIES) {
    const normalized = normalizeCompanyText(c.name);
    await db
      .insert(companies)
      .values({
        id: c.id,
        canonicalName: c.name,
        normalizedName: normalized,
        slug: c.id,
        website: c.website,
        description: c.description,
      })
      .onConflictDoNothing();
    const aliasSet = new Set([...c.aliases, c.name]);
    for (const alias of aliasSet) {
      const normAlias = normalizeCompanyText(alias);
      if (!normAlias || normAlias === normalized) continue;
      await db
        .insert(companyAliases)
        .values({
          id: `alias_${c.id}_${normAlias.replace(/[^a-z0-9]+/g, "_")}`,
          companyId: c.id,
          alias,
          normalizedAlias: normAlias,
        })
        .onConflictDoNothing();
    }
    for (const [levelName, canonicalId] of Object.entries(c.ladder)) {
      await db
        .insert(companyLevels)
        .values({
          id: `cl_${c.id}_${levelName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          companyId: c.id,
          canonicalLevelId: canonicalId,
          companyLevelName: levelName,
          normalizedCompanyLevelName: normalizeLevelText(levelName),
        })
        .onConflictDoNothing();
    }
  }

  // Compensation — insert only when empty (idempotent, no uncontrolled dupes).
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(compensation);
  if (existingCount > 0) {
    console.log(`[seed] compensation already has ${existingCount} rows — skipping generation.`);
    console.log("[seed] done.");
    return;
  }

  console.log("[seed] generating compensation records…");
  const now = Date.now();
  const rows: Array<Record<string, unknown>> = [];
  const TECH_ROLES = [
    "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
    "Mobile Engineer", "Systems Engineer", "Data Scientist", "Data Engineer", "ML Engineer",
    "Analytics Engineer", "DevOps Engineer", "Site Reliability Engineer", "Platform Engineer",
    "Infrastructure Engineer", "QA Engineer", "Security Engineer", "Engineering Manager",
    "Product Manager", "Solutions Architect",
  ];

  for (const c of COMPANIES) {
    const mix = ARCHETYPE_MIX[c.archetype];
    for (const locId of c.locations) {
      const loc = LOCATIONS.find((l) => l.id === locId)!;
      const baseTable = loc.currency === "INR" ? INR_BASE : USD_BASE;
      for (const [levelName, canonicalId] of Object.entries(c.ladder)) {
        const baseTarget = (baseTable[canonicalId] ?? INR_BASE.c4) * c.tier * loc.factor;
        const totalTarget = baseTarget / mix.base;
        const stockTarget = totalTarget * mix.stock;
        const bonusTarget = totalTarget * mix.bonus;
        const [expMin, expMax] = EXPERIENCE_BAND[canonicalId] ?? [3, 6];

        // Deterministic role selection: SWE + 2-3 others, shuffled by PRNG.
        const shuffled = [...TECH_ROLES].sort(() => rand() - 0.5);
        const chosen = ["Software Engineer", ...shuffled.slice(0, int(2, 3))];
        const uniqueChosen = [...new Set(chosen)].slice(0, 4);

        for (const roleName of uniqueChosen) {
          const roleId = roleIds.get(roleName);
          if (!roleId) continue;
          const roleMult = ROLE_MULTIPLIER[roleName] ?? 1;
          const nRecords = int(2, 3);
          for (let i = 0; i < nRecords; i++) {
            const variance = 0.82 + rand() * 0.36; // ±18%
            const baseSalary = Math.round(baseTarget * roleMult * variance);
            // Stock and bonus vary semi-independently of base (grants/perf differ).
            const annualStock = Math.round(stockTarget * roleMult * (0.75 + rand() * 0.5));
            const annualBonus = Math.round(bonusTarget * roleMult * (0.7 + rand() * 0.6));
            const totalCompensation = baseSalary + annualStock + annualBonus;
            const yearsExperience = Math.max(0, Math.min(expMax, expMin + int(0, Math.max(1, expMax - expMin))));
            const yearsAtCompany = Math.min(yearsExperience, int(1, Math.max(1, yearsExperience)));
            const reportedAt = new Date(now - int(0, 540) * 86_400_000);

            rows.push({
              id: randomBytes(12).toString("hex"),
              companyId: c.id,
              roleFamilyId: roleFamilyByRole.get(roleName) ?? "software-engineering",
              roleId,
              canonicalLevelId: canonicalId,
              companyLevelId: `cl_${c.id}_${levelName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
              locationId: loc.id,
              baseSalary,
              annualBonus,
              annualStock,
              totalCompensation,
              currency: loc.currency,
              yearsExperience,
              yearsAtCompany,
              employmentType: rand() < 0.94 ? "full_time" : "contract",
              sourceType: "self_reported",
              sourceReference: null,
              notes: null,
              reportedAt,
              verificationStatus: "unverified",
              dedupeKey: generateDedupeKey({
                companyId: c.id,
                roleId,
                companyLevelId: `cl_${c.id}_${levelName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
                locationId: loc.id,
                baseSalary,
                annualBonus,
                annualStock,
                yearsExperience,
                reportedMonth: reportedMonth(reportedAt),
              }),
              submittedBy: null,
            });
          }
        }
      }
    }
  }

  // Chunked insert to keep statement sizes sane.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(compensation).values(rows.slice(i, i + CHUNK) as never);
    console.log(`[seed]   inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log(`[seed] done. ${rows.length} synthetic compensation records (unverified demo data).`);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
