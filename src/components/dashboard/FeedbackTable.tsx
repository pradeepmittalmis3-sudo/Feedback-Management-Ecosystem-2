import { useState, useMemo } from 'react';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, FeedbackStatus, STATUS_OPTIONS, UserRole } from '@/types/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Eye, User, Phone, MapPin, Activity, Heart, Sparkles, PackageCheck, ThumbsUp, AlertTriangle, HelpCircle, Lightbulb, PackageX, Clock, ShieldCheck, Tag, UserPlus } from 'lucide-react';
import type { Feedback } from '@/types/feedback';

const AVAILABLE_STAFF = [
  'Super Admin', 'Rajesh', 'Suresh', 'Anjali', 'Vikas', 'Priyanka'
];

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? 'fill-warning text-warning drop-shadow-sm' : 'text-muted/40'}`} />
      ))}
    </div>
  );
}

export default function FeedbackTable() {
  const { filteredFeedbacks, updateStatus, updateAssignment } = useFeedback();
  const { role } = useAuth();
  const [detail, setDetail] = useState<Feedback | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [assignedUser, setAssignedUser] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(filteredFeedbacks.length / itemsPerPage);
  
  const currentFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFeedbacks.slice(start, start + itemsPerPage);
  }, [filteredFeedbacks, currentPage]);

  const handleStatusChange = (id: string, status: FeedbackStatus) => {
    updateStatus(id, status);
  };

  const openDetail = (fb: Feedback) => {
    setDetail(fb);
    setStatusNote(fb.statusNotes || '');
    setAssignedUser(fb.userName || '');
  };

  const saveNotes = () => {
    if (detail) {
      updateStatus(detail._id, detail.status, statusNote);
      if (assignedUser !== (detail.userName || '')) {
        updateAssignment(detail._id, assignedUser);
      }
      setDetail(null);
    }
  };

  return (
    <>
      <div className="w-full space-y-4 animate-fade-in relative z-0">
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            Feedback Records
            <Badge variant="secondary" className="px-2 py-0.5 text-xs font-normal bg-primary/10 text-primary">
              {filteredFeedbacks.length} Total
            </Badge>
          </h3>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/40 shadow-xl shadow-black/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto w-full pb-4">
            <table className="w-max min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary/5 border-b border-primary/10 whitespace-nowrap">
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary/70"/> Timestamp</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary/70"/> Name</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary/70"/> Mobile Number</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary/70"/> Store Location</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-primary/70"/> Staff Behaviour</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-primary/70"/> Staff Service</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary/70"/> Staff Satisfied</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-primary/70"/> Price Challenge</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5 text-primary/70"/> Bill Received</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5 text-primary/70"/> Your Feedback</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-primary/70"/> Your Suggestions</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><PackageX className="w-3.5 h-3.5 text-primary/70"/> Product Unavailable</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary/70"/> Bill Compliance</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-primary/70"/> Your Complaint</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Status</th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary/70"/> Assigned User</div></th>
                  <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase sticky right-0 bg-background/80 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {currentFeedbacks.map((fb) => (
                  <tr 
                    key={fb._id} 
                    className="group hover:bg-primary/[0.03] transition-colors duration-200 whitespace-nowrap"
                  >
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary">
                          {fb.name.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold">{fb.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] font-mono text-muted-foreground">{fb.mobile}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary/50 text-[13px] font-medium border border-border/50">
                        {fb.storeLocation}
                      </span>
                    </td>
                    <td className="py-3 px-4"><RatingStars value={fb.staffBehavior} /></td>
                    <td className="py-3 px-4"><RatingStars value={fb.staffService} /></td>
                    <td className="py-3 px-4 text-xs">{fb.staffSatisfied}</td>
                    <td className="py-3 px-4 text-xs">{fb.priceChallenge}</td>
                    <td className="py-3 px-4 text-xs">{fb.billReceived}</td>
                    <td className="py-3 px-4 max-w-[150px] truncate text-xs">{fb.feedback || '-'}</td>
                    <td className="py-3 px-4 max-w-[150px] truncate text-xs">{fb.suggestions || '-'}</td>
                    <td className="py-3 px-4 max-w-[150px] truncate text-xs">{fb.productUnavailable || '-'}</td>
                    <td className="py-3 px-4 text-xs">{fb.billCompliance}</td>
                    <td className="py-3 px-4 max-w-[150px] truncate text-xs">{fb.complaint || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <Select value={fb.status} onValueChange={v => handleStatusChange(fb._id, v as FeedbackStatus)}>
                        <SelectTrigger className={`h-8 w-32 text-xs font-semibold tracking-wide border-0 focus:ring-1 focus:ring-primary shadow-sm ${STATUS_COLORS[fb.status]}`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s} value={s} className="text-xs font-medium">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      {fb.userName ? (
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                             {fb.userName.charAt(0)}
                           </div>
                           <span className="text-xs font-medium text-muted-foreground">{fb.userName}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-muted/40 tracking-widest italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right sticky right-0 bg-background group-hover:bg-muted/30 transition-colors shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] border-l border-border/20 z-10">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" 
                        onClick={() => openDetail(fb)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {currentFeedbacks.length === 0 && (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-muted-foreground">
                      No feedback records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-card/30">
              <span className="text-xs text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredFeedbacks.length)} of {filteredFeedbacks.length} entries
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  &lt;
                </Button>
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm font-semibold">{currentPage} / {totalPages}</span>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  &gt;
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-3xl border-border/50 shadow-2xl backdrop-blur-3xl overflow-hidden p-0 z-[9999]">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent" />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                <User className="w-4 h-4" />
              </div>
              Feedback Details ({detail?.name})
            </DialogTitle>
          </DialogHeader>
          
          {detail && (
            <div className="px-6 pb-6 space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/40 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Name</span> <span className="font-semibold text-sm">{detail.name}</span></div>
                <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Mobile</span> <span className="font-mono text-sm tracking-wide">{detail.mobile}</span></div>
                <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Store</span> <Badge variant="outline" className="text-xs bg-background">{detail.storeLocation}</Badge></div>
                <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Submission</span> <span className="text-sm font-medium">{new Date(detail.createdAt).toLocaleString('en-IN')}</span></div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Activity className="w-3.5 h-3.5"/> Ratings & Service</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Staff Behaviour</p>
                      <RatingStars value={detail.staffBehavior} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Staff Service</p>
                      <RatingStars value={detail.staffService} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Overall Satisfaction</p>
                      <span className="text-sm font-bold text-primary">{detail.staffSatisfied}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Price Challenge</p>
                      <span className="text-sm font-bold text-accent">{detail.priceChallenge}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><PackageCheck className="w-3.5 h-3.5"/> Purchase Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Bill Received</p>
                      <Badge variant={(String(detail.billReceived || '').toUpperCase() === 'YES') ? 'default' : 'destructive'} className={(String(detail.billReceived || '').toUpperCase() === 'YES') ? 'bg-success h-5' : 'h-5'}>{detail.billReceived || 'No'}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Bill Compliance</p>
                      <span className="text-sm font-medium">{detail.billCompliance}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                      <p className="text-xs text-muted-foreground">Feedback Type</p>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{detail.type}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><ThumbsUp className="w-3.5 h-3.5"/> Verbatim Feedback</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {detail.feedback && (
                    <div className="border border-primary/10 rounded-xl overflow-hidden">
                      <div className="bg-primary/5 px-3 py-1.5 border-b border-primary/10"><p className="text-[10px] font-bold text-primary uppercase tracking-wider">Your Feedback</p></div>
                      <div className="p-3 bg-background/50 text-sm italic">"{detail.feedback}"</div>
                    </div>
                  )}
                  {detail.suggestions && (
                    <div className="border border-success/10 rounded-xl overflow-hidden">
                      <div className="bg-success/5 px-3 py-1.5 border-b border-success/10"><p className="text-[10px] font-bold text-success uppercase tracking-wider">Your Suggestions</p></div>
                      <div className="p-3 bg-background/50 text-sm italic">"{detail.suggestions}"</div>
                    </div>
                  )}
                  {detail.complaint && (
                    <div className="border border-destructive/10 rounded-xl overflow-hidden md:col-span-2">
                      <div className="bg-destructive/5 px-3 py-1.5 border-b border-destructive/10"><p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Your Complaint</p></div>
                      <div className="p-3 bg-background/50 text-sm font-medium text-destructive">{detail.complaint}</div>
                    </div>
                  )}
                  {detail.productUnavailable && (
                    <div className="border border-warning/10 rounded-xl overflow-hidden md:col-span-2">
                      <div className="bg-warning/5 px-3 py-1.5 border-b border-warning/10"><p className="text-[10px] font-bold text-warning uppercase tracking-wider">Product Unavailable Details</p></div>
                      <div className="p-3 bg-background/50 text-sm">{detail.productUnavailable}</div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-6 border-t border-border/50 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Administrative Resolution</p>
                  <div className="flex items-center gap-4">
                    {/* Role-based Assignment Control */}
                    {(role === 'superadmin' || role === 'admin') && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Assign To:</span>
                        <Select value={assignedUser} onValueChange={setAssignedUser}>
                          <SelectTrigger className="h-8 w-36 text-xs font-medium border-border/50 bg-background shadow-sm">
                            <SelectValue placeholder="No User" />
                          </SelectTrigger>
                          <SelectContent className="z-[9999]">
                            {AVAILABLE_STAFF.map(staff => (
                              <SelectItem key={staff} value={staff} className="text-xs">{staff}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Mark As:</span>
                      <Select value={detail.status} onValueChange={(v) => setDetail({...detail, status: v as FeedbackStatus})}>
                        <SelectTrigger className={`h-8 w-36 text-xs font-bold tracking-wide border-0 focus:ring-1 focus:ring-primary shadow-sm ${STATUS_COLORS[detail.status]}`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s} value={s} className="text-xs font-medium">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Textarea 
                  value={statusNote} 
                  onChange={e => setStatusNote(e.target.value)} 
                  placeholder="Record internal notes for resolution or follow-up..." 
                  rows={3}
                  className="bg-card/50 resize-none focus-visible:ring-primary/40 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/40 flex items-center justify-between">
            <Button variant="outline" className="font-semibold" onClick={() => setDetail(null)}>Discard</Button>
            <Button onClick={saveNotes} className="shadow-lg shadow-primary/25 font-bold px-8">Save & Sync</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
