import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ava · A conversation with the Tobago diaspora',
  description:
    'Ava is a warm, unhurried guide from Castara who builds a living portrait of the Trinbagonian diaspora through natural conversation.',
};

export default function AvaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--background)]">{children}</div>;
}
