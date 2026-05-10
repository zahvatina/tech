import styled, { css } from 'styled-components';
import type { AvatarSize } from './Avatar';

const sizeMap: Record<AvatarSize, ReturnType<typeof css>> = {
  sm: css`width: 18px; height: 18px; font-size: 9px;`,
  md: css`width: 22px; height: 22px; font-size: 10px;`,
  lg: css`width: 28px; height: 28px; font-size: 11px;`,
};

export const AvatarRoot = styled.span<{
  $size: AvatarSize;
  $bg: string;
  $color: string;
}>`
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  font: 600 10px var(--mono);
  letter-spacing: -0.02em;
  flex: none;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  ${({ $size }) => sizeMap[$size]}
`;

export const AvatarEmpty = styled.span<{ $size: AvatarSize }>`
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  font: 600 10px var(--mono);
  flex: none;
  background: var(--bg-elev-2);
  color: var(--fg-faint);
  border: 1px dashed var(--line);
  ${({ $size }) => sizeMap[$size]}
`;

export const StackRoot = styled.span`
  display: inline-flex;

  & > * {
    margin-left: -6px;
    border: 2px solid var(--bg);
  }
  & > *:first-child {
    margin-left: 0;
  }
`;

export const StackExtra = styled(AvatarRoot)`
  background: var(--bg-elev-2);
  color: var(--fg-mute);
`;
