import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Repeat,
    Repeat1,
    ChevronUp,
    ChevronDown,
    X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AudioLesson } from '@/services/audioLessonService'

type RepeatMode = 'off' | 'all' | 'one'

interface AudioPlayerProps {
    currentTrack: AudioLesson | null
    playlist: AudioLesson[]
    onTrackChange: (track: AudioLesson) => void
    onClose?: () => void
}

export function AudioPlayer({ currentTrack, playlist, onTrackChange, onClose }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
    const [isExpanded, setIsExpanded] = useState(false)

    const audioRef = useRef<HTMLAudioElement>(null)

    // Load and play track
    useEffect(() => {
        if (!currentTrack || !audioRef.current) return
        const audio = audioRef.current
        audio.src = currentTrack.audio_url || ''
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }, [currentTrack])

    // Media Session API — background playback + lock screen controls
    useEffect(() => {
        if (!currentTrack || !('mediaSession' in navigator)) return

        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.series || 'Everest',
            album: 'Evercast',
            artwork: [
                { src: currentTrack.thumbnail_url || '/logo.png', sizes: '96x96', type: 'image/png' },
                { src: currentTrack.thumbnail_url || '/logo.png', sizes: '192x192', type: 'image/png' },
                { src: currentTrack.thumbnail_url || '/logo.png', sizes: '512x512', type: 'image/png' },
            ]
        })

        const audio = audioRef.current
        if (!audio) return

        navigator.mediaSession.setActionHandler('play', () => { audio.play(); setIsPlaying(true) })
        navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); setIsPlaying(false) })
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious())
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
        navigator.mediaSession.setActionHandler('seekbackward', (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)) })
        navigator.mediaSession.setActionHandler('seekforward', (d) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (d.seekOffset || 10)) })
        navigator.mediaSession.setActionHandler('seekto', (d) => { if (d.seekTime !== undefined) audio.currentTime = d.seekTime })
    }, [currentTrack, playlist])

    // Audio events
    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime)
            if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && audio.duration) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: audio.duration,
                        playbackRate: audio.playbackRate,
                        position: audio.currentTime,
                    })
                } catch { /* ignore */ }
            }
        }

        const handleLoadedMetadata = () => setDuration(audio.duration)

        const handleEnded = () => {
            if (repeatMode === 'one') {
                audio.currentTime = 0
                audio.play()
            } else {
                playNext()
            }
        }

        const handlePlay = () => {
            setIsPlaying(true)
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
        }

        const handlePause = () => {
            setIsPlaying(false)
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
        }

        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('play', handlePlay)
            audio.removeEventListener('pause', handlePause)
        }
    }, [playlist, currentTrack, repeatMode])

    const togglePlayPause = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return
        if (isPlaying) audio.pause()
        else audio.play()
    }, [isPlaying])

    const handleSeek = useCallback((value: number[]) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = value[0]
        setCurrentTime(value[0])
    }, [])

    const handleVolumeChange = useCallback((value: number[]) => {
        const audio = audioRef.current
        if (!audio) return
        const newVol = value[0]
        audio.volume = newVol
        setVolume(newVol)
        setIsMuted(newVol === 0)
    }, [])

    const playNext = useCallback(() => {
        if (!currentTrack || !playlist.length) return
        const currentIndex = playlist.findIndex(t => t.id === currentTrack.id)
        if (currentIndex < playlist.length - 1) {
            onTrackChange(playlist[currentIndex + 1])
        } else if (repeatMode === 'all') {
            onTrackChange(playlist[0])
        }
    }, [currentTrack, playlist, onTrackChange, repeatMode])

    const playPrevious = useCallback(() => {
        if (!currentTrack || !playlist.length) return
        const audio = audioRef.current
        // If more than 3s in, restart track instead of going back
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0
            return
        }
        const currentIndex = playlist.findIndex(t => t.id === currentTrack.id)
        if (currentIndex > 0) {
            onTrackChange(playlist[currentIndex - 1])
        } else if (repeatMode === 'all') {
            onTrackChange(playlist[playlist.length - 1])
        }
    }, [currentTrack, playlist, onTrackChange, repeatMode])

    const cycleRepeat = useCallback(() => {
        setRepeatMode(prev => {
            if (prev === 'off') return 'all'
            if (prev === 'all') return 'one'
            return 'off'
        })
    }, [])

    const toggleMute = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return
        if (isMuted) {
            audio.volume = volume || 0.5
            setIsMuted(false)
        } else {
            audio.volume = 0
            setIsMuted(true)
        }
    }, [isMuted, volume])

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return '0:00'
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    if (!currentTrack) return null

    const currentIndex = playlist.findIndex(t => t.id === currentTrack.id)
    const hasPrev = currentIndex > 0 || repeatMode === 'all'
    const hasNext = currentIndex < playlist.length - 1 || repeatMode === 'all'

    return (
        <>
            <audio ref={audioRef} preload="metadata" />

            {/* Mobile expanded view */}
            {isExpanded && (
                <div className="fixed inset-0 z-[60] bg-background flex flex-col md:hidden">
                    {/* Close */}
                    <div className="flex items-center justify-between p-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} aria-label="Minimizar player">
                            <ChevronDown className="h-5 w-5" />
                        </Button>
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Tocando agora</span>
                        <div className="w-10" />
                    </div>

                    {/* Artwork */}
                    <div className="flex-1 flex items-center justify-center px-8">
                        <div className="w-full max-w-[320px] aspect-square rounded-xl overflow-hidden shadow-2xl">
                            {currentTrack.thumbnail_url ? (
                                <img src={currentTrack.thumbnail_url} alt={currentTrack.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center">
                                    <Play className="w-20 h-20 text-white/60" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Track info + controls */}
                    <div className="px-8 pb-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold truncate">{currentTrack.title}</h2>
                            <p className="text-sm text-muted-foreground truncate">{currentTrack.series || 'Evercast'}</p>
                        </div>

                        {/* Seek bar */}
                        <div className="space-y-1">
                            <Slider
                                value={[currentTime]}
                                max={duration || 100}
                                step={1}
                                onValueChange={handleSeek}
                                className="w-full"
                            />
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Main controls */}
                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={cycleRepeat}
                                className={cn("h-10 w-10", repeatMode !== 'off' ? "text-green-500" : "text-muted-foreground")}
                                aria-label="Repetir"
                            >
                                {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                            </Button>

                            <Button variant="ghost" size="icon" onClick={playPrevious} disabled={!hasPrev} className="h-12 w-12" aria-label="Faixa anterior">
                                <SkipBack className="h-6 w-6 fill-current" />
                            </Button>

                            <Button
                                size="icon"
                                onClick={togglePlayPause}
                                className="h-16 w-16 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-transform shadow-lg"
                                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                            >
                                {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 ml-0.5 fill-current" />}
                            </Button>

                            <Button variant="ghost" size="icon" onClick={playNext} disabled={!hasNext} className="h-12 w-12" aria-label="Proxima faixa">
                                <SkipForward className="h-6 w-6 fill-current" />
                            </Button>

                            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-10 w-10 text-muted-foreground" aria-label={isMuted ? "Ativar som" : "Silenciar"}>
                                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Persistent bottom bar */}
            <div className={cn(
                "fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-transform",
                isExpanded ? "translate-y-full md:translate-y-0" : ""
            )}>
                {/* Progress bar on top of the bar (thin line) */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30">
                    <div
                        className="h-full bg-green-500 transition-[width] duration-200"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                </div>

                <div className="flex items-center h-20 px-4 gap-3">
                    {/* Track Info (clickable on mobile to expand) */}
                    <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer md:cursor-default md:w-1/3"
                        onClick={() => window.innerWidth < 768 && setIsExpanded(true)}
                    >
                        <div className="relative h-12 w-12 rounded-md overflow-hidden shadow-md shrink-0">
                            {currentTrack.thumbnail_url ? (
                                <img src={currentTrack.thumbnail_url} alt={currentTrack.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center">
                                    <Play className="h-5 w-5 text-white/80" />
                                </div>
                            )}
                            {isPlaying && (
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    <div className="w-5 h-5 flex items-end justify-between gap-[2px]">
                                        <div className="w-1 bg-green-400 animate-[music-bar_0.6s_ease-in-out_infinite] h-full rounded-full" />
                                        <div className="w-1 bg-green-400 animate-[music-bar_0.8s_ease-in-out_infinite_0.1s] h-2/3 rounded-full" />
                                        <div className="w-1 bg-green-400 animate-[music-bar_1.0s_ease-in-out_infinite_0.2s] h-1/2 rounded-full" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col truncate">
                            <span className={cn("font-semibold truncate text-sm", isPlaying ? "text-green-500" : "")}>{currentTrack.title}</span>
                            <span className="text-xs text-muted-foreground truncate">{currentTrack.series || 'Evercast'}</span>
                        </div>
                        {/* Mobile expand hint */}
                        <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsExpanded(true) }} aria-label="Expandir player">
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Desktop Controls */}
                    <div className="hidden md:flex flex-col items-center gap-1 w-1/3">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={cycleRepeat}
                                className={cn("h-8 w-8", repeatMode !== 'off' ? "text-green-500" : "text-muted-foreground hover:text-foreground")}
                                title={repeatMode === 'off' ? 'Repetir desativado' : repeatMode === 'all' ? 'Repetir tudo' : 'Repetir uma'}
                                aria-label="Repetir"
                            >
                                {repeatMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={playPrevious}
                                disabled={!hasPrev}
                                className="h-9 w-9 hover:text-foreground disabled:opacity-30"
                                aria-label="Faixa anterior"
                            >
                                <SkipBack className="h-4 w-4 fill-current" />
                            </Button>

                            <Button
                                size="icon"
                                onClick={togglePlayPause}
                                className="h-9 w-9 rounded-full bg-white text-black hover:bg-white/90 hover:scale-110 transition-all"
                                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                            >
                                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={playNext}
                                disabled={!hasNext}
                                className="h-9 w-9 hover:text-foreground disabled:opacity-30"
                                aria-label="Proxima faixa"
                            >
                                <SkipForward className="h-4 w-4 fill-current" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 w-full max-w-md">
                            <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                            <Slider
                                value={[currentTime]}
                                max={duration || 100}
                                step={1}
                                onValueChange={handleSeek}
                                className="w-full"
                            />
                            <span className="text-[11px] text-muted-foreground w-10 tabular-nums">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Mobile play/pause */}
                    <Button
                        size="icon"
                        onClick={togglePlayPause}
                        className="md:hidden h-10 w-10 rounded-full bg-white text-black hover:bg-white/90 shrink-0"
                        aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                    >
                        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                    </Button>

                    {/* Desktop Volume + Close */}
                    <div className="hidden md:flex items-center justify-end gap-2 w-1/3">
                        <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={isMuted ? "Ativar som" : "Silenciar"}>
                            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <Slider
                            value={[isMuted ? 0 : volume]}
                            max={1}
                            step={0.01}
                            onValueChange={handleVolumeChange}
                            className="w-24"
                        />
                        {onClose && (
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground ml-2" aria-label="Fechar player">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
