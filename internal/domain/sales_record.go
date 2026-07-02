package domain

import "time"

type SalesRecord struct {
	ID         string    `json:"id"`
	OutletID   string    `json:"outlet_id"`
	SalesID    string    `json:"sales_id"`
	RecordDate time.Time `json:"record_date"`
	VolumeBE   float64   `json:"volume_be"`
	SKUName    *string   `json:"sku_name"`
}

type SalesRecordRepository interface {
	FindByID(id string) (*SalesRecord, error)
	List(search string, page, limit int, filters ...RecordFilter) ([]SalesRecordJoined, int, error)
	Create(r *SalesRecord) error
	Update(r *SalesRecord) error
	Delete(id string) error
	BulkCreate(records []SalesRecord) (int, error)
	SumVolumeBySales(salesID string, start, end string) (float64, error)
	SumVolumeByOutlet(outletID string, start, end string) (float64, error)
	GetOutletHistory(outletID string, start, end string, page, limit int) ([]SalesRecord, int, error)
}

type SalesRecordJoined struct {
	ID         string  `json:"id"`
	OutletName string  `json:"outlet"`
	SalesName  string  `json:"sales"`
	Date       string  `json:"date"`
	VolumeBE   float64 `json:"be"`
	SKUName    *string `json:"sku"`
	OutletID   string  `json:"outlet_id"`
	SalesID    string  `json:"sales_id"`
}

type RecordFilter struct {
	Field string
	Value string
}

type SKUSummary struct {
	SKUName         string  `json:"sku_name"`
	Volume          float64 `json:"volume"`
	TransactionCount int    `json:"transaction_count"`
	AvgOrder        float64 `json:"avg_order"`
}

type SKUTopOutlet struct {
	SKUName      string  `json:"sku_name"`
	OutletName   string  `json:"outlet_name"`
	OutletVolume float64 `json:"outlet_volume"`
}

type SKUWeekly struct {
	SKUName      string  `json:"sku_name"`
	WeekNum      int     `json:"week_num"`
	WeeklyVolume float64 `json:"weekly_volume"`
}

type SKUTransaction struct {
	Date       string  `json:"date"`
	VolumeBE   float64 `json:"be"`
	OutletName string  `json:"outlet_name"`
}

type DashboardRepository interface {
	GetSalesDashboard(salesID string, month, year int) (*SalesDashboardData, error)
	GetSupervisorDashboard(supervisorID string, isAdmin bool, month, year int) (*SupervisorDashboardData, error)
}
