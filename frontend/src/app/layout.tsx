import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

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
      <body className="min-h-screen bg-gray-900 text-gray-100">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
