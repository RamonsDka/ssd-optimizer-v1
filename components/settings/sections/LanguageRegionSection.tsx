"use client";

// ─── LanguageRegionSection (4.2.1) ────────────────────────────────────────────
// Settings section for Language & Region preferences.
// Uses:
//   - useLanguage() for language selection (persisted in LanguageProvider)
//   - useUIPreferences() for timezone selection (persisted in localStorage)

import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsSelect } from "@/components/settings/controls/SettingsSelect";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useUIPreferences } from "@/lib/hooks/useUIPreferences";
import type { SelectOption } from "@/components/settings/controls/SettingsSelect";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

// Common IANA timezones — curated list for practical UX
const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: "UTC",                      label: "UTC" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART, UTC-3)" },
  { value: "America/New_York",         label: "New York (ET, UTC-5/-4)" },
  { value: "America/Chicago",          label: "Chicago (CT, UTC-6/-5)" },
  { value: "America/Denver",           label: "Denver (MT, UTC-7/-6)" },
  { value: "America/Los_Angeles",      label: "Los Angeles (PT, UTC-8/-7)" },
  { value: "America/Sao_Paulo",        label: "São Paulo (BRT, UTC-3)" },
  { value: "America/Mexico_City",      label: "Mexico City (CST, UTC-6/-5)" },
  { value: "America/Bogota",           label: "Bogotá (COT, UTC-5)" },
  { value: "America/Santiago",         label: "Santiago (CLT, UTC-4/-3)" },
  { value: "Europe/London",            label: "London (GMT/BST, UTC+0/+1)" },
  { value: "Europe/Paris",             label: "Paris (CET, UTC+1/+2)" },
  { value: "Europe/Berlin",            label: "Berlin (CET, UTC+1/+2)" },
  { value: "Europe/Madrid",            label: "Madrid (CET, UTC+1/+2)" },
  { value: "Asia/Tokyo",               label: "Tokyo (JST, UTC+9)" },
  { value: "Asia/Shanghai",            label: "Shanghai (CST, UTC+8)" },
  { value: "Asia/Kolkata",             label: "Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Dubai",               label: "Dubai (GST, UTC+4)" },
  { value: "Australia/Sydney",         label: "Sydney (AEST, UTC+10/+11)" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LanguageRegionSection() {
  const { lang, setLanguage } = useLanguage();
  const { preferences, setTimezone } = useUIPreferences();

  return (
    <SettingsSection
      title="Language & Region"
      description="Interface language and timezone for date/time display."
      accent="secondary"
    >
      <div className="border border-outline-variant/20 bg-surface-container-low px-6">
        <SettingsSelect
          id="language-select"
          label="Interface Language"
          description="Applies to all UI labels, tooltips and messages."
          value={lang}
          onChange={(val) => setLanguage(val as "es" | "en")}
          options={LANGUAGE_OPTIONS}
        />
        <SettingsSelect
          id="timezone-select"
          label="Timezone"
          description="Used for date and time display across the interface."
          value={preferences.timezone}
          onChange={setTimezone}
          options={TIMEZONE_OPTIONS}
        />
      </div>
    </SettingsSection>
  );
}
