package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"sales-intelligence/db"
	"sales-intelligence/models"
)

type OutletHandler struct{}

func (h *OutletHandler) ListOutlets(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 5
	}
	offset := (page - 1) * limit
	search := c.QueryParam("search")
	searchPattern := "%" + search + "%"

	ctx := context.Background()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, type, address, contact_person, branch_area, created_at 
		 FROM outlets 
		 WHERE name ILIKE $1 OR type ILIKE $1 OR address ILIKE $1 OR contact_person ILIKE $1 OR branch_area ILIKE $1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		searchPattern, limit, offset,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer rows.Close()

	outlets := []models.Outlet{}
	for rows.Next() {
		var o models.Outlet
		if err := rows.Scan(&o.ID, &o.Name, &o.Type, &o.Address, &o.ContactPerson, &o.BranchArea, &o.CreatedAt); err != nil {
			continue
		}
		outlets = append(outlets, o)
	}

	var total int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM outlets WHERE name ILIKE $1 OR type ILIKE $1 OR address ILIKE $1 OR contact_person ILIKE $1 OR branch_area ILIKE $1`,
		searchPattern,
	).Scan(&total)

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       outlets,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: (total + limit - 1) / limit,
	})
}

func (h *OutletHandler) CreateOutlet(c echo.Context) error {
	var req struct {
		Name          string `json:"name"`
		Type          string `json:"type"`
		Address       string `json:"address"`
		ContactPerson string `json:"contact_person"`
		BranchArea    string `json:"branch_area"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx := context.Background()
	var outlet models.Outlet
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO outlets (id, name, type, address, contact_person, branch_area) 
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING *`,
		req.Name, req.Type, req.Address, req.ContactPerson, req.BranchArea,
	).Scan(&outlet.ID, &outlet.Name, &outlet.Type, &outlet.BranchArea, &outlet.Address, &outlet.ContactPerson, &outlet.CreatedAt)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create outlet"})
	}

	return c.JSON(http.StatusCreated, outlet)
}

func (h *OutletHandler) UpdateOutlet(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	var req struct {
		Name          string `json:"name"`
		Type          string `json:"type"`
		Address       string `json:"address"`
		ContactPerson string `json:"contact_person"`
		BranchArea    string `json:"branch_area"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx := context.Background()
	var outlet models.Outlet
	err := db.Pool.QueryRow(ctx,
		`UPDATE outlets SET name=$1, type=$2, address=$3, contact_person=$4, branch_area=$5 
		 WHERE id=$6 RETURNING *`,
		req.Name, req.Type, req.Address, req.ContactPerson, req.BranchArea, id,
	).Scan(&outlet.ID, &outlet.Name, &outlet.Type, &outlet.BranchArea, &outlet.Address, &outlet.ContactPerson, &outlet.CreatedAt)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, outlet)
}

func (h *OutletHandler) DeleteOutlet(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	_, err := db.Pool.Exec(ctx, `DELETE FROM outlets WHERE id = $1`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete outlet"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
