package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"

	"sales-intelligence/db"
	"sales-intelligence/middleware"
	"sales-intelligence/models"
)

type AssignmentHandler struct{}

func (h *AssignmentHandler) ListAssignments(c echo.Context) error {
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
	mode := c.QueryParam("mode")

	ctx := context.Background()

	if mode == "vacant" {
		rows, err := db.Pool.Query(ctx,
			`SELECT o.* FROM outlets o
			 WHERE NOT EXISTS (
				SELECT 1 FROM outlet_assignments oa WHERE oa.outlet_id = o.id AND oa.unassigned_at IS NULL
			 )
			 AND (o.name ILIKE $1 OR o.type ILIKE $1 OR o.branch_area ILIKE $1 OR o.address ILIKE $1)
			 ORDER BY o.name LIMIT $2 OFFSET $3`,
			searchPattern, limit, offset,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
		}
		defer rows.Close()

		outlets := []models.Outlet{}
		for rows.Next() {
			var o models.Outlet
			if err := rows.Scan(&o.ID, &o.Name, &o.Type, &o.BranchArea, &o.Address, &o.ContactPerson, &o.CreatedAt); err != nil {
				continue
			}
			outlets = append(outlets, o)
		}

		var total int
		db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM outlets o
			 WHERE NOT EXISTS (
				SELECT 1 FROM outlet_assignments oa WHERE oa.outlet_id = o.id AND oa.unassigned_at IS NULL
			 )
			 AND (o.name ILIKE $1 OR o.type ILIKE $1 OR o.branch_area ILIKE $1 OR o.address ILIKE $1)`,
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

	rows, err := db.Pool.Query(ctx,
		`SELECT oa.id, oa.outlet_id, oa.salesman_id, oa.assigned_at, oa.unassigned_at, oa.notes,
		        o.name as outlet_name, o.branch_area, u.name as salesman_name
		 FROM outlet_assignments oa
		 LEFT JOIN outlets o ON oa.outlet_id = o.id
		 LEFT JOIN users u ON oa.salesman_id = u.id
		 WHERE oa.unassigned_at IS NULL
		   AND (o.name ILIKE $1 OR o.branch_area ILIKE $1 OR u.name ILIKE $1)
		 ORDER BY o.name LIMIT $2 OFFSET $3`,
		searchPattern, limit, offset,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer rows.Close()

	assignments := []map[string]interface{}{}
	for rows.Next() {
		var id, outletID string
		var salesmanID *string
		var assignedAt pgtype.Timestamp
		var unassignedAt *pgtype.Timestamp
		var notes, outletName, branchArea string
		var salesmanName *string
		if err := rows.Scan(&id, &outletID, &salesmanID, &assignedAt, &unassignedAt, &notes, &outletName, &branchArea, &salesmanName); err != nil {
			continue
		}
		assignments = append(assignments, map[string]interface{}{
			"id": id, "outlet_id": outletID, "salesman_id": salesmanID,
			"assigned_at": assignedAt, "unassigned_at": unassignedAt, "notes": notes,
			"outlet_name": outletName, "branch_area": branchArea, "salesman_name": salesmanName,
		})
	}

	var total int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM outlet_assignments oa
		 LEFT JOIN outlets o ON oa.outlet_id = o.id
		 LEFT JOIN users u ON oa.salesman_id = u.id
		 WHERE oa.unassigned_at IS NULL
		   AND (o.name ILIKE $1 OR o.branch_area ILIKE $1 OR u.name ILIKE $1)`,
		searchPattern,
	).Scan(&total)

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       assignments,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: (total + limit - 1) / limit,
	})
}

func (h *AssignmentHandler) CreateAssignment(c echo.Context) error {
	user := middleware.GetUser(c)

	var req struct {
		OutletID   string `json:"outlet_id"`
		SalesmanID string `json:"salesman_id"`
		Notes      string `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx := context.Background()

	// Unassign existing active assignment
	db.Pool.Exec(ctx,
		`UPDATE outlet_assignments SET unassigned_at = CURRENT_TIMESTAMP WHERE outlet_id = $1 AND unassigned_at IS NULL`,
		req.OutletID,
	)

	var assignment models.OutletAssignment
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO outlet_assignments (id, outlet_id, salesman_id, assigned_by, notes)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *`,
		req.OutletID, req.SalesmanID, user.ID, req.Notes,
	).Scan(&assignment.ID, &assignment.OutletID, &assignment.SalesmanID, &assignment.AssignedAt, &assignment.UnassignedAt, &assignment.AssignedBy, &assignment.Notes)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create assignment"})
	}

	return c.JSON(http.StatusCreated, assignment)
}

func (h *AssignmentHandler) UpdateAssignment(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	var assignment models.OutletAssignment
	err := db.Pool.QueryRow(ctx,
		`UPDATE outlet_assignments SET unassigned_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
		id,
	).Scan(&assignment.ID, &assignment.OutletID, &assignment.SalesmanID, &assignment.AssignedAt, &assignment.UnassignedAt, &assignment.AssignedBy, &assignment.Notes)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, assignment)
}

func (h *AssignmentHandler) DeleteAssignment(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	_, err := db.Pool.Exec(ctx, `DELETE FROM outlet_assignments WHERE id = $1`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete assignment"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
