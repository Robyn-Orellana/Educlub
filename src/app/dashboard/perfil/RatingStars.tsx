"use client";
import React from 'react';

type Props = {
  value: number; // 0..5
  size?: 'sm' | 'md';
};

export default function RatingStars({ value, size = 'md' }: Props) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const count = 5;
  const base = size === 'sm' ? 'text-sm' : 'text-lg';
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    if (i < full) stars.push(<span key={i} className={`${base} text-yellow-500`}>★</span>);
    else if (i === full && half) stars.push(<span key={i} className={`${base} text-yellow-500`}>☆</span>);
    else stars.push(<span key={i} className={`${base} text-gray-300`}>★</span>);
  }
  return <span aria-label={`Calificación ${value} de 5`}>{stars}</span>;
}
