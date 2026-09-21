'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Money Spent', href: '/money-spent', icon: CreditCard },
  { name: 'Earnings', href: '/earnings', icon: DollarSign },
  { name: 'Investments', href: '/investments', icon: TrendingUp, children: [
    { name: 'Contributions', href: '/investments' },
    { name: 'Investors', href: '/investments/investors' },
  ]},
  { name: 'Audit Log', href: '/audit-log', icon: FileText },
]

export function AppSidebar({ isMobileOpen, setIsMobileOpen }: { isMobileOpen: boolean; setIsMobileOpen: (open: boolean) => void }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarProvider open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
      <Sidebar className={cn('border-r bg-background', collapsed ? 'w-16' : 'w-64')} collapsible="icon">
        <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className={cn('font-bold text-lg', collapsed && 'hidden')}>
                UVfIN
              </span>
            </div>
          </SidebarGroupLabel>
          <SidebarMenu>
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.children && item.children.some(c => pathname === c.href))
              const isChildActive = item.children && item.children.some(c => pathname === c.href)
              
              if (item.children) {
                return (
                  <SidebarMenuItem key={item.name} className="relative">
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
                        isChildActive && 'bg-accent text-accent-foreground'
                      )}
                      onClick={() => setIsMobileOpen(false)}
                    >
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                      <span className={cn(collapsed && 'hidden')}>{item.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenu className="pl-4">
                      {item.children.map((child) => (
                        <SidebarMenuItem key={child.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === child.href}
                            onClick={() => setIsMobileOpen(false)}
                          >
                            <span>{child.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarMenuItem>
                )
              }
              
              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    <span className={cn(collapsed && 'hidden')}>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
        
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-full justify-start gap-2"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className={cn(collapsed && 'hidden')}>
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </Button>
          </SidebarGroupLabel>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    </SidebarProvider>
  )
}