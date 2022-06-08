import os from "os";
export const envOverrides: string[] = [];

/**
 * Override a value with supplied environment variable if present. A function
 * that returns the environment variable in an acceptable format can be
 * proivded. If it throws an error, the default value will be used.
 */
export function envOverride(
  envname: string,
  value: string,
  coerce?: (value: string, defaultValue: string) => any
): string {
  const currentEnvValue = process.env[envname];
  if (currentEnvValue && currentEnvValue.length) {
    envOverrides.push(envname);
    if (coerce) {
      try {
        return coerce(currentEnvValue, value);
      } catch (e: any) {
        return value;
      }
    }
    return currentEnvValue;
  }
  return value;
}

export const homedir = os.homedir();
export const tempdir = os.tmpdir();
