import { describe, expect, it } from 'vitest';
import {
  mapWeeklyInstallsToDates,
  parseCompactCount,
  parsePageSnapshot,
  resolveInstallSeries,
} from './page-snapshot.js';

const FIXTURE_HTML = `
<main>
  <h1>frontend-design</h1>
  <div class="flex flex-wrap gap-2 mb-4">
    <a href="/topic/design">Design &amp; UI</a>
  </div>
  <div>Installation</div>
  <code><span>$</span> npx skills add https://github.com/anthropics/skills --skill frontend-design</code>
  <div>Summary</div>
  <div class="prose"><p><strong>Distinctive frontend interfaces.</strong></p></div>
  <div><span>SKILL.md</span></div>
  <div class="prose"><h1>Frontend Design</h1><p>Approach this as the design lead.</p></div>
  <section>
    <div>Related skills</div>
    <ul>
      <li><a href="/vercel-labs/agent-skills/web-design-guidelines"><h3>web-design-guidelines</h3><p>Guidelines</p></a></li>
      <li><a href="/anthropics/skills/canvas-design"><h3>canvas-design</h3></a></li>
    </ul>
  </section>
  <div><span>Repository</span></div>
  <a href="https://github.com/anthropics/skills" title="anthropics/skills">anthropics/skills</a>
  <div><span>GitHub Stars</span></div>
  <div><span>162.7K</span></div>
  <div><span>First Seen</span></div>
  <div class="text-sm font-mono text-foreground">Jan 19, 2026</div>
  <svg role="img" aria-label="Weekly installs: 29,655, 28,343, 31,976, 29,131, 27,857, 26,134, 28,120, 26,218"></svg>
</main>
<script>self.__next_f.push([1,"InstallSparkline\\",null,{\\"values\\":[29655,28343,31976,29131,27857,26134,28120,26218],\\"className\\":\\"x\\"}])</script>
`;

describe('parsePageSnapshot', () => {
  it('extracts sparse fields from skills.sh HTML', () => {
    const snapshot = parsePageSnapshot(FIXTURE_HTML);
    expect(snapshot.summary).toBe('Distinctive frontend interfaces.');
    expect(snapshot.topics).toEqual(['Design & UI']);
    expect(snapshot.installCommand).toContain('npx skills add');
    expect(snapshot.repository).toBe('anthropics/skills');
    expect(snapshot.stars).toBe(162_700);
    expect(snapshot.firstSeen).toBe('Jan 19, 2026');
    expect(snapshot.weeklyInstalls).toEqual([
      29655, 28343, 31976, 29131, 27857, 26134, 28120, 26218,
    ]);
    expect(snapshot.skillMdPreview).toContain('Frontend Design');
    expect(snapshot.related).toEqual([
      {
        id: 'vercel-labs/agent-skills/web-design-guidelines',
        name: 'web-design-guidelines',
        description: 'Guidelines',
      },
      { id: 'anthropics/skills/canvas-design', name: 'canvas-design' },
    ]);
  });

  it('extracts Source for well-known skills without a Repository', () => {
    const html = `
      <div><span>Source</span></div>
      <a href="https://open.feishu.cn" title="open.feishu.cn">open.feishu.cn</a>
      <div><span>First Seen</span></div>
      <div>Apr 14, 2026</div>
    `;
    const snapshot = parsePageSnapshot(html);
    expect(snapshot.source).toBe('https://open.feishu.cn');
    expect(snapshot.repository).toBeUndefined();
  });

  it('prefers aria-label weekly series when RSC values are absent', () => {
    const html = `<svg aria-label="Weekly installs: 1, 2, 3, 4, 5, 6, 7, 8"></svg>`;
    expect(parsePageSnapshot(html).weeklyInstalls).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns an empty sparse object for blank HTML', () => {
    expect(parsePageSnapshot('')).toEqual({});
  });

  it('strips /site/ from related skill hrefs', () => {
    const html = `
      <section>
        <div>Related skills</div>
        <ul>
          <li><a href="/site/open.feishu.cn/lark-doc"><h3>lark-doc</h3></a></li>
          <li><a href="/anthropics/skills/frontend-design"><h3>frontend-design</h3></a></li>
        </ul>
      </section>
    `;
    expect(parsePageSnapshot(html).related).toEqual([
      { id: 'open.feishu.cn/lark-doc', name: 'lark-doc' },
      { id: 'anthropics/skills/frontend-design', name: 'frontend-design' },
    ]);
  });
});

describe('parseCompactCount', () => {
  it('parses K/M suffixes', () => {
    expect(parseCompactCount('162.7K')).toBe(162_700);
    expect(parseCompactCount('1.2M')).toBe(1_200_000);
    expect(parseCompactCount('42')).toBe(42);
    expect(parseCompactCount('nope')).toBeUndefined();
  });
});

describe('mapWeeklyInstallsToDates', () => {
  it('maps values[i] to scrape_date - (7 - i) in UTC', () => {
    const rows = mapWeeklyInstallsToDates(
      [10, 11, 12, 13, 14, 15, 16, 17],
      'owner/skill',
      new Date('2026-07-21T15:30:00.000Z'),
    );
    expect(rows).toEqual([
      { skillId: 'owner/skill', date: '2026-07-14', installs: 10 },
      { skillId: 'owner/skill', date: '2026-07-15', installs: 11 },
      { skillId: 'owner/skill', date: '2026-07-16', installs: 12 },
      { skillId: 'owner/skill', date: '2026-07-17', installs: 13 },
      { skillId: 'owner/skill', date: '2026-07-18', installs: 14 },
      { skillId: 'owner/skill', date: '2026-07-19', installs: 15 },
      { skillId: 'owner/skill', date: '2026-07-20', installs: 16 },
      { skillId: 'owner/skill', date: '2026-07-21', installs: 17 },
    ]);
  });

  it('caps weekly series at 8 values', () => {
    const rows = mapWeeklyInstallsToDates(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      'owner/skill',
      new Date('2026-07-21T00:00:00.000Z'),
    );
    expect(rows).toHaveLength(8);
    expect(rows[7]).toEqual({ skillId: 'owner/skill', date: '2026-07-21', installs: 8 });
  });
});

describe('resolveInstallSeries', () => {
  it('prefers scraped weekly installs when present', () => {
    expect(
      resolveInstallSeries(
        [10, 20, 30, 40, 50, 60, 70, 80],
        [
          { skillId: 'a', date: '2026-07-14', installs: 1 },
          { skillId: 'a', date: '2026-07-15', installs: 2 },
        ],
      ),
    ).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('falls back to last 8 install snapshots by date', () => {
    const snapshots = Array.from({ length: 10 }, (_, i) => ({
      skillId: 'a',
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      installs: i + 1,
    }));
    expect(resolveInstallSeries(undefined, snapshots)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('returns empty when neither source has data', () => {
    expect(resolveInstallSeries(undefined, [])).toEqual([]);
    expect(resolveInstallSeries([], [])).toEqual([]);
  });
});
