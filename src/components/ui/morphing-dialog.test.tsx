import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { render, screen, waitFor } from '@/test/test-utils';
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogDescription,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from './morphing-dialog';

function DemoDialog() {
  return (
    <MorphingDialog>
      <MorphingDialogTrigger>Open skill</MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent>
          <MorphingDialogTitle>Skill title</MorphingDialogTitle>
          <MorphingDialogDescription>Skill description</MorphingDialogDescription>
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}

describe('MorphingDialog', () => {
  beforeEach(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterEach(() => {
    MotionGlobalConfig.skipAnimations = false;
  });
  it('opens dialog content in a portal when the trigger is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<DemoDialog />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open skill/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(document.body.contains(dialog)).toBe(true);
    expect(container.contains(dialog)).toBe(false);
    expect(screen.getByText('Skill title')).toBeInTheDocument();
    expect(screen.getByText('Skill description')).toBeInTheDocument();
  });

  it('marks the trigger as expanded while open', async () => {
    const user = userEvent.setup();
    render(<DemoDialog />);

    const trigger = screen.getByRole('button', { name: /open skill/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<DemoDialog />);

    await user.click(screen.getByRole('button', { name: /open skill/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup();
    render(<DemoDialog />);

    await user.click(screen.getByRole('button', { name: /open skill/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close dialog/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
