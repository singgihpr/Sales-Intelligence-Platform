package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"

	"sales-intelligence/db"
	"sales-intelligence/middleware"
	"sales-intelligence/utils"
)

type UploadHandler struct{}

func (h *UploadHandler) UploadExcel(c echo.Context) error {
	_ = middleware.GetUser(c) // user used for audit trail

	// Get file from form
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No file uploaded"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to open file"})
	}
	defer src.Close()

	// Read file content
	content, err := io.ReadAll(src)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read file"})
	}

	// Parse Excel file
	f, err := excelize.OpenReader(strings.NewReader(string(content)))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to parse Excel file"})
	}
	defer f.Close()

	// Get first sheet
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No sheets found"})
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to read sheet"})
	}

	// Detect format
	if len(rows) < 5 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid file format"})
	}

	// Check for Ayotama v2 format
	headerRow := rows[4]
	isAyotamaV2 := false
	for _, cell := range headerRow {
		if strings.Contains(strings.ToLower(cell), "nama penjual utama") {
			isAyotamaV2 = true
			break
		}
	}

	if !isAyotamaV2 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unsupported file format. Please upload Ayotama rincian faktur format (xlsx/xls)."})
	}

	ctx := context.Background()

	// Fetch all outlets and users
	outlets, err := db.Pool.Query(ctx, `SELECT id, name FROM outlets`)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch outlets"})
	}
	defer outlets.Close()

	outletMap := map[string]string{}
	for outlets.Next() {
		var id, name string
		outlets.Scan(&id, &name)
		outletMap[name] = id
	}

	users, err := db.Pool.Query(ctx, `SELECT id, name, role FROM users`)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch users"})
	}
	defer users.Close()

	userMap := map[string]string{}
	for users.Next() {
		var id, name, role string
		users.Scan(&id, &name, &role)
		userMap[name] = id
	}

	// Parse rows
	validRows := []map[string]interface{}{}
	newOutlets := map[string]bool{}
	newSalesmen := map[string]bool{}

	// Find column indices
	branchIdx := -1
	salesmanIdx := -1
	outletIdx := -1
	unitIdx := -1
	productIdx := -1

	for i, cell := range headerRow {
		lower := strings.ToLower(cell)
		if strings.Contains(lower, "nama cabang") {
			branchIdx = i
		} else if strings.Contains(lower, "nama penjual utama") {
			salesmanIdx = i
		} else if strings.Contains(lower, "pelanggan") {
			outletIdx = i
		} else if strings.Contains(lower, "nama sa") || strings.Contains(lower, "satuan") {
			unitIdx = i
		} else if strings.Contains(lower, "nama barang") || strings.Contains(lower, "barang") {
			productIdx = i
		}
	}

	if branchIdx == -1 || salesmanIdx == -1 || outletIdx == -1 || unitIdx == -1 || productIdx == -1 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Required columns not found"})
	}

	// Find date columns
	dateColumns := []int{}
	for i := productIdx + 1; i < len(headerRow); i++ {
		cell := headerRow[i]
		if cell != "" {
			dateColumns = append(dateColumns, i)
		}
	}

	if len(dateColumns) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No date columns found"})
	}

	currentBranch := ""
	currentSalesman := ""
	currentOutlet := ""

	for rowIdx := 5; rowIdx < len(rows); rowIdx++ {
		row := rows[rowIdx]
		if len(row) < 7 {
			continue
		}

		if strings.Contains(row[1], "Halaman") {
			break
		}

		if branchIdx < len(row) {
			cell := strings.TrimSpace(row[branchIdx])
			if cell != "" && len(cell) >= 2 && cell[2] == ' ' {
				currentBranch = cell
			}
		}

		if salesmanIdx < len(row) {
			cell := strings.TrimSpace(row[salesmanIdx])
			if cell != "" {
				currentSalesman = cell
			}
		}

		if outletIdx < len(row) {
			cell := strings.TrimSpace(row[outletIdx])
			if cell != "" {
				currentOutlet = cell
			}
		}

		unitType := ""
		if unitIdx < len(row) {
			unitType = strings.ToUpper(strings.TrimSpace(row[unitIdx]))
		}

		productName := ""
		if productIdx < len(row) {
			productName = strings.TrimSpace(row[productIdx])
		}

		if productName == "" {
			continue
		}

		validUnits := []string{"BOX", "KG", "PAX", "PCS", "KRJ"}
		validUnit := false
		for _, u := range validUnits {
			if unitType == u {
				validUnit = true
				break
			}
		}
		if !validUnit {
			continue
		}

		kg := utils.ExtractKgFromName(productName)
		volumeBE := utils.ConvertToBE(1, kg)

		for _, dc := range dateColumns {
			if dc >= len(row) {
				continue
			}

			qty := 0
			fmt.Sscanf(row[dc], "%d", &qty)
			if qty <= 0 {
				continue
			}

			totalVolumeBE := float64(qty) * volumeBE

			validRows = append(validRows, map[string]interface{}{
				"outletName": currentOutlet,
				"branchArea": currentBranch,
				"salesName":  currentSalesman,
				"volume":     totalVolumeBE,
				"sku":        productName,
			})

			if _, exists := outletMap[currentOutlet]; !exists {
				newOutlets[currentOutlet] = true
			}
			if _, exists := userMap[currentSalesman]; !exists {
				newSalesmen[currentSalesman] = true
			}
		}
	}

	// Create missing outlets
	for outletName := range newOutlets {
		_, err := db.Pool.Exec(ctx,
			`INSERT INTO outlets (id, name, type, address, contact_person, branch_area)
			 VALUES (gen_random_uuid(), $1, '', '', '', '')
			 ON CONFLICT DO NOTHING`,
			outletName,
		)
		if err != nil {
			continue
		}
	}

	// Re-fetch outlets
	outlets2, _ := db.Pool.Query(ctx, `SELECT id, name FROM outlets`)
	if outlets2 != nil {
		defer outlets2.Close()
		for outlets2.Next() {
			var id, name string
			outlets2.Scan(&id, &name)
			outletMap[name] = id
		}
	}

	// Deduplicate and insert
	dedupMap := map[string]map[string]interface{}{}
	for _, r := range validRows {
		outletName := r["outletName"].(string)
		salesName := r["salesName"].(string)
		outletID := outletMap[outletName]
		salesID := userMap[salesName]

		if outletID == "" || salesID == "" {
			continue
		}

		key := fmt.Sprintf("%s|%s|%s", outletID, salesID, r["sku"])
		if existing, exists := dedupMap[key]; exists {
			existing["volume"] = existing["volume"].(float64) + r["volume"].(float64)
		} else {
			dedupMap[key] = map[string]interface{}{
				"outletID": outletID,
				"salesID":  salesID,
				"volume":   r["volume"],
				"sku":      r["sku"],
			}
		}
	}

	// Batch insert
	insertedCount := 0
	for _, r := range dedupMap {
		_, err := db.Pool.Exec(ctx,
			`INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
			 VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE, $3, $4)
			 ON CONFLICT (outlet_id, sales_id, record_date, sku_name) DO UPDATE SET volume_be = EXCLUDED.volume_be`,
			r["outletID"], r["salesID"], r["volume"], r["sku"],
		)
		if err == nil {
			insertedCount++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":              true,
		"inserted":             insertedCount,
		"totalPreviewed":       len(validRows),
		"newOutletsCreated":    len(newOutlets),
		"assignmentsCreated":   0,
		"assignmentsUpdated":   0,
	})
}
