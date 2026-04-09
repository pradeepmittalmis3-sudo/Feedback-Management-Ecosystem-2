import React, { useState, useEffect, useCallback } from 'react';
import { useFeedback } from '@/contexts/FeedbackContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Play, Pause, ChevronLeft, ChevronRight, Star, Quote, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/types/feedback';

export default function FeedbackPlayback({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { feedbacks } = useFeedback();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  
  const activeFeedbacks = feedbacks.slice(0, 20); // Only playback recent records
  const duration = 7000; // 7 seconds per slide

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % activeFeedbacks.length);
    setProgress(0);
  }, [activeFeedbacks.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + activeFeedbacks.length) % activeFeedbacks.length);
    setProgress(0);
  }, [activeFeedbacks.length]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && open) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + (100 / (duration / 100));
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, open, handleNext]);

  if (activeFeedbacks.length === 0) return null;
  
  const current = activeFeedbacks[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] h-[100vh] w-[100vw] p-0 bg-background/95 backdrop-blur-3xl border-0 overflow-hidden z-[9999]">
        <div className="absolute top-0 left-0 w-full h-1 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-100 ease-linear" 
            style={{ width: `${progress}%` }} 
          />
        </div>

        <div className="flex flex-col h-full relative p-6 md:p-12 lg:p-20">
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Play className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">Feedback Playback</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Auto-cycle active • {currentIndex + 1} of {activeFeedbacks.length}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => onOpenChange(false)}>
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Main Reel Content */}
          <div className="flex-1 flex flex-col justify-center items-center text-center max-w-5xl mx-auto w-full relative">
            <div className="absolute top-1/2 -left-32 -translate-y-1/2 hidden xl:block">
              <Button variant="ghost" size="icon" className="h-20 w-20 rounded-full hover:bg-primary/5 group" onClick={handlePrev}>
                <ChevronLeft className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
            </div>
            <div className="absolute top-1/2 -right-32 -translate-y-1/2 hidden xl:block">
              <Button variant="ghost" size="icon" className="h-20 w-20 rounded-full hover:bg-primary/5 group" onClick={handleNext}>
                <ChevronRight className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 w-full space-y-10">
              <div className="space-y-4">
                <Badge variant="outline" className={`px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] rounded-full border-2 ${STATUS_COLORS[current.status]}`}>
                  {current.status}
                </Badge>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`w-8 h-8 ${i <= (current.staffBehavior + current.staffService)/2 ? 'fill-warning text-warning' : 'text-muted/20'}`} />
                  ))}
                </div>
              </div>

              <div className="relative inline-block">
                <Quote className="w-16 h-16 text-primary/10 absolute -top-8 -left-12 -z-10" />
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight tracking-tight px-4 italic">
                  {current.feedback || "Great service overall!"}
                </h1>
              </div>

              <div className="flex flex-col items-center gap-6 pt-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-2xl">
                    {current.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-display font-bold">{current.name}</p>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm font-medium">
                      <MapPin className="w-4 h-4" /> {current.storeLocation}
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
                      <Clock className="w-4 h-4 ml-1" /> {new Date(current.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Toolbar */}
          <div className="mt-auto flex justify-center pb-10">
            <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-full px-8 py-4 flex items-center gap-8 shadow-2xl">
              <Button variant="ghost" size="icon" className="hover:bg-primary/10" onClick={handlePrev}><ChevronLeft className="w-6 h-6"/></Button>
              <Button 
                variant="default" 
                size="icon" 
                className="w-16 h-16 rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-transform bg-primary"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-primary-foreground"/> : <Play className="w-8 h-8 fill-primary-foreground ml-1"/>}
              </Button>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10" onClick={handleNext}><ChevronRight className="w-6 h-6"/></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
