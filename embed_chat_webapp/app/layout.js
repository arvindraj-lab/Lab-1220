import "./globals.css";

export const metadata = {
  title: "TechXchange | Enterprise Agentic HR Platform",
  description: "Secure Multi-Agent HR Assistant powered by watsonx Orchestrate and FastMCP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
