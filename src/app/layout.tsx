import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { APP_NAME } from "@/config/app";
import { LocationProvider } from "@/hooks/useLocation";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "현재 위치에서 걸어갈 수 있는 식당 한 곳을 바로 결정해주는 앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F5F2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <LocationProvider>
          <div className="mx-auto min-h-dvh w-full max-w-[440px] bg-background sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[32px] sm:shadow-xl">
            {children}
          </div>
        </LocationProvider>
      </body>
    </html>
  );
}
