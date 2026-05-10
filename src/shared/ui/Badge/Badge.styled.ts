import styled, { css } from 'styled-components';
import type { BadgeTone } from './Badge';

const toneMap: Record<BadgeTone, ReturnType<typeof css>> = {
  critical: css`color: var(--critical); background: var(--critical-bg);`,
  high:     css`color: var(--high);     background: var(--high-bg);`,
  med:      css`color: var(--med);      background: var(--med-bg);`,
  low:      css`color: var(--low);      background: var(--low-bg);`,
  ok:       css`color: var(--ok);       background: var(--ok-bg);`,
  info:     css`color: var(--info);     background: var(--info-bg);`,
  mute:     css`color: var(--fg-mute);  background: var(--bg-elev-2);`,
  warning:  css`color: var(--med);      background: var(--med-bg);`,
};

export const BadgeRoot = styled.span<{ $tone: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  border-radius: 4px;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.5;
  ${({ $tone }) => toneMap[$tone]}
`;

export const BadgeDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
`;
