package domain

import "time"

type Role string

const (
	RoleSales     Role = "sales"
	RoleSupervisor Role = "supervisor"
	RoleAdmin     Role = "admin"
)

type Level string

const (
	LevelL2 Level = "L2"
	LevelL3 Level = "L3"
)

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Role         Role      `json:"role"`
	Region       string    `json:"region"`
	Level        *Level    `json:"level"`
	PasswordHash string    `json:"-"`
	NetlifyUID   string    `json:"-"`
	SupervisorID *string   `json:"supervisor_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type UserRepository interface {
	FindByID(id string) (*User, error)
	FindByEmail(email string) (*User, error)
	List(search string, page, limit int) ([]User, int, error)
	Create(u *User) error
	Update(u *User) error
	Delete(id string) error
	ListByRole(role Role) ([]User, error)
	ListBySupervisor(supervisorID string) ([]User, error)
	ListAllSales() ([]User, error)
}
