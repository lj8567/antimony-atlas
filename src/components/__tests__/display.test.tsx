import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricValue } from '@/components/ui/MetricValue';
import { SourceLink } from '@/components/ui/SourceLink';
import { ConfigNotice, EmptyState, ErrorState, QueryFailure } from '@/components/ui/states';
import { stibniteObservation } from '@/test/fixtures';

describe('SourceLink', () => {
  it('opens externally with rel protections and discloses the departure', () => {
    render(<SourceLink url="https://example.com/report" title="Feasibility Study" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('Feasibility Study');
    expect(screen.getByText(/opens external site/)).toBeInTheDocument();
  });
  it('labels missing URLs instead of rendering a dead link', () => {
    render(<SourceLink url={null} title="Anything" />);
    expect(screen.getByText('Source URL not recorded')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('MetricValue', () => {
  it('keeps unit, metric name, period and estimate qualifier together', () => {
    render(<MetricValue observation={stibniteObservation} />);
    expect(screen.getByText('12,300 t contained Sb')).toBeInTheDocument();
    expect(screen.getByText(/Projected recovered antimony/)).toBeInTheDocument();
    expect(screen.getByText(/2028/)).toBeInTheDocument();
    expect(screen.getByText('Modelled')).toBeInTheDocument();
  });
});

describe('state components', () => {
  it('renders empty and error states', () => {
    const { unmount } = render(<EmptyState title="Nothing here" detail="Load data first." />);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here');
    unmount();
    render(<ErrorState detail="boom" />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
  it('renders the unconfigured notice without placeholder data', () => {
    render(<ConfigNotice />);
    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_URL/)).toBeInTheDocument();
    expect(screen.getByText(/No placeholder data/)).toBeInTheDocument();
  });
  it('routes QueryFailure to the right state', () => {
    const { unmount } = render(<QueryFailure result={{ ok: false, error: 'x', unconfigured: true }} />);
    expect(screen.getByText(/Database connection not configured/)).toBeInTheDocument();
    unmount();
    render(<QueryFailure result={{ ok: false, error: 'query exploded', unconfigured: false }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('query exploded');
  });
});
