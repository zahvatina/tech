import React from 'react';
import { ButtonRoot, Kbd } from './Button.styled';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'icon';
export type ButtonTone = 'default' | 'ok' | 'critical';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  /** Leading icon element */
  icon?: React.ReactNode;
  /** Keyboard shortcut label rendered after text */
  kbd?: string;
  primary?: boolean;
  ghost?: boolean;
}

export function Button({
  variant,
  tone = 'default',
  icon,
  kbd,
  primary,
  ghost,
  children,
  ...rest
}: ButtonProps) {
  // Convenience aliases: primary/ghost props → variant
  const resolvedVariant: ButtonVariant =
    variant ?? (primary ? 'primary' : ghost ? 'ghost' : 'default');

  return (
    <ButtonRoot $variant={resolvedVariant} $tone={tone} {...rest}>
      {icon}
      {children}
      {kbd && <Kbd>{kbd}</Kbd>}
    </ButtonRoot>
  );
}
