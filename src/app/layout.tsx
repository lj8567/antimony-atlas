import type { Metadata, Viewport } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'Antimony Supply Risk Atlas',
    template: '%s · Antimony Supply Risk Atlas',
  },
  description:
    'Source-audited intelligence on non-Chinese antimony mines, projects, processing facilities, logistics gateways, trade flows and supply events.',
};

export const viewport: Viewport = {
  themeColor: '#0d1115',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
