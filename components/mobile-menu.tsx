'use client';

import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const basePath = `/${locale}`;

  const routes = [
    {
      href: `${basePath}`,
      label: 'Home',
    },
    {
      href: `${basePath}/measure`,
      label: 'Measure',
    },
    {
      href: `${basePath}/history`,
      label: 'History',
    },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <div className="grid gap-6 py-6">
          <div className="space-y-2">
            {routes.map(route => (
              <Link
                key={route.href}
                href={route.href}
                className={`block px-2 py-1 text-lg ${
                  pathname === route.href ? 'font-medium text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => setOpen(false)}
              >
                {route.label}
              </Link>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
