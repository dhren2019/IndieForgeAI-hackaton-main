import React from "react";

interface FieldProps {
  label:        string;
  name:         string;
  type:         "text" | "select" | "textarea";
  placeholder?: string;
  options?:     string[];
  value:        string;
  onChange:     (value: string) => void;
}

export function PromptField({ label, name, type, placeholder, options, value, onChange }: FieldProps) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={name}>{label}</label>
      {type === "select" ? (
        <select
          id={name}
          className="form-field__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— elige —</option>
          {options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea
          id={name}
          className="form-field__textarea"
          placeholder={placeholder}
          value={value}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={name}
          className="form-field__input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
