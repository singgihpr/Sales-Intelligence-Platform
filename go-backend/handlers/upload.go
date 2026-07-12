package handlers

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"

	"sales-intelligence/db"
	"sales-intelligence/middleware"
	"sales-intelligence/utils"
)

type UploadHandler struct{}

type parseResult struct {
	Rows       []map[string]interface{}
	OutletMap  map[string]string
	UserMap    map[string]string
	NewOutlets map[string]bool
	Total      int
	Valid      int
	Invalid    int
}

func parseExcelDateStr(val string) string {
	if val == "" {
		return ""
	}
	// Already YYYY-MM-DD
	if len(val) == 10 && val[4] == '-' && val[7] == '-' {
		return val
	}
	// Try Excel serial number
	if serial, err := strconv.ParseFloat(val, 64); err == nil && serial > 25569 {
		d := time.UnixMilli(int64((serial - 25569) * 86400 * 1000)).UTC()
		return fmt.Sprintf("%04d-%02d-%02d", d.Year(), d.Month(), d.Day())
	}
	// Try Go date formats
	for _, layout := range []string{"02 Jan 2006", "2 Jan 2006", "02/01/2006", "1/1/2006", "2006/01/02", "02-01-2006"} {
		if t, err := time.Parse(layout, val); err == nil {
			return t.Format("2006-01-02")
		}
	}
	return ""
}

func parseExcel(c echo.Context) (*parseResult, error) {
	file, err := c.FormFile("file")
	if err != nil {
		return nil, fmt.Errorf("no file uploaded")
	}

	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open file")
	}
	defer src.Close()

	content, err := io.ReadAll(src)
	if err != nil {
		return nil, fmt.Errorf("failed to read file")
	}

	f, err := excelize.OpenReader(strings.NewReader(string(content)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse Excel file")
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet")
	}

	if len(rows) < 5 {
		return nil, fmt.Errorf("invalid file format")
	}

	headerRow := rows[4]
	isAyotamaV2 := false
	for _, cell := range headerRow {
		if strings.Contains(strings.ToLower(cell), "nama penjual utama") {
			isAyotamaV2 = true
			break
		}
	}
	if !isAyotamaV2 {
		return nil, fmt.Errorf("unsupported file format. Please upload Ayotama rincian faktur format (xlsx/xls).")
	}

	ctx := context.Background()

	// Fetch outlets and users
	outletMap := map[string]string{}
	if outlets, err := db.Pool.Query(ctx, `SELECT id, name FROM outlets`); err == nil {
		defer outlets.Close()
		for outlets.Next() {
			var id, name string
			outlets.Scan(&id, &name)
			outletMap[name] = id
		}
	}

	userMap := map[string]string{}
	if users, err := db.Pool.Query(ctx, `SELECT id, name, role FROM users`); err == nil {
		defer users.Close()
		for users.Next() {
			var id, name, role string
			if err := users.Scan(&id, &name, &role); err == nil {
				userMap[strings.ToUpper(strings.TrimSpace(name))] = id
			}
		}
	}

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
		return nil, fmt.Errorf("required columns not found")
	}

	// Parse date columns from header
	type dateCol struct {
		Index int
		Date  string
	}
	dateColumns := []dateCol{}
	for i := productIdx + 1; i < len(headerRow); i++ {
		cell := headerRow[i]
		if cell == "" {
			continue
		}
		dateStr := parseExcelDateStr(cell)
		if dateStr == "" {
			dateStr = cell
		}
		dateColumns = append(dateColumns, dateCol{Index: i, Date: dateStr})
	}

	if len(dateColumns) == 0 {
		return nil, fmt.Errorf("no date columns found")
	}

	// Parse data rows
	var previewRows []map[string]interface{}
	newOutlets := map[string]bool{}
	currentBranch := ""
	currentSalesman := ""
	currentOutlet := ""

	for rowIdx := 5; rowIdx < len(rows); rowIdx++ {
		row := rows[rowIdx]
		if len(row) < 7 {
			continue
		}

		if len(row) > 1 && strings.Contains(row[1], "Halaman") {
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
			if dc.Index >= len(row) {
				continue
			}

			qty := 0
			fmt.Sscanf(row[dc.Index], "%d", &qty)
			if qty <= 0 {
				continue
			}

			totalVolumeBE := math.Round(float64(qty)*volumeBE*1000) / 1000
			isKnownOutlet := outletMap[currentOutlet] != ""
			isKnownSalesman := userMap[strings.ToUpper(strings.TrimSpace(currentSalesman))] != ""

			warnings := []string{}
			if currentOutlet == "" {
				warnings = append(warnings, "Missing outlet name")
			}
			if !isKnownOutlet && currentOutlet != "" {
				warnings = append(warnings, fmt.Sprintf("Outlet baru akan dibuat: %s", currentOutlet))
			}

			outletDisplay := currentOutlet
			if outletDisplay == "" {
				outletDisplay = "-"
			}

			previewRows = append(previewRows, map[string]interface{}{
				"row":            rowIdx + 1,
				"outletName":     outletDisplay,
				"branchArea":     currentBranch,
				"salesName":      currentSalesman,
				"date":           dc.Date,
				"volume":         totalVolumeBE,
				"sku":            productName,
				"valid":          true,
				"isNewOutlet":    !isKnownOutlet && currentOutlet != "",
				"isNewSalesman":  !isKnownSalesman && currentSalesman != "",
				"warnings":       warnings,
				"_outletName":    currentOutlet,
				"_salesNameUpper": strings.ToUpper(strings.TrimSpace(currentSalesman)),
			})

			if !isKnownOutlet && currentOutlet != "" {
				newOutlets[currentOutlet] = true
			}
		}
	}

	validCount := 0
	for _, r := range previewRows {
		if r["valid"].(bool) {
			validCount++
		}
	}

	return &parseResult{
		Rows:       previewRows,
		OutletMap:  outletMap,
		UserMap:    userMap,
		NewOutlets: newOutlets,
		Total:      len(previewRows),
		Valid:      validCount,
		Invalid:    len(previewRows) - validCount,
	}, nil
}

