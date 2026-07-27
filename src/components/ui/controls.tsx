'use client';

import type { ChangeEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/** Labelled select for filter bars. An empty value means "all". */
export function SelectField({
  label,
  value,
  options,
  allLabel = 'All',
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  allLabel?: string;
  onChange: (value: string) => void;
}) {
  const handle = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="select" value={value} onChange={handle}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchField({
  label = 'Search',
  value,
  placeholder,
  onChange,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="search"
        className="input search-input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="input"
        style={{ width: 110 }}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/** Sortable column header button. */
export function SortHeader({
  label,
  active,
  direction,
  onSort,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      className="sort-button"
      onClick={onSort}
      aria-label={`Sort by ${label}${active ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
    >
      {label}
      <span className="sort-arrow" aria-hidden>
        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
}
