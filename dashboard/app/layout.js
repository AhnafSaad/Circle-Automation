export const metadata = {
    title: 'R-T-M Dual Engine — Circle Network Control Console',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body style={{ margin: 0, padding: 0 }}>{children}</body>
        </html>
    );
}