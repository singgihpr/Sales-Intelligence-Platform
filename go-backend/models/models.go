package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type User struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Email        string         `json:"email"`
	Role         string         `json:"role"`
	Region       string         `json:"region"`
	Level        *string        `json:"level"`
	PasswordHash string         `json:"password_hash,omitempty"`
	SupervisorID *string        `json:"supervisor_id"`
	CreatedAt    time.Time      `json:"created_at"`
}

type Outlet struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	BranchArea    string    `json:"branch_area"`
	Address       string    `json:"address"`
	ContactPerson string    `json:"contact_person"`
	CreatedAt     time.Time `json:"created_at"`
}

type SalesRecord struct {
	ID        string      `json:"id"`
	OutletID  *string     `json:"outlet_id"`
	SalesID   *string     `json:"sales_id"`
	RecordDate pgtype.Date `json:"record_date"`
	VolumeBE  float64     `json:"volume_be"`
	SKUName   string      `json:"sku_name"`
}

type OutletAssignment struct {
	ID           string     `json:"id"`
	OutletID     string     `json:"outlet_id"`
	SalesmanID   *string    `json:"salesman_id"`
	AssignedAt   time.Time  `json:"assigned_at"`
	UnassignedAt *time.Time `json:"unassigned_at"`
	AssignedBy   *string    `json:"assigned_by"`
	Notes        string     `json:"notes"`
}

type Target struct {
	ID                 string      `json:"id"`
	UserID             string      `json:"user_id"`
	Month              int         `json:"month"`
	Year               int         `json:"year"`
	TargetBE           float64     `json:"target_be"`
	PercentageConfig   interface{} `json:"percentage_config"`
	VolumeConfig       interface{} `json:"volume_config"`
	ActiveOutletsConfig interface{} `json:"active_outlets_config"`
}

type SKU struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type SKUIncentive struct {
	ID        string      `json:"id"`
	SKUName   string      `json:"sku_name"`
	BonusBE   float64     `json:"bonus_be"`
	StartDate pgtype.Date `json:"start_date"`
	EndDate   pgtype.Date `json:"end_date"`
	IsActive  bool        `json:"is_active"`
	CreatedBy *string     `json:"created_by"`
	Notes     string      `json:"notes"`
	CreatedAt time.Time   `json:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"totalPages"`
}

type DashboardStats struct {
	MonthlyTargetBE    float64     `json:"monthlyTargetBE"`
	CurrentBE          float64     `json:"currentBE"`
	IncentiveBE        float64     `json:"incentiveBE"`
	TotalWithIncentive float64     `json:"totalWithIncentive"`
	DaysElapsed        int         `json:"daysElapsed"`
	TotalWorkingDays   int         `json:"totalWorkingDays"`
	DaysInMonth        int         `json:"daysInMonth"`
	RangeDays          int         `json:"rangeDays"`
	PercentageConfig   interface{} `json:"percentageConfig"`
	VolumeConfig       interface{} `json:"volumeConfig"`
	ActiveOutletsConfig interface{} `json:"activeOutletsConfig"`
}

type BonusResult struct {
	Attainment float64     `json:"attainment"`
	Bonus      float64     `json:"bonus"`
	Tier       interface{} `json:"tier"`
}

type ActiveOutletsResult struct {
	Percent     float64     `json:"percent"`
	Bonus       float64     `json:"bonus"`
	Tier        interface{} `json:"tier"`
	ActiveCount int         `json:"activeCount"`
	TotalAssigned int       `json:"totalAssigned"`
}

type BonusSummary struct {
	Percentage   BonusResult         `json:"percentage"`
	Volume       BonusResult         `json:"volume"`
	ActiveOutlets ActiveOutletsResult `json:"activeOutlets"`
	Total        float64             `json:"total"`
}

type OutletHealth struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Type            string  `json:"type"`
	Address         string  `json:"address"`
	Contact         string  `json:"contact"`
	BranchArea      string  `json:"branchArea"`
	BEMonth         float64 `json:"beMonth"`
	Health          int     `json:"health"`
	HealthBreakdown struct {
		Volume    int `json:"volume"`
		Trend     int `json:"trend"`
		Frequency int `json:"frequency"`
	} `json:"healthBreakdown"`
	TotalBE3Mo float64 `json:"totalBE3Mo"`
	BePrev     float64 `json:"bePrev"`
	BePrev2    float64 `json:"bePrev2"`
	AvgBE      float64 `json:"avgBE"`
	Trend      float64 `json:"trend"`
	Freq3Mo    int     `json:"freq3Mo"`
	LastOrder  string  `json:"lastOrder"`
	Alert      *string `json:"alert"`
}

