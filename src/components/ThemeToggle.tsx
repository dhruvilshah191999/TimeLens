import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className="text-muted-foreground"
    >
      <Icon
        name={theme === 'dark' ? 'moon-half-right-5' : 'sun-1'}
        className="text-xl"
      />
    </Button>
  )
}
