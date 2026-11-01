export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type PasswordCheckId = "length" | "lower" | "upper" | "digit" | "symbol";
export type PasswordCheck = { id: PasswordCheckId; label: string; ok: boolean };

/** Requisitos de una contraseña nueva: largo, minúscula, mayúscula, número y símbolo (cualquier carácter que no sea letra ni número). */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: "length", label: `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: "lower", label: "Una letra minúscula", ok: /\p{Ll}/u.test(password) },
    { id: "upper", label: "Una letra mayúscula", ok: /\p{Lu}/u.test(password) },
    { id: "digit", label: "Un número", ok: /\d/.test(password) },
    { id: "symbol", label: "Un símbolo (por ejemplo ! # $ - _)", ok: /[^\p{L}\d]/u.test(password) },
  ];
}

export const isStrongPassword = (password: string) => passwordChecks(password).every((check) => check.ok);

/** Mensaje único para cuando una contraseña nueva no cumple; nulo si cumple. */
export function passwordProblem(password: string): string | null {
  return isStrongPassword(password) ? null : `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres, con mayúscula, minúscula, número y símbolo.`;
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** Fuerza orientativa para el medidor: cuántos requisitos cumple y, si cumple todos, si además es larga (12 o más). */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "" };
  const met = passwordChecks(password).filter((check) => check.ok).length;
  const long = password.length >= 12;
  const score = (met <= 2 ? 1 : met === 3 ? 2 : met === 4 ? 3 : long ? 4 : 3) as 1 | 2 | 3 | 4;
  return { score, label: ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"][score] ?? "" };
}

// Sin caracteres que se confunden al leerlos (l, I, 1, O, 0) para que la contraseña se pueda copiar o dictar sin errores.
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!#$%&*+-=?@_";

function randomInt(max: number): number {
  // Muestreo por rechazo: reparte parejo, sin el sesgo del módulo.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0]! >= limit);
  return buffer[0]! % max;
}

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)]!;

/** Contraseña aleatoria con al menos una minúscula, una mayúscula, un número y un símbolo, generada con el generador seguro del navegador. */
export function generateStrongPassword(length = 16): string {
  const size = Math.min(Math.max(length, 12), PASSWORD_MAX);
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
