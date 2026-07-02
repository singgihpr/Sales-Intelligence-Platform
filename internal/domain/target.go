package domain

type Target struct {
	ID                  string     `json:"id"`
	UserID              string     `json:"user_id"`
	Month               int        `json:"month"`
	Year                int        `json:"year"`
	TargetBE            float64    `json:"target_be"`
	PercentageConfig    *BonusConfig `json:"percentage_config"`
	VolumeConfig        *VolumeConfig `json:"volume_config"`
	ActiveOutletsConfig *BonusConfig  `json:"active_outlets_config"`
}

type BonusConfig struct {
	BaseReward float64       `json:"base_reward"`
	Tiers      []BonusTier   `json:"tiers"`
}

type BonusTier struct {
	Threshold float64 `json:"threshold"`
	Reward    float64 `json:"reward"`
	Label     string  `json:"label"`
}

type VolumeConfig struct {
	Tiers []VolumeTier `json:"tiers"`
}

type VolumeTier struct {
	Threshold float64 `json:"threshold"`
	Reward    float64 `json:"reward"`
	Label     string  `json:"label"`
}

type TargetRepository interface {
	FindByID(id string) (*Target, error)
	FindByUserAndMonth(userID string, month, year int) (*Target, error)
	List(search string, page, limit int, userID string) ([]TargetJoined, int, error)
	Upsert(t *Target) error
	Update(t *Target) error
	Delete(id string) error
}

type TargetJoined struct {
	Target
	UserName string `json:"user_name"`
}

// Bonus calculation results
type PercentageBonusResult struct {
	Attainment float64    `json:"attainment"`
	Bonus      float64    `json:"bonus"`
	Tier       *BonusTier `json:"tier"`
}

type VolumeBonusResult struct {
	Bonus float64      `json:"bonus"`
	Tier  *VolumeTier  `json:"tier"`
}

type ActiveOutletsBonusResult struct {
	Percent       float64    `json:"percent"`
	ActiveCount   int        `json:"active_count"`
	TotalAssigned int        `json:"total_assigned"`
	Bonus         float64    `json:"bonus"`
	Tier          *BonusTier `json:"tier"`
}

type UserDashboardData struct {
	User            User               `json:"user"`
	DashboardStats  DashboardStats     `json:"dashboardStats"`
	BonusSummary    BonusSummary       `json:"bonusSummary"`
	Outlets         []OutletHealth     `json:"outlets"`
	SKUPPerformance []SKUPPerformance  `json:"skuPerformance"`
	DaysElapsed     int                 `json:"daysElapsed"`
	DaysInMonth     int                 `json:"daysInMonth"`
}

type DashboardStats struct {
	MonthlyTargetBE   float64      `json:"monthlyTargetBE"`
	CurrentBE         float64      `json:"currentBE"`
	DaysElapsed       int          `json:"daysElapsed"`
	TotalWorkingDays  int          `json:"totalWorkingDays"`
	DaysInMonth       int          `json:"daysInMonth"`
	PercentageConfig  *BonusConfig `json:"percentageConfig"`
	VolumeConfig      *VolumeConfig `json:"volumeConfig"`
	ActiveOutletsConfig *BonusConfig `json:"activeOutletsConfig"`
}

type BonusSummary struct {
	Percentage    PercentageBonusResult    `json:"percentage"`
	Volume        VolumeBonusResult        `json:"volume"`
	ActiveOutlets ActiveOutletsBonusResult `json:"activeOutlets"`
	Total         float64                  `json:"total"`
}

type OutletHealth struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Type             string          `json:"type"`
	Address          string          `json:"address"`
	Contact          string          `json:"contact"`
	BranchArea       string          `json:"branchArea"`
	Salesman         string          `json:"salesman,omitempty"`
	BEMonth          float64         `json:"beMonth"`
	Health           int             `json:"health"`
	HealthBreakdown  OHSBreakdown    `json:"healthBreakdown"`
	TotalBE3Mo       float64         `json:"totalBE3Mo"`
	AvgBE            float64         `json:"avgBE"`
	Trend            float64         `json:"trend"`
	Freq3Mo          int             `json:"freq3Mo"`
	LastOrder        string          `json:"lastOrder"`
	Alert            *string         `json:"alert"`
}

type SKUPPerformance struct {
	Name               string           `json:"name"`
	Volume             float64          `json:"volume"`
	TransactionCount   int              `json:"transactionCount"`
	AvgOrder           float64          `json:"avgOrder"`
	TopOutlet          string           `json:"topOutlet"`
	TopOutletVolume    float64          `json:"topOutletVolume"`
	TopOutletContrib   float64          `json:"topOutletContrib"`
	MixPercent         float64          `json:"mixPercent"`
	MoMTrend           float64          `json:"momTrend"`
	YoYTrend           float64          `json:"yoyTrend"`
	PrevVolume         float64          `json:"prevVolume"`
	PrevTransactionCount int           `json:"prevTransactionCount"`
	MonthlyHistory     []float64        `json:"monthlyHistory"`
	Transactions       []SKUTransaction `json:"transactions"`
	PrevTransactions   []SKUTransaction `json:"prevTransactions"`
}

type SalesDashboardData struct {
	User            User               `json:"user"`
	DashboardStats  DashboardStats     `json:"dashboardStats"`
	BonusSummary    BonusSummary       `json:"bonusSummary"`
	Outlets         []OutletHealth     `json:"outlets"`
	SKUPPerformance []SKUPPerformance  `json:"skuPerformance"`
	DaysElapsed     int                `json:"daysElapsed"`
	DaysInMonth     int                `json:"daysInMonth"`
}

type SupervisorDashboardData struct {
	Team          []TeamMember     `json:"team"`
	TeamStats     TeamStats        `json:"teamStats"`
	SKUPPerformance []SKUPPerformance `json:"skuPerformance"`
	Outlets       []OutletHealth   `json:"outlets"`
}

type TeamMember struct {
	ID              string                   `json:"id"`
	Name            string                   `json:"name"`
	Email           string                   `json:"email"`
	Role            Role                     `json:"role"`
	Region          string                   `json:"region"`
	Level           *Level                   `json:"level"`
	CurrentBE       float64                  `json:"currentBE"`
	TargetBE        float64                  `json:"targetBE"`
	Attainment      int                      `json:"attainment"`
	TotalBonus      float64                  `json:"totalBonus"`
	TotalAssigned   int                      `json:"totalAssigned"`
	ActiveCount     int                      `json:"activeCount"`
	PercentageResult PercentageBonusResult    `json:"percentageResult"`
	VolumeResult    VolumeBonusResult         `json:"volumeResult"`
	ActiveResult    ActiveOutletsBonusResult  `json:"activeResult"`
}

type TeamStats struct {
	TotalTeamBE    float64 `json:"totalTeamBE"`
	TotalTarget    float64 `json:"totalTarget"`
	TeamAttainment int     `json:"teamAttainment"`
	VacantOutlets  int     `json:"vacantOutlets"`
}
