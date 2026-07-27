import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfidenceIndicator, ProvenanceBadge, SeverityIndicator, StatusLabel } from '@/components/ui/badges';

describe('ProvenanceBadge', () => {
  it('always writes the label out — colour is never the only signal', () => {
    render(<ProvenanceBadge provenance="modelled" />);
    expect(screen.getByText('Modelled')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Reproducible calculation/);
  });
  it('handles missing provenance explicitly', () => {
    render(<ProvenanceBadge provenance={null} />);
    expect(screen.getByText('No provenance')).toBeInTheDocument();
  });
});

describe('ConfidenceIndicator', () => {
  it('shows band label plus the exact score', () => {
    render(<ConfidenceIndicator score={82} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Confidence 82/100');
  });
  it('labels unscored records', () => {
    render(<ConfidenceIndicator score={null} />);
    expect(screen.getByText('Not scored')).toBeInTheDocument();
  });
});

describe('StatusLabel', () => {
  it('renders the human status label', () => {
    render(<StatusLabel status="care_and_maintenance" />);
    expect(screen.getByText('Care & maintenance')).toBeInTheDocument();
  });
});

describe('SeverityIndicator', () => {
  it('renders label text alongside the block meter', () => {
    render(<SeverityIndicator severity={4} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
  it('handles unrated events', () => {
    render(<SeverityIndicator severity={null} />);
    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });
});
