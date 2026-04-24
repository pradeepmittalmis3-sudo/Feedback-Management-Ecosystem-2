export type UserRole = 'superadmin' | 'admin' | 'user' | 'viewer';
export type FeedbackStatus =
  | 'New'
  | 'Active'
  | 'In Progress'
  | 'Complaint'
  | 'Solved'
  | 'Resolved'
  | 'Closed'
  | 'Archived'
  | 'Feedback'
  | 'Fake'
  | 'Channel Partner Store'
  | 'Pending'
  | 'Channel Partner';

export type FeedbackSource = 'app' | 'google_form' | 'sheet' | 'migration' | 'legacy' | string;

export interface Feedback {
  _id: string;
  name: string;
  mobile: string;
  storeLocation: string;
  staffBehavior: number;
  staffService: number;
  staffSatisfied: string;
  priceChallenge: string;
  billReceived: string;
  feedback: string;
  suggestions?: string;
  productUnavailable?: string;
  billCompliance: string;
  complaint?: string;
  type: string;
  userName?: string;
  assignedTo?: string;
  mode?: string;
  remarks?: string;
  updatedBy?: string;
  improvementFeedback?: string;
  department?: string;
  externalId?: string;
  source?: FeedbackSource;
  status: FeedbackStatus;
  statusNotes?: string;
  resolvedAt?: string;
  closedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackFilters {
  store: string;
  status: FeedbackStatus | 'All';
  dateFrom: string;
  dateTo: string;
  search: string;
  ratingMin: number;
}

export const STORE_LOCATIONS = [
  'BHOGAL', 'BINDAPUR', 'DEVLI', 'DWARKA MOR', 'DWARKA SECTOR-12',
  'FARIDABAD', 'FATEH NAGAR', 'GANESH NAGAR', 'GHAZIABAD',
  'GURU HARKISHAN NAGAR', 'INDIRA PARK', 'JANAK PURI',
  'JWALA HERI - A6', 'JWALA HERI - A6 NEW', 'JWALA HERI - B2',
  'KALKA JI', 'KARAWAL NAGAR', 'KHICHDIPUR', 'KHIRKI EXTENSION',
  'KIRAN GARDEN', 'KRISHNA NAGAR', 'KRISHNA NAGAR - JHEEL',
  'LAXMI NAGAR', 'MAHAVIR ENCLAVE 3', 'MAHAVIR ENCLAVE- NEW',
  'MALVIYA NAGAR', 'MEERA BAGH', 'MOHAN GARDEN', 'NANGAL RAYA',
  'NANGLOI', 'NOIDA SEC-104', 'PALAM METRO STATION', 'RAJA PURI',
  'RAJOURI GARDEN', 'RAJOURI GARDEN 2', 'SHAHDARA', 'SHAKARPUR',
  'TAIMOOR NAGAR', 'TILAK NAGAR', 'UTTAM NAGAR', 'UTTAM NAGAR - ASR',
  'VIKAS PURI', 'VIKAS PURI 2', 'VISHNU GARDEN', 'VISHNU GARDEN - NEW',
] as const;

export const STATUS_OPTIONS: FeedbackStatus[] = [
  'New',
  'Active',
  'In Progress',
  'Pending',
  'Complaint',
  'Feedback',
  'Solved',
  'Resolved',
  'Closed',
  'Archived',
  'Fake',
  'Channel Partner Store',
  'Channel Partner',
];

export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  'New': 'bg-info/15 text-info',
  'Active': 'bg-primary/15 text-primary',
  'In Progress': 'bg-warning/15 text-accent',
  'Complaint': 'bg-destructive/15 text-destructive',
  'Solved': 'bg-success/15 text-success',
  'Resolved': 'bg-success/15 text-success',
  'Closed': 'bg-slate-100 text-slate-700',
  'Archived': 'bg-muted text-muted-foreground',
  'Feedback': 'bg-info/15 text-info',
  'Fake': 'bg-muted text-muted-foreground',
  'Channel Partner Store': 'bg-orange-100 text-orange-700',
  'Pending': 'bg-warning/15 text-accent',
  'Channel Partner': 'bg-primary/15 text-primary',
};
