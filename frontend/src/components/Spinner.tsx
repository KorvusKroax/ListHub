"use client";

import React from 'react';

export default function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  const style: React.CSSProperties = { width: size, height: size };
  return (
    <span
      className={`inline-block align-middle animate-spin rounded-full border-2 border-gray-400 border-t-transparent ${className}`}
      style={style}
      aria-label="loading"
    />
  );
}
