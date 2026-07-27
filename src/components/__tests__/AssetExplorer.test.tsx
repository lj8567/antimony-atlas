import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetExplorer } from '@/components/assets/AssetExplorer';
import { costerfield, makeAsset } from '@/test/fixtures';

const replaceMock = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => '/assets',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const items = [makeAsset(), costerfield];

describe('AssetExplorer', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    currentSearch = '';
  });

  it('renders assets with metrics, provenance and confidence', () => {
    render(<AssetExplorer items={items} />);
    expect(screen.getByRole('link', { name: 'Stibnite Gold Project' })).toHaveAttribute(
      'href',
      '/assets/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText('Costerfield Operation')).toBeInTheDocument();
    // metric keeps qualifiers
    expect(screen.getByText('12,300 t contained Sb')).toBeInTheDocument();
    expect(screen.getByText(/Projected recovered antimony/)).toBeInTheDocument();
    // missing metric is labelled, not zeroed
    expect(screen.getByText('Not yet researched')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 assets')).toBeInTheDocument();
  });

  it('pushes filter changes into the URL', () => {
    render(<AssetExplorer items={items} />);
    fireEvent.change(screen.getByPlaceholderText('Asset, region, country, owner…'), {
      target: { value: 'stibnite' },
    });
    expect(replaceMock).toHaveBeenCalledWith('/assets?q=stibnite', { scroll: false });
  });

  it('applies filters read from the URL', () => {
    currentSearch = 'country=AUS';
    render(<AssetExplorer items={items} />);
    expect(screen.queryByText('Stibnite Gold Project')).not.toBeInTheDocument();
    expect(screen.getByText('Costerfield Operation')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 assets · 1 filter active')).toBeInTheDocument();
  });

  it('toggles sort direction through the URL on repeated header clicks', () => {
    currentSearch = '';
    const { unmount } = render(<AssetExplorer items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort by Confidence/ }));
    expect(replaceMock).toHaveBeenCalledWith('/assets?sort=confidence', { scroll: false });
    unmount();
    currentSearch = 'sort=confidence';
    replaceMock.mockClear();
    render(<AssetExplorer items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort by Confidence, currently ascending/ }));
    expect(replaceMock).toHaveBeenCalledWith('/assets?sort=confidence&dir=desc', { scroll: false });
  });

  it('shows an intentional empty state when nothing matches', () => {
    currentSearch = 'q=nomatch';
    render(<AssetExplorer items={items} />);
    expect(screen.getByText('No assets match the current filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear all/ })).toBeInTheDocument();
  });

  it('shows the sparse-pilot empty state when the register is empty', () => {
    render(<AssetExplorer items={[]} />);
    expect(screen.getByText('No assets in the database yet')).toBeInTheDocument();
  });

  it('exports the filtered rows to CSV', () => {
    currentSearch = 'country=USA';
    const createUrlMock = vi.fn<(blob: Blob) => string>(() => 'blob:mock');
    const revokeMock = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createUrlMock, revokeObjectURL: revokeMock });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<AssetExplorer items={items} />);
    const exportButton = screen.getByRole('button', { name: /Export CSV/ });
    expect(within(exportButton).getByText(/of 1 filtered rows/)).toBeInTheDocument();
    fireEvent.click(exportButton);
    expect(createUrlMock).toHaveBeenCalledTimes(1);
    const blob = createUrlMock.mock.calls[0]![0];
    expect(blob.type).toContain('text/csv');
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
