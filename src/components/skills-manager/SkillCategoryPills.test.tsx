import { render, screen } from '@/test/test-utils';
import { describe, expect, it } from 'vitest';
import { SkillCategoryPills } from './SkillCategoryPills';

describe('SkillCategoryPills', () => {
  it('renders the primary category first, with its icon', () => {
    const { container } = render(
      <SkillCategoryPills categories={['cli-utilities', 'git-github']} />,
    );

    const pills = [...container.querySelectorAll('[data-category]')];
    expect(pills.map((pill) => pill.getAttribute('data-category'))).toEqual([
      'cli-utilities',
      'git-github',
    ]);
    expect(pills[0]).toHaveTextContent('CLI Utilities');
    expect(pills[0]?.querySelector('svg')).toBeInTheDocument();
  });

  it('drops slugs outside the taxonomy', () => {
    render(<SkillCategoryPills categories={['not-a-slug', 'gaming']} />);

    expect(screen.getByText('Gaming')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-category]')).toHaveLength(1);
  });

  it('renders nothing for a skill without categories', () => {
    const { container } = render(<SkillCategoryPills categories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
