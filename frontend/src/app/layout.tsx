import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'Shopping List Frontend',
  description: 'Next.js frontend for Symfony backend',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100">
        <AuthProvider>
          <div className="flex flex-col">
            <AppHeader />
            <div className="flex-1">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
