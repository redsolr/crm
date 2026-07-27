"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useClickOutside } from "@/hooks/use-click-outside";

interface Country {
  code: string;
  name: string;
}

const COUNTRIES: Country[] = [
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MY", name: "Malaysia" },
  { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TH", name: "Thailand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
];

function flagUrl(code: string): string {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

function detectCountry(): string {
  if (typeof navigator === "undefined") return "US";
  const lang = navigator.language || "";
  const region = lang.split("-")[1]?.toUpperCase();
  if (region && COUNTRIES.some((c) => c.code === region)) return region;
  return "US";
}

interface CountrySelectProps {
  name?: string;
  testId?: string;
}

export function CountrySelect({
  name = "country",
  testId = "country-select",
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => {
    const code = detectCountry();
    return (
      COUNTRIES.find((c) => c.code === code) || COUNTRIES[COUNTRIES.length - 2]
    );
  });
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  return (
    <div ref={ref} className="relative">
      <label className="ctx-label">Country</label>
      <input type="hidden" name={name} value={selected.code} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ctx-input w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-[15px] cursor-pointer bg-white"
        data-testid={testId}
      >
        <span className="text-ctx-primary flex items-center gap-2.5">
          <Image
            src={flagUrl(selected.code)}
            alt={selected.name}
            width={20}
            height={14}
            className="w-5 h-3.5 object-cover rounded"
          />
          {selected.name}
        </span>
        <svg
          className="text-ctx-muted w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-[0_10px_40px_rgba(10,37,64,0.15)] max-h-64 overflow-y-auto border border-ctx-line">
          {COUNTRIES.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => {
                setSelected(country);
                setOpen(false);
              }}
              className="text-ctx-primary w-full flex items-center justify-between px-4 py-2 text-[14px] hover:bg-[#f6f9fc] cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Image
                  src={flagUrl(country.code)}
                  alt={country.name}
                  width={20}
                  height={14}
                  className="w-5 h-3.5 object-cover rounded"
                />
                {country.name}
              </span>
              {country.code === selected.code && (
                <svg
                  className="text-ctx-purple-accent w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
