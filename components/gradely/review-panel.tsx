"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type ReviewIssue = {
  line: number
  message: string
  severity: "info" | "warning" | "error"
  suggestion?: string
}

export type ReviewResult = {
  summary: string
  issues: ReviewIssue[]
}

export function ReviewPanel(props: {
  review: ReviewResult | null
  issues: ReviewIssue[]
  onJumpToLine?: (line: number) => void
}) {
  const { review, issues } = props

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI Review</h2>
        <Badge variant="outline">
          {issues.length} issue{issues.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">
        {review?.summary ?? 'Run "Analyze Code" to receive a summary and inline feedback.'}
      </div>

      <div className="mt-4 space-y-3">
        {issues.map((issue, idx) => (
          <div key={idx} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Line {issue.line}{" "}
                <Badge
                  variant={
                    issue.severity === "error" ? "destructive" : issue.severity === "warning" ? "secondary" : "outline"
                  }
                >
                  {issue.severity}
                </Badge>
              </div>
              {props.onJumpToLine && (
                <Button size="sm" variant="outline" onClick={() => props.onJumpToLine?.(issue.line)}>
                  Jump
                </Button>
              )}
            </div>
            <p className="mt-2 text-sm">{issue.message}</p>
            {issue.suggestion && (
              <div className="mt-2 rounded-sm bg-secondary p-2 text-xs">
                <span className="font-semibold">Suggestion: </span>
                <span className="text-pretty">{issue.suggestion}</span>
              </div>
            )}
          </div>
        ))}
        {issues.length === 0 && <div className="text-sm text-muted-foreground">No issues to display yet.</div>}
      </div>
    </Card>
  )
}
