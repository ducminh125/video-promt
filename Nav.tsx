import React from 'react';
import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="flex items-center justify-between p-4 bg-gray-900 text-white">
      <Link href="/">
        <h1 className="text-xl font-bold cursor-pointer">Mai Đức Minh'web</h1>
      </Link>
      <div>
        {/* Các menu link khác */}
      </div>
    </nav>
  );
}
