import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Crown, Flame, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupportWhatsAppUrl } from '@/lib/constants'

interface TrialCountdownProps {
  enrollmentDate: string
  durationDays: number
  upgradeUrl?: string | null
  variant?: 'banner' | 'compact'
  className?: string
}

function getTimeRemaining(enrollmentDate: string, durationDays: number) {
  const start = new Date(enrollmentDate)
  const expiry = new Date(start)
  expiry.setDate(expiry.getDate() + durationDays)

  const now = Date.now()
  const diff = expiry.getTime() - now

  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { expired: false, days, hours, minutes, seconds, totalMs: diff }
}

export function TrialCountdown({
  enrollmentDate,
  durationDays,
  upgradeUrl,
  variant = 'banner',
  className,
}: TrialCountdownProps) {
  const [time, setTime] = useState(() => getTimeRemaining(enrollmentDate, durationDays))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(enrollmentDate, durationDays))
    }, 1000)
    return () => clearInterval(interval)
  }, [enrollmentDate, durationDays])

  const handleUpgrade = () => {
    if (upgradeUrl) {
      window.open(upgradeUrl, '_blank')
    } else {
      window.open(getSupportWhatsAppUrl(), '_blank')
    }
  }

  const isUrgent = time.days <= 3
  const isCritical = time.days === 0

  if (variant === 'compact') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'gap-1 font-mono text-xs cursor-pointer hover:opacity-80 transition-opacity',
          isCritical
            ? 'bg-red-500/10 text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 animate-pulse'
            : isUrgent
              ? 'bg-orange-500/10 text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700'
              : 'bg-amber-500/10 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700',
          className
        )}
        onClick={handleUpgrade}
      >
        <Clock className="h-3 w-3" />
        {time.expired
          ? 'Expirado'
          : time.days > 0
            ? `${time.days}d ${time.hours}h restantes`
            : `${time.hours}h ${time.minutes}m ${time.seconds}s`}
      </Badge>
    )
  }

  // variant === 'banner'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-5',
        isCritical
          ? 'border-red-300 dark:border-red-700'
          : isUrgent
            ? 'border-orange-300 dark:border-orange-700'
            : 'border-amber-300/60 dark:border-amber-700/60',
        className
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0',
        isCritical
          ? 'bg-gradient-to-r from-red-50 via-orange-50 to-red-50 dark:from-red-950/40 dark:via-orange-950/30 dark:to-red-950/40'
          : isUrgent
            ? 'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30'
            : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/20 dark:via-yellow-950/15 dark:to-amber-950/20'
      )} />

      {/* Decorative glow */}
      <div className={cn(
        'absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30',
        isCritical ? 'bg-red-400' : isUrgent ? 'bg-orange-400' : 'bg-amber-400'
      )} />

      <div className="relative flex flex-col sm:flex-row items-center gap-5">
        {/* Icon */}
        <div className={cn(
          'shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm',
          isCritical
            ? 'bg-gradient-to-br from-red-500 to-orange-500'
            : isUrgent
              ? 'bg-gradient-to-br from-orange-500 to-amber-500'
              : 'bg-gradient-to-br from-amber-500 to-yellow-500'
        )}>
          {isCritical ? (
            <Flame className="h-6 w-6 text-white animate-pulse" />
          ) : time.expired ? (
            <Hourglass className="h-6 w-6 text-white" />
          ) : (
            <Clock className="h-6 w-6 text-white" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className={cn(
            'text-base font-bold',
            isCritical ? 'text-red-800 dark:text-red-200' : isUrgent ? 'text-orange-800 dark:text-orange-200' : 'text-amber-800 dark:text-amber-200'
          )}>
            {time.expired
              ? 'Seu periodo de degustacao expirou!'
              : isCritical
                ? 'Ultimas horas da sua degustacao!'
                : isUrgent
                  ? 'Sua degustacao esta acabando!'
                  : 'Voce esta no periodo de degustacao'}
          </p>
          <p className={cn(
            'text-sm mt-0.5',
            isCritical ? 'text-red-700/70 dark:text-red-300/70' : isUrgent ? 'text-orange-700/70 dark:text-orange-300/70' : 'text-amber-700/70 dark:text-amber-300/70'
          )}>
            {time.expired
              ? 'Adquira o acesso completo para continuar estudando.'
              : 'Garanta seu acesso completo antes que o tempo acabe!'}
          </p>
        </div>

        {/* Countdown digits */}
        {!time.expired && (
          <div className="flex items-center gap-2">
            <TimeBox value={time.days} label="dias" critical={isCritical} urgent={isUrgent} />
            <Separator critical={isCritical} />
            <TimeBox value={time.hours} label="horas" critical={isCritical} urgent={isUrgent} />
            <Separator critical={isCritical} />
            <TimeBox value={time.minutes} label="min" critical={isCritical} urgent={isUrgent} />
            {time.days === 0 && (
              <>
                <Separator critical={isCritical} />
                <TimeBox value={time.seconds} label="seg" critical={isCritical} urgent={isUrgent} />
              </>
            )}
          </div>
        )}

        {/* CTA */}
        <Button
          onClick={handleUpgrade}
          className={cn(
            'shrink-0 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold gap-2',
            isCritical
              ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-red-500/20'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20'
          )}
        >
          <Crown className="h-4 w-4" />
          {time.expired ? 'Adquirir acesso' : 'Fazer upgrade'}
        </Button>
      </div>
    </div>
  )
}

function TimeBox({ value, label, critical, urgent }: { value: number; label: string; critical: boolean; urgent: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center rounded-xl px-3 py-2 min-w-[52px] border shadow-sm',
      critical
        ? 'bg-red-100/80 border-red-200 dark:bg-red-900/30 dark:border-red-700'
        : urgent
          ? 'bg-orange-100/80 border-orange-200 dark:bg-orange-900/30 dark:border-orange-700'
          : 'bg-white/80 border-amber-200/60 dark:bg-amber-900/20 dark:border-amber-700/50'
    )}>
      <span
        className={cn(
          'text-2xl font-extrabold font-mono leading-none tabular-nums',
          critical
            ? 'text-red-600 dark:text-red-400'
            : urgent
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-amber-700 dark:text-amber-300'
        )}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className={cn(
        'text-[10px] font-medium uppercase tracking-wider mt-0.5',
        critical ? 'text-red-500/70 dark:text-red-400/60' : urgent ? 'text-orange-500/70 dark:text-orange-400/60' : 'text-amber-600/60 dark:text-amber-400/50'
      )}>
        {label}
      </span>
    </div>
  )
}

function Separator({ critical }: { critical: boolean }) {
  return (
    <span className={cn(
      'text-xl font-bold leading-none pb-3',
      critical ? 'text-red-400 dark:text-red-500 animate-pulse' : 'text-amber-400 dark:text-amber-600'
    )}>
      :
    </span>
  )
}
