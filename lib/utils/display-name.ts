/**
 * Get display name from profile data
 * Prioritizes first_name + last_name, falls back to full_name
 */
export function getDisplayName(profile: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}): string {
  // Try first_name + last_name first
  const firstLast = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ");

  if (firstLast) {
    return firstLast;
  }

  // Fall back to full_name
  if (profile.full_name) {
    return profile.full_name;
  }

  // Fall back to email
  return profile.email || "Unknown";
}

/**
 * Get initials from profile data
 */
export function getInitials(profile: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}): string {
  // Try first_name + last_name first
  if (profile.first_name || profile.last_name) {
    const first = profile.first_name?.[0] || "";
    const last = profile.last_name?.[0] || "";
    return (first + last).toUpperCase() || profile.email?.[0].toUpperCase() || "?";
  }

  // Fall back to full_name
  if (profile.full_name) {
    return profile.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  // Fall back to email
  return profile.email?.[0].toUpperCase() || "?";
}

/**
 * Get first name for personalized greetings
 */
export function getFirstName(profile: {
  first_name?: string | null;
  full_name?: string | null;
}): string | null {
  if (profile.first_name) {
    return profile.first_name;
  }

  // Try to extract from full_name
  if (profile.full_name) {
    return profile.full_name.split(" ")[0];
  }

  return null;
}
