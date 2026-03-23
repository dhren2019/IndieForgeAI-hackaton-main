import React from "react";

interface Tab<T extends string> {
  id:    T;
  label: string;
  icon?: string;
}

interface TabsProps<T extends string> {
  tabs:     Tab<T>[];
  active:   T;
  onChange: (id: T) => void;
  variant?: "nav" | "sub";
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  variant = "nav",
}: TabsProps<T>) {
  return (
    <div className={`tabs tabs--${variant}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`tabs__tab ${active === tab.id ? "tabs__tab--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="tabs__icon">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
