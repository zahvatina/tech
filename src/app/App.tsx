import React from 'react';
import styled from 'styled-components';
import { Providers } from '@app/providers';
import { TOKEN } from '@app/styles/tokens';
import { Badge } from '@shared/ui';
import { Button } from '@shared/ui';
import { Icons } from '@shared/ui';

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <GlobalError message={this.state.error.message} />;
    }
    return this.props.children;
  }
}

function GlobalError({ message }: { message: string }) {
  return (
    <ErrorWrap>
      <ErrorBox>
        <ErrorTitle>Что-то пошло не так</ErrorTitle>
        <ErrorDetail>{message}</ErrorDetail>
        <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
      </ErrorBox>
    </ErrorWrap>
  );
}

// ── Phase 1 placeholder ───────────────────────────────────────────────────────

/**
 * Temporary shell rendered during Phase 1.
 * Will be replaced by full router + feature screens in Phase 3.
 */
function Phase1Shell() {
  return (
    <ShellGrid>
      <SidebarPlaceholder>
        <Brand>
          <Mark>V</Mark>
          <span>Vector</span>
        </Brand>
        <NavSection>
          <NavLabel>Operations</NavLabel>
          {(['Dashboard', 'Problems', 'Triage queue', 'Bugs', 'Tickets'] as const).map(
            (label) => (
              <NavItem key={label}>{label}</NavItem>
            ),
          )}
        </NavSection>
        <NavSection>
          <NavLabel>Workspace</NavLabel>
          {(['РМО', 'Products', 'Teams', 'Insights'] as const).map((label) => (
            <NavItem key={label}>{label}</NavItem>
          ))}
        </NavSection>
      </SidebarPlaceholder>

      <MainArea>
        <Topbar>
          <TopbarCrumb>SBR Insurance / Dashboard</TopbarCrumb>
          <TopbarSpacer />
          <Button ghost icon={<Icons.search />}>Поиск</Button>
          <Button primary icon={<Icons.plus />}>Создать</Button>
        </Topbar>

        <Content>
          <PhaseCard>
            <PhaseTitle>Phase 1 — Фундамент</PhaseTitle>
            <PhaseDesc>Vite + TypeScript strict + styled-components</PhaseDesc>

            <BadgeRow>
              <Badge tone="ok" dot>Сборка работает</Badge>
              <Badge tone="info">TypeScript strict</Badge>
              <Badge tone="high">styled-components v6</Badge>
              <Badge tone="mute">CSS vars</Badge>
            </BadgeRow>

            <CheckList>
              {[
                'package.json — React 18, RTK, TanStack Table, RHF, Zod, styled-components',
                'vite.config.ts — абсолютные алиасы @app @pages @features @entities @shared',
                'tsconfig.json — strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes',
                'global.styled.ts — tokens.css → createGlobalStyle (677 строк)',
                'tokens.ts — CSS var refs как const для type-safe ссылок',
                'ErrorBoundary — изоляция краша на уровне приложения',
                'shared/ui — Icons, Badge, Button, Avatar, Sparkline',
              ].map((item) => (
                <CheckItem key={item}>
                  <Icons.check />
                  {item}
                </CheckItem>
              ))}
            </CheckList>

            <NextPhase>
              Следующая фаза: Redux store + RTK Query + Zod-схемы на границах API
            </NextPhase>
          </PhaseCard>
        </Content>
      </MainArea>
    </ShellGrid>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <Phase1Shell />
      </Providers>
    </ErrorBoundary>
  );
}

// ── Styled components ─────────────────────────────────────────────────────────

const ShellGrid = styled.div`
  display: grid;
  grid-template-columns: 232px 1fr;
  height: 100vh;
  width: 100vw;
`;

const SidebarPlaceholder = styled.aside`
  background: ${TOKEN.bg};
  border-right: 1px solid ${TOKEN.line};
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid ${TOKEN.lineSoft};
  font-weight: 600;
  font-size: 13px;
`;

const Mark = styled.span`
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: ${TOKEN.accent};
  color: ${TOKEN.accentInk};
  display: grid;
  place-items: center;
  font: 700 11px ${TOKEN.mono};
`;

const NavSection = styled.nav`
  padding: 10px 8px 4px;
`;

const NavLabel = styled.div`
  font: 500 10px ${TOKEN.mono};
  color: ${TOKEN.fgFaint};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 8px 6px;
`;

const NavItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: ${TOKEN.radius};
  color: ${TOKEN.fgMute};
  font-size: 13px;
  width: 100%;
  text-align: left;
  &:hover {
    background: ${TOKEN.bgElev};
    color: ${TOKEN.fg};
  }
`;

const MainArea = styled.div`
  display: grid;
  grid-template-rows: 44px 1fr;
  min-width: 0;
  overflow: hidden;
`;

const Topbar = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid ${TOKEN.line};
  background: ${TOKEN.bg};
`;

const TopbarCrumb = styled.span`
  color: ${TOKEN.fgMute};
  font-size: 12.5px;
`;

const TopbarSpacer = styled.div`
  flex: 1;
`;

const Content = styled.main`
  overflow: auto;
  padding: 32px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
`;

const PhaseCard = styled.div`
  background: ${TOKEN.panel};
  border: 1px solid ${TOKEN.line};
  border-radius: ${TOKEN.radiusLg};
  padding: 28px 32px;
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const PhaseTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${TOKEN.fg};
`;

const PhaseDesc = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${TOKEN.fgMute};
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const CheckList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CheckItem = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: ${TOKEN.fg};

  svg {
    color: ${TOKEN.ok};
    flex: none;
    width: 14px;
    height: 14px;
  }
`;

const NextPhase = styled.p`
  margin: 0;
  padding: 12px 14px;
  border-radius: ${TOKEN.radius};
  background: ${TOKEN.accentSoft};
  color: ${TOKEN.fg};
  font-size: 12.5px;
  border: 1px solid ${TOKEN.line};
`;

const ErrorWrap = styled.div`
  height: 100vh;
  display: grid;
  place-items: center;
  background: ${TOKEN.bg};
`;

const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
  padding: 32px;
  background: ${TOKEN.panel};
  border: 1px solid ${TOKEN.line};
  border-radius: ${TOKEN.radiusLg};
  max-width: 400px;
`;

const ErrorTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  color: ${TOKEN.fg};
`;

const ErrorDetail = styled.p`
  margin: 0;
  font-size: 12.5px;
  color: ${TOKEN.fgMute};
  font-family: ${TOKEN.mono};
`;
