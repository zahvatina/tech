import styled, { css } from 'styled-components';
import type { ButtonVariant, ButtonTone } from './Button';

const variantMap: Record<ButtonVariant, ReturnType<typeof css>> = {
  default: css`
    background: var(--bg-elev);
    border: 1px solid var(--line);
    color: var(--fg);
    &:hover { background: var(--bg-hover); }
  `,
  primary: css`
    background: var(--accent);
    border: 1px solid transparent;
    color: var(--accent-ink);
    &:hover { filter: brightness(1.08); }
  `,
  ghost: css`
    background: transparent;
    border: 1px solid transparent;
    color: var(--fg-mute);
    &:hover { background: var(--bg-elev); color: var(--fg); }
  `,
  icon: css`
    background: transparent;
    border: 1px solid transparent;
    color: var(--fg-mute);
    padding: 5px;
    width: 28px;
    height: 28px;
    justify-content: center;
    &:hover { background: var(--bg-elev); color: var(--fg); }
  `,
};

const toneMap: Record<ButtonTone, ReturnType<typeof css>> = {
  default: css``,
  ok: css`
    background: var(--ok);
    border-color: transparent;
    color: oklch(0.14 0.02 150);
    &:hover { filter: brightness(1.08); }
  `,
  critical: css`
    background: var(--critical);
    border-color: transparent;
    color: oklch(0.98 0.02 25);
    &:hover { filter: brightness(1.08); }
  `,
};

export const ButtonRoot = styled.button<{
  $variant: ButtonVariant;
  $tone: ButtonTone;
}>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius);
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  flex: none;
  transition: background 0.1s, color 0.1s, filter 0.1s;

  svg.ico {
    width: 14px;
    height: 14px;
  }

  ${({ $variant }) => variantMap[$variant]}
  ${({ $tone }) => $tone !== 'default' && toneMap[$tone]}
`;

export const Kbd = styled.span`
  font: 500 10px var(--mono);
  color: var(--fg-dim);
  background: var(--bg-elev-2);
  border: 1px solid var(--line-soft);
  border-bottom-width: 2px;
  padding: 1px 5px;
  border-radius: 4px;
`;
