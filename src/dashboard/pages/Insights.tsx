import { Icon } from '@/components/Icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { IntentPreview } from '../components/IntentPreview'

export function Insights() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="mt-1 text-muted-foreground">
          Intent-based breakdowns and trends
        </p>
      </div>

      <IntentPreview />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="bulb-2" className="text-xl text-primary" />
            Coming in Phase 2
          </CardTitle>
          <CardDescription>On-device AI intent classification</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Once classification ships, this page will show how your time splits
            by <em>intent</em> — e.g. how much of your YouTube time is Learning
            vs Entertainment — plus week-over-week trends. Classification will
            run on-device (Chrome's Gemini Nano) with a keyword-rule fallback,
            and nothing leaves your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
