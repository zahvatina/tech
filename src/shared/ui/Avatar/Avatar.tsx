import React from 'react';
import { AvatarRoot, AvatarEmpty, StackRoot, StackExtra } from './Avatar.styled';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarUser {
  init: string;
  color: string;
  textColor?: string;
}

export interface AvatarProps {
  user?: AvatarUser | null;
  size?: AvatarSize;
}

export function Avatar({ user, size = 'md' }: AvatarProps) {
  if (!user) {
    return <AvatarEmpty $size={size}>·</AvatarEmpty>;
  }
  return (
    <AvatarRoot
      $size={size}
      $bg={user.color}
      $color={user.textColor ?? 'oklch(0.18 0.02 250)'}
    >
      {user.init}
    </AvatarRoot>
  );
}

export interface AvatarStackProps {
  users: AvatarUser[];
  max?: number;
  size?: AvatarSize;
}

export function AvatarStack({ users, max = 3, size = 'sm' }: AvatarStackProps) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;

  return (
    <StackRoot>
      {shown.map((u, i) => (
        <Avatar key={i} user={u} size={size} />
      ))}
      {extra > 0 && (
        <StackExtra $size={size} $bg="var(--bg-elev-2)" $color="var(--fg-mute)">
          +{extra}
        </StackExtra>
      )}
    </StackRoot>
  );
}