type SKUPerformance struct {
	Name              string  `json:"name"`
	Volume            float64 `json:"volume"`
	IncentiveBE       float64 `json:"incentiveBE"`
	TotalBE           float64 `json:"totalBE"`
	TransactionCount  int     `json:"transactionCount"`
	AvgOrder          float64 `json:"avgOrder"`
	TopOutlet         string  `json:"topOutlet"`
	TopOutletVolume   float64 `json:"topOutletVolume"`
	TopOutletContrib  int     `json:"topOutletContrib"`
	MixPercent        float64 `json:"mixPercent"`
	MoMTrend          float64 `json:"momTrend"`
	YoYTrend          float64 `json:"yoyTrend"`
	PrevVolume        float64 `json:"prevVolume"`
	PrevTransactionCount int  `json:"prevTransactionCount"`
	MonthlyHistory    []float64 `json:"monthlyHistory"`
	Penetration       int     `json:"penetration"`
}

type Analytics struct {
	Velocity           []VelocityPoint `json:"velocity"`
	AvgVelocity        float64         `json:"avgVelocity"`
	CoveragePct        int             `json:"coveragePct"`
	ActiveOutletsCount int             `json:"activeOutletsCount"`
	TotalAssignedOutlets int           `json:"totalAssignedOutlets"`
	PenetrationMap     map[string]int  `json:"penetrationMap"`
	WhereToVisit       []WhereToVisit  `json:"whereToVisit"`
	WhatToSell         []WhatToSell    `json:"whatToSell"`
	LostOutlets        []LostOutlet    `json:"lostOutlets"`
	NewOutlets         []NewOutlet     `json:"newOutlets"`
	LostCount          int             `json:"lostCount"`
	NewCount           int             `json:"newCount"`
}

type VelocityPoint struct {
	Date         string  `json:"date"`
	BE           float64 `json:"be"`
	Transactions int     `json:"transactions"`
}

type WhereToVisit struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	BranchArea string  `json:"branchArea"`
	BEMonth    float64 `json:"beMonth"`
	LastOrder  string  `json:"lastOrder"`
	DaysSince  int     `json:"daysSince"`
}

type WhatToSell struct {
	Name           string  `json:"name"`
	Volume         float64 `json:"volume"`
	MoMTrend       float64 `json:"momTrend"`
	Penetration    int     `json:"penetration"`
	ActiveIncentive bool   `json:"activeIncentive"`
}

type LostOutlet struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type NewOutlet struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type TeamMember struct {
	User
	CurrentBE     float64            `json:"currentBE"`
	TargetBE      float64            `json:"targetBE"`
	Attainment    float64            `json:"attainment"`
	TotalBonus    float64            `json:"totalBonus"`
	TotalAssigned int                `json:"totalAssigned"`
	ActiveCount   int                `json:"activeCount"`
	PercentageResult interface{}     `json:"percentageResult"`
	VolumeResult     interface{}     `json:"volumeResult"`
	ActiveResult     interface{}     `json:"activeResult"`
}

type TeamStats struct {
	TotalTeamBE    float64 `json:"totalTeamBE"`
	TotalTarget    float64 `json:"totalTarget"`
	TeamAttainment float64 `json:"teamAttainment"`
	VacantOutlets  int     `json:"vacantOutlets"`
}

type TeamDashboardData struct {
	Team           []TeamMember      `json:"team"`
	TeamStats      TeamStats         `json:"teamStats"`
	SKUPerformance []SKUPerformance  `json:"skuPerformance"`
	Outlets        []OutletHealth    `json:"outlets"`
}

type UserDashboardData struct {
	User           User              `json:"user"`
	DateRange      DateRange         `json:"dateRange"`
	DashboardStats DashboardStats    `json:"dashboardStats"`
	BonusSummary   BonusSummary      `json:"bonusSummary"`
	Outlets        []OutletHealth    `json:"outlets"`
	SKUPerformance []SKUPerformance  `json:"skuPerformance"`
	Analytics      Analytics         `json:"analytics"`
	GroupedData    interface{}       `json:"groupedData"`
	ActiveIncentives []interface{}   `json:"activeIncentives"`
	DaysElapsed    int               `json:"daysElapsed"`
	DaysInMonth    int               `json:"daysInMonth"`
}

type DateRange struct {
	Start   string `json:"start"`
	End     string `json:"end"`
	GroupBy string `json:"groupBy"`
}

type UploadResult struct {
	Success            bool `json:"success"`
	Inserted           int  `json:"inserted"`
	TotalPreviewed     int  `json:"totalPreviewed"`
	NewOutletsCreated  int  `json:"newOutletsCreated"`
	AssignmentsCreated int  `json:"assignmentsCreated"`
	AssignmentsUpdated int  `json:"assignmentsUpdated"`
}
