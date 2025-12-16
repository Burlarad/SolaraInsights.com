import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn | Solara Insights",
  description:
    "Short guides on astrology, tarot, compatibility, and how to use Solara with clarity and confidence.",
  openGraph: {
    title: "Learn | Solara Insights",
    description:
      "Short guides on astrology, tarot, compatibility, and how to use Solara with clarity and confidence.",
  },
};

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
