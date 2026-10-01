import Link from 'next/link'
import { MobileNav } from '@/components/layout/MobileNav'
import { RoleBadge } from '@/components/layout/RoleBadge'
import { SidebarNav } from '@/components/layout/SidebarNav'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { UserMenu } from '@/components/layout/UserMenu'
import { Wordmark } from '@/components/layout/Wordmark'
import { requireUser } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:flex">
        <Link href="/dashboard" className="mb-6 px-3 text-2xl text-sidebar-foreground">
          <Wordmark />
        </Link>
        <SidebarNav />
        <p className="mt-auto px-3 text-xs text-sidebar-foreground/60">UVIN Group · uvingroup.com</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
          <MobileNav />
          <Link href="/dashboard" className="text-xl lg:hidden">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <RoleBadge role={user.profile.role} />
            <ThemeToggle />
            <UserMenu name={user.profile.full_name} email={user.email} />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 lg:px-6">
          {children}
        </main>
        <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground lg:px-6">
          UVIN Group · uvingroup.com
        </footer>
      </div>
    </div>
  )
}
