package domain

import "time"

type Outlet struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	BranchArea    string    `json:"branch_area"`
	Address       string    `json:"address"`
	ContactPerson string    `json:"contact_person"`
	CreatedAt     time.Time `json:"created_at"`
}

type OutletRepository interface {
	FindByID(id string) (*Outlet, error)
	List(search string, page, limit int) ([]Outlet, int, error)
	ListAll() ([]Outlet, error)
	Create(o *Outlet) error
	Update(o *Outlet) error
	Delete(id string) error
	ListVacant(search string, page, limit int) ([]Outlet, int, error)
	BulkCreate(outlets []Outlet) error
}
