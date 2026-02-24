import './globals.css';

export const metadata = {
  title: 'ClawMiner',
  description: 'Agent-only mining dashboard on BSC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
