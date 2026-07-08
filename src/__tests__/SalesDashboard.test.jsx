import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test-utils';
import SalesDashboard from '../components/SalesDashboard';

const mockData = {
  user: { id: '1', name: 'John Doe', region: 'Jakarta', level: 'L3' },
  dashboardStats: {
    monthlyTargetBE: 1000,
    currentBE: 750,
    daysElapsed: 15,
    totalWorkingDays: 22,
    daysInMonth: 30,
    percentageConfig: {
      base_reward: 1200000,
      tiers: [
        { threshold: 90, reward: 600000, label: '90%' },
        { threshold: 100, reward: 1200000, label: '100%' },
        { threshold: 110, reward: 1500000, label: '110%' },
      ],
    },
    volumeConfig: {
      tiers: [
        { threshold: 1500, reward: 250000, label: 'Tier 1' },
        { threshold: 2500, reward: 500000, label: 'Tier 2' },
        { threshold: 3500, reward: 750000, label: 'Tier 3' },
      ],
    },
    activeOutletsConfig: {
      base_reward: 400000,
      tiers: [
        { threshold: 90, reward: 200000, label: '90%' },
        { threshold: 100, reward: 400000, label: '100%' },
        { threshold: 125, reward: 500000, label: '125%' },
      ],
    },
  },
  bonusSummary: {
    total: 2500000,
    percentage: { attainment: 75, bonus: 500000, tier: null },
    volume: { bonus: 1000000, tier: null },
    activeOutlets: { activeCount: 8, totalAssigned: 10, bonus: 1000000, tier: null },
  },
  outlets: [
    { id: '1', name: 'Outlet A', type: 'Retail', health: 80, beMonth: 100, alert: null, lastOrder: '2 days ago', branchArea: 'Jakarta' },
    { id: '2', name: 'Outlet B', type: 'Wholesale', health: 35, beMonth: 50, alert: 'Needs Attention', lastOrder: '10 days ago', branchArea: 'Bogor' },
  ],
  skuPerformance: [
    {
      name: 'Apple 9KG',
      volume: 120.5,
      transactionCount: 15,
      avgOrder: 8.0,
      topOutlet: 'Outlet A',
      topOutletVolume: 60,
      topOutletContrib: 50,
      mixPercent: 45.5,
      momTrend: 12.5,
      yoyTrend: 5.0,
      prevVolume: 107.1,
      prevTransactionCount: 12,
      monthlyHistory: [100, 105, 110, 120.5],
      transactions: [],
      prevTransactions: [],
    },
  ],
  daysElapsed: 15,
  daysInMonth: 30,
};

describe('SalesDashboard', () => {
  describe('✅ Render & Header', () => {
    it('renders greeting with user name', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText('Halo, John Doe')).toBeInTheDocument();
    });

    it('renders region and level info', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText(/Jakarta.*L3/)).toBeInTheDocument();
    });
  });

  describe('✅ Attainment Gauge', () => {
    it('renders attainment percentage', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getAllByText('75%')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Attainment')[0]).toBeInTheDocument();
    });

    it('renders actual vs target BE', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText('750.0')).toBeInTheDocument();
      expect(screen.getByText('/ 1000')).toBeInTheDocument();
    });

    it('renders projected attainment', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText(/Proyeksi Akhir/)).toBeInTheDocument();
    });
  });

  describe('✅ Bonus Cards', () => {
    it('renders bonus summary', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getAllByText(/Rp/)[0]).toBeInTheDocument();
    });

    it('renders percentage bonus card', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText('Detail Bonus')).toBeInTheDocument();
    });
  });

  describe('✅ SKU Analysis', () => {
    it('renders SKU analysis section', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText('Analisa Produk')).toBeInTheDocument();
    });

    it('renders SKU item with name', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.getByText('Apple 9KG')).toBeInTheDocument();
    });
  });

  describe('✅ Removed Sections', () => {
    it('does not render visit schedule section', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.queryByText('Jadwal Kunjungan')).not.toBeInTheDocument();
    });

    it('does not render outlet health section', () => {
      render(<SalesDashboard data={mockData} onVisitClick={vi.fn()} />);
      expect(screen.queryByText('Outlet Perlu Perhatian')).not.toBeInTheDocument();
    });
  });

  describe('✅ Loading State', () => {
    it('renders loading state when data is null', () => {
      render(<SalesDashboard data={null} onVisitClick={vi.fn()} />);
      expect(screen.getByText('Memuat dashboard...')).toBeInTheDocument();
    });
  });
});
