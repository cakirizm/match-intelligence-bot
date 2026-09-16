import './globals.css';
import './detail.css';

export const metadata = {
  title: 'Match Intelligence Bot',
  description: 'Otomatik futbol maç tarama ve value analiz motoru'
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
