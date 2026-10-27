// Password rules shown as a live checklist on Create password and Change password.
export const passwordRules = (password, confirm) => [
  { label: "At least 8 characters", ok: password.length >= 8 },
  { label: "A letter and a number", ok: /[a-z]/i.test(password) && /\d/.test(password) },
  { label: "Both passwords match", ok: password.length > 0 && password === confirm },
];
