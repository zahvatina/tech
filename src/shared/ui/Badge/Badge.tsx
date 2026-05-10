import React from 'react';
import { BadgeRoot, BadgeDot } from './Badge.styled';

export type BadgeTone = 'critical' | 'high' | 'med' | 'low' | 'ok' | 'info' | 'mute' | 'warning';

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
}

export function Badge({ tone = 'mute', dot = false, children }: BadgeProps) {
  return (
    <BadgeRoot $tone={tone}>
      {dot && <BadgeDot />}
      {children}
    </BadgeRoot>
  );
}
