"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState } from "react"

export function GradelyHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={[
        "sticky top-0 z-40 border-b transition-all duration-300",
        "supports-[backdrop-filter]:backdrop-blur-xl",
        "bg-background/70",
        scrolled ? "py-2" : "py-3",
      ].join(" ")}
    >
      <div className="mx-auto w-full max-w-7xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div aria-hidden="true" className="size-6 rounded-md bg-primary/90" />
          <span className="font-semibold">Gradely</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Docs
          </Link>
          <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Roadmap
          </Link>
          <Button size="sm" className="glass-button">
            Open Editor
          </Button>
        </nav>
      </div>
    </header>
  )
}
