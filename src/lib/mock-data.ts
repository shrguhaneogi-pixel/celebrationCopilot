export interface MockBudgetItem {
  id: string;
  name: string;
  category: string;
  estimatedCost: number;
  actualCost: number;
  status: 'projected' | 'quoted' | 'committed' | 'paid';
  notes?: string;
}

export interface MockMilestone {
  id: string;
  title: string;
  offsetDays: number;
  dueDate: string;
  category: 'venue' | 'catering' | 'media' | 'planning' | 'execution';
  completed: boolean;
}

export interface MockVendorItem {
  id: string;
  name: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  status: 'not_started' | 'contacted' | 'quoted' | 'booked';
  suggestedQuestions: string[];
}

export interface MockProposalDiff {
  title: string;
  costDelta: number;
  mutations: string[];
}

export interface MockChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  proposalDiff?: MockProposalDiff;
}

export interface MockEventPlan {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  venue: string;
  guestCount: number;
  currency: string;
  totalCap: number;
  items: MockBudgetItem[];
  milestones: MockMilestone[];
  vendors: MockVendorItem[];
  chatHistory: MockChatMessage[];
}

export const MOCK_EVENT_PLAN: MockEventPlan = {
  id: 'plan-in-wed-001',
  title: "Aarav & Priya's Grand Wedding & Reception",
  eventType: 'Traditional Indian Wedding (Sangeet, Varmala & Reception)',
  eventDate: '2026-12-18',
  venue: 'The Grand Heritage Palace, Jaipur, Rajasthan',
  guestCount: 450,
  currency: 'INR',
  totalCap: 2500000, // ₹25,00,000
  items: [
    {
      id: 'item-1',
      name: 'Palace Mandap & Royal Floral Decor',
      category: 'Decoration',
      estimatedCost: 450000,
      actualCost: 420000,
      status: 'committed',
      notes: 'Planning estimate: Marigold, jasmine & royal mandap lighting setup',
    },
    {
      id: 'item-2',
      name: 'Royal Rajasthani & Multi-Cuisine Buffet',
      category: 'Catering',
      estimatedCost: 900000,
      actualCost: 900000,
      status: 'quoted',
      notes: 'Planning estimate: 450 plates including live chaat & dessert counters',
    },
    {
      id: 'item-3',
      name: 'Cinematic Wedding Photography & Drone',
      category: 'Media',
      estimatedCost: 300000,
      actualCost: 280000,
      status: 'committed',
      notes: 'Planning estimate: 3-day coverage including teaser and 4K album',
    },
    {
      id: 'item-4',
      name: 'Sangeet DJ, Stage Sound, Lighting & Dhol',
      category: 'Entertainment',
      estimatedCost: 180000,
      actualCost: 150000,
      status: 'projected',
      notes: 'Planning estimate: Sound console, moving heads & 2 dhol players',
    },
    {
      id: 'item-5',
      name: 'Bridal Mehendi, Makeup & Trousseau',
      category: 'Attire & Beauty',
      estimatedCost: 250000,
      actualCost: 260000,
      status: 'committed',
      notes: 'Planning estimate: Organic bridal henna & bridal party styling',
    },
    {
      id: 'item-6',
      name: 'Invitations, E-Invites & Traditional Favors',
      category: 'Stationery & Favors',
      estimatedCost: 100000,
      actualCost: 90000,
      status: 'paid',
      notes: 'Planning estimate: Boxed sweets (mithai) and wax-sealed invitations',
    },
  ],
  milestones: [
    {
      id: 'ms-1',
      title: 'Book Royal Heritage Palace Venue & Room Inventory',
      offsetDays: -180,
      dueDate: '2026-06-21',
      category: 'venue',
      completed: true,
    },
    {
      id: 'ms-2',
      title: 'Finalize Royal Catering Menu & Live Chaat Stations',
      offsetDays: -90,
      dueDate: '2026-09-19',
      category: 'catering',
      completed: false,
    },
    {
      id: 'ms-3',
      title: 'Confirm Cinematic Photography & Drone Team',
      offsetDays: -60,
      dueDate: '2026-10-19',
      category: 'media',
      completed: true,
    },
    {
      id: 'ms-4',
      title: 'Sangeet Choreography & Family Rehearsals',
      offsetDays: -14,
      dueDate: '2026-12-04',
      category: 'planning',
      completed: false,
    },
    {
      id: 'ms-5',
      title: 'Final Guest RSVP Count & Seating Confirmation',
      offsetDays: -7,
      dueDate: '2026-12-11',
      category: 'planning',
      completed: false,
    },
    {
      id: 'ms-6',
      title: 'Wedding Day Celebrations & Grand Reception',
      offsetDays: 0,
      dueDate: '2026-12-18',
      category: 'execution',
      completed: false,
    },
  ],
  vendors: [
    {
      id: 'ven-1',
      name: 'Royal Heritage Palaces (Illustrative)',
      category: 'Venue & Stays',
      priority: 'high',
      status: 'booked',
      suggestedQuestions: [
        'What is the curfew for outdoor music and Baraat processions?',
        'Is 100% generator power backup covered for the mandap and banquet?',
        'Are outside catering teams permitted in the banquet kitchen?',
      ],
    },
    {
      id: 'ven-2',
      name: 'Shahi Rasoi Catering (Illustrative)',
      category: 'Catering & Sweets',
      priority: 'high',
      status: 'quoted',
      suggestedQuestions: [
        'Is there a strictly segregated preparation area for pure vegetarian/Jain food?',
        'How many live counter chefs are deployed during peak dining hours?',
        'What is your standard protocol for food replenishment during large buffets?',
      ],
    },
    {
      id: 'ven-3',
      name: 'Drishti Cinematic Studios (Illustrative)',
      category: 'Photography & Film',
      priority: 'medium',
      status: 'booked',
      suggestedQuestions: [
        'Are drone permissions and palace clearance included in the contract?',
        'What is the guaranteed delivery turnaround for the 3-minute teaser reel?',
        'How many candid vs traditional photographers will be on-site?',
      ],
    },
    {
      id: 'ven-4',
      name: 'Desi Beats & Brass Band (Illustrative)',
      category: 'Entertainment',
      priority: 'medium',
      status: 'contacted',
      suggestedQuestions: [
        'How many dhol drummers and brass instrumentalists participate in the Baraat troupe?',
        'Do you provide wireless microphones for Sangeet emcees and family speeches?',
        'What are the electrical load and power connection specifications?',
      ],
    },
  ],
  chatHistory: [
    {
      id: 'msg-1',
      sender: 'user',
      text: 'Add 4 live Punjabi dhol players and a brass band for the Baraat entry on wedding day.',
      timestamp: '10:42 AM',
    },
    {
      id: 'msg-2',
      sender: 'assistant',
      text: "I've generated a proposal to add the Baraat dhol & brass band ensemble. Please review the proposal diff below before applying it to your live plan.",
      timestamp: '10:42 AM',
      proposalDiff: {
        title: 'Add Baraat Dhol & Brass Band Ensemble',
        costDelta: 45000,
        mutations: [
          'ADD_BUDGET_ITEM: Baraat Dhol Players & Brass Band (₹45,000 estimated)',
          'ADD_MILESTONE: Sound check Baraat ensemble at -1d (17 Dec 2026)',
        ],
      },
    },
  ],
};
