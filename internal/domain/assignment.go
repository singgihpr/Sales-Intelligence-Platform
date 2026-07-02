package domain

import "time"

type OutletAssignment struct {
	ID           string     `json:"id"`
	OutletID     string     `json:"outlet_id"`
	SalesmanID   *string    `json:"salesman_id"`
	AssignedAt   time.Time  `json:"assigned_at"`
	UnassignedAt *time.Time `json:"unassigned_at"`
	AssignedBy   *string    `json:"assigned_by"`
	Notes        string     `json:"notes"`
}

type AssignmentJoined struct {
	ID           string  `json:"id"`
	OutletID     string  `json:"outlet_id"`
	SalesmanID   *string `json:"salesman_id"`
	AssignedAt   string  `json:"assigned_at"`
	UnassignedAt *string `json:"unassigned_at"`
	Notes        string  `json:"notes"`
	OutletName   string  `json:"outlet_name"`
	BranchArea   string  `json:"branch_area"`
	SalesmanName *string `json:"salesman_name"`
}

type AssignmentRepository interface {
	FindByID(id string) (*OutletAssignment, error)
	ListActive(search string, page, limit int) ([]AssignmentJoined, int, error)
	Create(a *OutletAssignment) error
	Unassign(id string) error
	UnassignByOutlet(outletID string) error
	GetActiveByOutlet(outletID string) (*OutletAssignment, error)
	BulkAutoAssign(assignments []AutoAssignment) (int, int, error)
}

type AutoAssignment struct {
	OutletID  string
	SalesmanID string
	Volume    float64
}
