import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import { render, screen } from '@/test/test-utils';
import { describe, expect, it } from 'vitest';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import { SkillCard } from './SkillCard';

describe('SkillCard', () => {
  it('reuses the explore card chrome with ActionMenu and provider tags', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((entry) => entry.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    render(
      <SkillCard
        skill={skill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
      />,
    );

    const card = screen.getByText('find-skills').closest('[data-slot="card"]');
    expect(card).toBeTruthy();
    expect(card).toHaveClass('ring-1');

    expect(screen.getByText('Find and install agent skills')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Installed' })).toBeInTheDocument();

    const footer = card?.querySelector('[data-slot="card-footer"]');
    expect(footer).toBeTruthy();
    expect(footer).toContainElement(screen.getByLabelText('Universal'));
    expect(footer).toContainElement(screen.getByText('+1'));

    expect(
      screen.queryByRole('button', { name: /Open find-skills on skills\.sh/i }),
    ).not.toBeInTheDocument();
  });
});
