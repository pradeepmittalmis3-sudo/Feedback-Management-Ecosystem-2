import { Feedback, STORE_LOCATIONS, STATUS_OPTIONS, type FeedbackStatus } from '@/types/feedback';

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRating(): number {
  return Math.floor(Math.random() * 5) + 1;
}

const names = [
  'Rahul Sharma', 'Priya Singh', 'Amit Kumar', 'Sneha Gupta', 'Vikram Patel',
  'Anjali Verma', 'Rohit Jain', 'Kavita Yadav', 'Deepak Mishra', 'Pooja Chauhan',
  'Ravi Tiwari', 'Neha Agarwal', 'Suresh Pandey', 'Meena Devi', 'Arjun Reddy',
  'Lakshmi Nair', 'Manish Dubey', 'Sunita Rani', 'Aakash Mehta', 'Divya Saxena',
];

const complaints = [
  'Staff was rude and unhelpful', 'Product quality was poor', 'Long waiting time',
  'Wrong product delivered', 'Store was very dirty', '', '', '', '', '',
];

const feedbacks = [
  'Great service overall', 'Nice collection of products', 'Good pricing',
  'Staff was very helpful', 'Clean and well-organized store', '', '', '', '',
];

const suggestions = [
  'Add more branded products', 'Improve AC in store', 'Open early morning',
  'Add online ordering', 'More parking space needed', '', '', '', '',
];

export function generateMockFeedbacks(count: number = 50): Feedback[] {
  const feedbackList: Feedback[] = [];
  
  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60));
    
    feedbackList.push({
      _id: `fb_${i.toString().padStart(4, '0')}`,
      name: randomFrom(names),
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      storeLocation: randomFrom(STORE_LOCATIONS),
      staffBehavior: randomRating(),
      staffService: randomRating(),
      staffSatisfied: Math.random() > 0.3 ? 'YES' : 'NO',
      priceChallenge: Math.random() > 0.8 ? 'YES' : 'NO',
      billReceived: Math.random() > 0.1 ? 'YES' : 'NO',
      feedback: randomFrom(feedbacks),
      suggestions: randomFrom(suggestions),
      productUnavailable: Math.random() > 0.7 ? 'Rice, Dal, Sugar' : '',
      billCompliance: Math.random() > 0.2 ? 'YES' : 'NO',
      complaint: randomFrom(complaints),
      type: Math.random() > 0.5 ? 'Feedback' : 'Complaint',
      status: randomFrom(STATUS_OPTIONS),
      statusNotes: '',
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  }
  
  return feedbackList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
