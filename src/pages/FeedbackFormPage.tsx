import React, { useState, useCallback } from 'react';
import { STORE_LOCATIONS } from '@/types/feedback';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Crown, Star, CheckCircle2, ChevronRight, ChevronLeft,
  User, Phone, MapPin, ThumbsUp, ThumbsDown, Send, Loader2,
  MessageSquare, Lightbulb, AlertTriangle, Package, Sparkles
} from 'lucide-react';

/* ─── Rating Labels ─────────────────────────────────── */
const RATING_LABELS: Record<number, string> = {
  1: 'Very Poor',
  2: 'Poor',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const RATING_COLORS: Record<number, string> = {
  1: 'text-red-500',
  2: 'text-orange-400',
  3: 'text-yellow-500',
  4: 'text-emerald-500',
  5: 'text-green-500',
};

/* ─── Interactive Star Rating ───────────────────────── */
function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label} <span className="text-destructive">*</span></Label>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            type="button"
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(i)}
            className="group relative transition-transform duration-150 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-full p-0.5"
            aria-label={`Rate ${i} - ${RATING_LABELS[i]}`}
          >
            <Star
              className={`w-8 h-8 transition-colors duration-200 ${
                i <= active
                  ? `fill-current ${RATING_COLORS[active] || 'text-warning'}`
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
        {active > 0 && (
          <span className={`ml-3 text-sm font-medium animate-fade-in ${RATING_COLORS[active]}`}>
            {RATING_LABELS[active]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Yes/No Toggle ─────────────────────────────────── */
function YesNoToggle({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label} <span className="text-destructive">*</span></Label>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${
            value === true
              ? 'border-green-500 bg-green-500/10 text-green-600 shadow-md shadow-green-500/10'
              : 'border-border bg-card hover:border-green-400/50 text-muted-foreground hover:text-green-500'
          }`}
        >
          <ThumbsUp className="w-4 h-4" /> Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${
            value === false
              ? 'border-red-500 bg-red-500/10 text-red-600 shadow-md shadow-red-500/10'
              : 'border-border bg-card hover:border-red-400/50 text-muted-foreground hover:text-red-500'
          }`}
        >
          <ThumbsDown className="w-4 h-4" /> No
        </button>
      </div>
    </div>
  );
}

/* ─── Step Indicator ────────────────────────────────── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < current
                ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                : i === current
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-0.5 rounded transition-colors duration-300 ${i < current ? 'bg-green-500' : 'bg-muted'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── Main Form ─────────────────────────────────────── */
interface FormData {
  name: string;
  mobile: string;
  storeLocation: string;
  staffBehavior: number;
  staffService: number;
  storeSatisfaction: number;
  priceChallengeOk: boolean | null;
  billReceived: boolean | null;
  complaint: string;
  feedback: string;
  suggestions: string;
  productUnavailable: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  mobile: '',
  storeLocation: '',
  staffBehavior: 0,
  staffService: 0,
  storeSatisfaction: 0,
  priceChallengeOk: null,
  billReceived: null,
  complaint: '',
  feedback: '',
  suggestions: '',
  productUnavailable: '',
};

export default function FeedbackFormPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const STEPS = [
    { title: 'Personal Info', icon: User },
    { title: 'Satisfaction', icon: Star },
    { title: 'Additional', icon: MessageSquare },
  ];

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  /* ─── Validation ────────────────────────────────── */
  const validateStep = (s: number): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (s === 0) {
      if (!form.name.trim()) errs.name = 'Name is required';
      if (!form.mobile.trim()) errs.mobile = 'Mobile number is required';
      else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) errs.mobile = 'Enter a valid 10-digit mobile number';
      if (!form.storeLocation) errs.storeLocation = 'Please select a store';
    }

    if (s === 1) {
      if (form.staffBehavior === 0) errs.staffBehavior = 'Please rate staff behavior';
      if (form.staffService === 0) errs.staffService = 'Please rate staff service';
      if (form.storeSatisfaction === 0) errs.storeSatisfaction = 'Please rate store satisfaction';
      if (form.priceChallengeOk === null) errs.priceChallengeOk = 'Please select an option';
      if (form.billReceived === null) errs.billReceived = 'Please select an option';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => setStep(s => Math.max(s - 1, 0));

  /* ─── Submit ────────────────────────────────────── */
  const submit = async () => {
    if (!validateStep(step)) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        store_location: form.storeLocation,
        staff_behavior: form.staffBehavior,
        staff_service: form.staffService,
        store_satisfaction: form.storeSatisfaction,
        price_challenge_ok: form.priceChallengeOk,
        bill_received: form.billReceived,
        complaint: form.complaint.trim() || null,
        feedback: form.feedback.trim() || null,
        suggestions: form.suggestions.trim() || null,
        product_unavailable: form.productUnavailable.trim() || null,
        status: 'Pending',
      };

      const { error } = await supabase.from('feedback_submissions').insert([payload]);
      if (error) throw error;

      setSubmitted(true);
      toast({ title: '🎉 Thank you!', description: 'Your feedback has been recorded successfully.' });
    } catch (err: any) {
      console.error('Submission error:', err);
      toast({
        title: 'Submission Failed',
        description: err?.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Success Screen ────────────────────────────── */
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="glass-card max-w-md w-full animate-fade-in text-center">
          <CardContent className="pt-10 pb-8 px-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 animate-bounce" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              Your feedback has been submitted successfully. We truly appreciate your time and will use your input to improve our services.
            </p>
            <Button onClick={() => { setSubmitted(false); setForm(INITIAL_FORM); setStep(0); }} className="w-full">
              Submit Another Response
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ─── Form UI ───────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 mb-4 shadow-lg shadow-primary/25">
            <Crown className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Rajmandir</h1>
          <p className="text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> Customer Feedback Form
          </p>
        </div>

        <StepIndicator current={step} total={STEPS.length} />

        <Card className="glass-card animate-fade-in overflow-hidden">
          {/* Step Title Bar */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border px-6 py-3 flex items-center gap-2">
            {React.createElement(STEPS[step].icon, { className: 'w-4 h-4 text-primary' })}
            <span className="text-sm font-display font-semibold text-foreground">{STEPS[step].title}</span>
            <span className="ml-auto text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
          </div>

          <CardContent className="p-6 space-y-5">
            {/* ─── Step 1: Personal Info ───────────────── */}
            {step === 0 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="feedback-name" className="text-sm font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" /> Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="feedback-name"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-mobile" className="text-sm font-semibold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-primary" /> Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="feedback-mobile"
                    placeholder="Enter 10-digit mobile number"
                    value={form.mobile}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                      set('mobile', v);
                    }}
                    inputMode="numeric"
                    maxLength={10}
                    className={errors.mobile ? 'border-destructive' : ''}
                  />
                  {errors.mobile && <p className="text-xs text-destructive">{errors.mobile}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Store Location <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.storeLocation} onValueChange={v => set('storeLocation', v)}>
                    <SelectTrigger id="feedback-store" className={errors.storeLocation ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select your store" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {STORE_LOCATIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.storeLocation && <p className="text-xs text-destructive">{errors.storeLocation}</p>}
                </div>
              </div>
            )}

            {/* ─── Step 2: Satisfaction Ratings ───────── */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <StarRating label="How satisfied are you with Staff Behavior?" value={form.staffBehavior} onChange={v => set('staffBehavior', v)} />
                {errors.staffBehavior && <p className="text-xs text-destructive -mt-4">{errors.staffBehavior}</p>}

                <StarRating label="How satisfied are you with Staff Service?" value={form.staffService} onChange={v => set('staffService', v)} />
                {errors.staffService && <p className="text-xs text-destructive -mt-4">{errors.staffService}</p>}

                <StarRating label="How satisfied are you with the Store?" value={form.storeSatisfaction} onChange={v => set('storeSatisfaction', v)} />
                {errors.storeSatisfaction && <p className="text-xs text-destructive -mt-4">{errors.storeSatisfaction}</p>}

                <div className="border-t border-border pt-5 space-y-5">
                  <YesNoToggle label="Are you satisfied with our price challenge?" value={form.priceChallengeOk} onChange={v => set('priceChallengeOk', v)} />
                  {errors.priceChallengeOk && <p className="text-xs text-destructive">{errors.priceChallengeOk}</p>}

                  <YesNoToggle label="Have you received the bill after payment?" value={form.billReceived} onChange={v => set('billReceived', v)} />
                  {errors.billReceived && <p className="text-xs text-destructive">{errors.billReceived}</p>}
                </div>
              </div>
            )}

            {/* ─── Step 3: Additional Details ─────────── */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="feedback-complaint" className="text-sm font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Your Complaint
                  </Label>
                  <Textarea
                    id="feedback-complaint"
                    placeholder="Share any complaint you have (optional)"
                    value={form.complaint}
                    onChange={e => set('complaint', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-feedback" className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-info" /> Your Feedback
                  </Label>
                  <Textarea
                    id="feedback-feedback"
                    placeholder="Share your feedback about our service (optional)"
                    value={form.feedback}
                    onChange={e => set('feedback', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-suggestions" className="text-sm font-semibold flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-warning" /> Suggestions for Improvement
                  </Label>
                  <Textarea
                    id="feedback-suggestions"
                    placeholder="Any suggestions you have for us (optional)"
                    value={form.suggestions}
                    onChange={e => set('suggestions', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-products" className="text-sm font-semibold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-accent" /> Products Unavailable
                  </Label>
                  <Textarea
                    id="feedback-products"
                    placeholder="List products not available at the store (optional)"
                    value={form.productUnavailable}
                    onChange={e => set('productUnavailable', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* ─── Navigation Buttons ─────────────────── */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              {step > 0 ? (
                <Button variant="outline" onClick={prev} className="gap-1.5">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < STEPS.length - 1 ? (
                <Button onClick={next} className="gap-1.5">
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={submitting} className="gap-1.5 min-w-[140px]">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Rajmandir. Your feedback helps us serve you better.
        </p>
      </div>
    </div>
  );
}
