/**
 * hermes-home — R-055: HERMES_HOME warning helper.
 *
 * Hermes profiles are sticky globally (issue #18594). When HERMES_HOME is not
 * set, profile switching mid-session is impossible — a full Hermes restart is
 * required to change the active profile.
 *
 * The plugin bridge emits this warning at on_session_start so the operator
 * is informed immediately rather than discovering the limitation at switch time.
 *
 * Design source: SPEC-007-adapter-hermes.md §HIGH "Profils et HERMES_HOME".
 */

/** Warning message emitted when HERMES_HOME is absent. */
export const HERMES_HOME_WARNING =
  "[HIMA WARNING] HERMES_HOME is not set — profile switching mid-session is disabled.";

/**
 * hermesHomeWarning — check whether HERMES_HOME is defined in the given env record.
 *
 * @param env - A `Record<string, string | undefined>` (typically `process.env`).
 * @returns The warning string when HERMES_HOME is absent or empty; `null` when set.
 *
 * @example
 * // In the session_start handler:
 * const warning = hermesHomeWarning(process.env);
 * if (warning) trace.warn(warning);
 */
export function hermesHomeWarning(
  env: Record<string, string | undefined>,
): string | null {
  const value = env["HERMES_HOME"];
  if (value === undefined || value === "") {
    return HERMES_HOME_WARNING;
  }
  return null;
}
