// Printable ASCII punctuation, excluding spaces. Keep aligned with password_policy.py.
export const PASSWORD_SPECIALS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
export function passwordRequirements(password) {
  return [
    { id: "length", label: "От 8 до 64 символов", valid: password.length >= 8 && password.length <= 64 },
    { id: "uppercase", label: "Хотя бы одна заглавная латинская буква (A–Z)", valid: /[A-Z]/.test(password) },
    { id: "lowercase", label: "Хотя бы одна строчная латинская буква (a–z)", valid: /[a-z]/.test(password) },
    { id: "number", label: "Хотя бы одна цифра (0–9)", valid: /[0-9]/.test(password) },
    { id: "special", label: "Хотя бы один специальный символ", valid: [...password].some(char => PASSWORD_SPECIALS.includes(char)) },
    { id: "allowed", label: "Только латинские буквы, цифры и стандартные спецсимволы; без кириллицы", valid: /^[!-~]+$/.test(password) },
    { id: "spaces", label: "Без пробелов и других пробельных символов", valid: password.length > 0 && !/\s/.test(password) },
  ];
}
export const validNewPassword = password => passwordRequirements(password).every(rule => rule.valid);
