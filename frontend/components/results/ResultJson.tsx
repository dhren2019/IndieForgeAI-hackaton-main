import React from "react";
import { highlightJSON } from "../../lib/formatters";

interface ResultJsonProps {
  data: Record<string, unknown>;
}

export function ResultJson({ data }: ResultJsonProps) {
  return (
    <div
      className="result-json"
      dangerouslySetInnerHTML={{ __html: highlightJSON(JSON.stringify(data, null, 2)) }}
    />
  );
}