func (h *UploadHandler) PreviewExcel(c echo.Context) error {
	_ = middleware.GetUser(c)

	result, err := parseExcel(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"action": "preview",
			"total":  0, "valid": 0, "invalid": 0,
			"rows":   []interface{}{},
			"error":  err.Error(),
		})
	}

	// Strip internal fields from output
	rows := make([]map[string]interface{}, len(result.Rows))
	for i, r := range result.Rows {
		rows[i] = map[string]interface{}{
			"row":            r["row"],
			"outletName":     r["outletName"],
			"branchArea":     r["branchArea"],
			"salesName":      r["salesName"],
			"date":           r["date"],
			"volume":         r["volume"],
			"sku":            r["sku"],
			"valid":          r["valid"],
			"isNewOutlet":    r["isNewOutlet"],
			"isNewSalesman":  r["isNewSalesman"],
			"warnings":       r["warnings"],
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"action": "preview",
		"total":  result.Total,
		"valid":  result.Valid,
		"invalid": result.Invalid,
		"rows":   rows,
	})
}

func (h *UploadHandler) UploadExcel(c echo.Context) error {
	user := middleware.GetUser(c)

	result, err := parseExcel(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	ctx := context.Background()
	outletMap := result.OutletMap
	userMap := result.UserMap

	// Create missing outlets
	for outletName := range result.NewOutlets {
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
	if outlets2, err := db.Pool.Query(ctx, `SELECT id, name FROM outlets`); err == nil {
		defer outlets2.Close()
		for outlets2.Next() {
			var id, name string
			outlets2.Scan(&id, &name)
			outletMap[name] = id
		}
	}

	// Deduplicate and insert
	dedupMap := map[string]map[string]interface{}{}
	for _, r := range result.Rows {
		outletName := r["_outletName"].(string)
		salesNameUpper := r["_salesNameUpper"].(string)
		outletID := outletMap[outletName]
		salesID := userMap[salesNameUpper]

		if outletID == "" || salesID == "" {
			continue
		}

		key := fmt.Sprintf("%s|%s|%s|%s", outletID, salesID, r["date"], r["sku"])
		if existing, exists := dedupMap[key]; exists {
			existing["volume"] = existing["volume"].(float64) + r["volume"].(float64)
		} else {
			dedupMap[key] = map[string]interface{}{
				"outletID": outletID,
				"salesID":  salesID,
				"volume":   r["volume"],
				"sku":      r["sku"],
				"date":     r["date"],
			}
		}
	}

	insertedCount := 0
	for _, r := range dedupMap {
		_, err := db.Pool.Exec(ctx,
			`INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
			 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
			 ON CONFLICT (outlet_id, sales_id, record_date, sku_name) DO UPDATE SET volume_be = EXCLUDED.volume_be`,
			r["outletID"], r["salesID"], r["date"], r["volume"], r["sku"],
		)
		if err == nil {
			insertedCount++
		}
	}

	// Auto-create outlet assignments for uploaded records
	assignmentsCreated := 0
	assignedPairs := map[string]bool{}
	for _, r := range dedupMap {
		outletID, _ := r["outletID"].(string)
		salesID, _ := r["salesID"].(string)
		if outletID == "" || salesID == "" {
			continue
		}
		key := outletID + "|" + salesID
		if assignedPairs[key] {
			continue
		}
		assignedPairs[key] = true
		_, err := db.Pool.Exec(ctx,
			`INSERT INTO outlet_assignments (id, outlet_id, salesman_id, assigned_by, notes)
			 SELECT gen_random_uuid(), $1, $2, $3, 'Auto-assigned via Excel upload'
			 WHERE NOT EXISTS (
				 SELECT 1 FROM outlet_assignments WHERE outlet_id = $1 AND salesman_id = $2 AND unassigned_at IS NULL
			 )`,
			outletID, salesID, user.ID,
		)
		if err == nil {
			assignmentsCreated++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":            true,
		"inserted":           insertedCount,
		"totalPreviewed":     result.Total,
		"newOutletsCreated":  len(result.NewOutlets),
		"assignmentsCreated": assignmentsCreated,
	})
}
