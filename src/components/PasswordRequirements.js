import React from "react";
import { passwordRequirements, PASSWORD_SPECIALS } from "../utils/passwordPolicy";

export default function PasswordRequirements({ password }) {
  const rules = passwordRequirements(password);
  return <div id="password-requirements" className="password-requirements">
    <p>Пароль должен содержать:</p>
    <ul>{rules.map(rule => <li key={rule.id} data-rule={rule.id} className={rule.valid ? "is-valid" : "is-unmet"}>
      <span aria-hidden="true" className="password-rule-icon">{rule.valid ? "✓" : "○"}</span>
      <span><span className="password-sr-only">{rule.valid ? "Выполнено: " : "Не выполнено: "}</span>{rule.label}</span>
    </li>)}</ul>
    <details><summary>Допустимые специальные символы</summary><code>{PASSWORD_SPECIALS}</code></details>
    <span className="password-sr-only" role="status" aria-live="polite">Выполнено условий: {rules.filter(rule => rule.valid).length} из {rules.length}.</span>
  </div>;
}
