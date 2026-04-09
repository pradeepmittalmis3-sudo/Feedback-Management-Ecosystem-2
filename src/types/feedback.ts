export type UserRole = 'superadmin' | 'admin' | 'user' | 'viewer';
export type FeedbackStatus = 'Complaint' | 'Feedback' | 'Fake' | 'Pending' | 'Solved' | 'Channel Partner';

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
  department?: string;
  externalId?: string;
  status: FeedbackStatus;
  statusNotes?: string;
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
  'Complaint', 'Feedback', 'Fake', 'Pending', 'Solved', 'Channel Partner'
];

export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  'Complaint': 'bg-destructive/15 text-destructive',
  'Feedback': 'bg-info/15 text-info',
  'Fake': 'bg-muted text-muted-foreground',
  'Pending': 'bg-warning/15 text-accent',
  'Solved': 'bg-success/15 text-success',
  'Channel Partner': 'bg-primary/15 text-primary',
};
