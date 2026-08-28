import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Mai Đức Minh'web - Trình tạo Video & Ảnh",
  description: "Ứng dụng AI của Mai Đức Minh'web",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
