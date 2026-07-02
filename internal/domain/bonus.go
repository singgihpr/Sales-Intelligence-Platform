package domain

const (
	DefaultL2Target = 3499.0
	DefaultL3Target = 3500.0

	DefaultL2BaseReward = 1000000.0
	DefaultL3BaseReward = 1200000.0
)

func GetDefaultPercentageConfig(level Level) BonusConfig {
	base := DefaultL2BaseReward
	if level == LevelL3 {
		base = DefaultL3BaseReward
	}
	return BonusConfig{
		BaseReward: base,
		Tiers: []BonusTier{
			{Threshold: 90, Reward: base * 0.50, Label: "90%"},
			{Threshold: 100, Reward: base, Label: "100%"},
			{Threshold: 110, Reward: base * 1.25, Label: "110%"},
		},
	}
}

func GetDefaultVolumeConfig() VolumeConfig {
	return VolumeConfig{
		Tiers: []VolumeTier{
			{Threshold: 1500, Reward: 250000, Label: "Tier 1"},
			{Threshold: 2500, Reward: 500000, Label: "Tier 2"},
			{Threshold: 3500, Reward: 750000, Label: "Tier 3"},
		},
	}
}

func GetDefaultActiveOutletsConfig(level Level) BonusConfig {
	base := DefaultL2BaseReward / 3
	if level == LevelL3 {
		base = DefaultL3BaseReward / 3
	}
	return BonusConfig{
		BaseReward: base,
		Tiers: []BonusTier{
			{Threshold: 90, Reward: base * 0.50, Label: "90%"},
			{Threshold: 100, Reward: base, Label: "100%"},
			{Threshold: 125, Reward: base * 1.25, Label: "125%"},
		},
	}
}

func CalculatePercentageBonus(currentBE, targetBE float64, config *BonusConfig) PercentageBonusResult {
	if targetBE <= 0 || config == nil {
		return PercentageBonusResult{}
	}
	attainment := (currentBE / targetBE) * 100
	var activeTier *BonusTier
	for i := range config.Tiers {
		t := &config.Tiers[i]
		if attainment >= t.Threshold {
			activeTier = t
		}
	}
	bonus := 0.0
	if activeTier != nil {
		bonus = activeTier.Reward
	}
	return PercentageBonusResult{Attainment: attainment, Bonus: bonus, Tier: activeTier}
}

func CalculateVolumeBonus(currentBE float64, config *VolumeConfig) VolumeBonusResult {
	if config == nil {
		return VolumeBonusResult{}
	}
	var activeTier *VolumeTier
	for i := range config.Tiers {
		t := &config.Tiers[i]
		if currentBE >= t.Threshold {
			activeTier = t
		}
	}
	bonus := 0.0
	if activeTier != nil {
		bonus = activeTier.Reward
	}
	return VolumeBonusResult{Bonus: bonus, Tier: activeTier}
}

func CalculateActiveOutletsBonus(totalAssigned int, activeCount int, config *BonusConfig) ActiveOutletsBonusResult {
	if totalAssigned <= 0 || config == nil {
		return ActiveOutletsBonusResult{}
	}
	percent := (float64(activeCount) / float64(totalAssigned)) * 100
	var activeTier *BonusTier
	for i := range config.Tiers {
		t := &config.Tiers[i]
		if percent >= t.Threshold {
			activeTier = t
		}
	}
	bonus := 0.0
	if activeTier != nil {
		bonus = activeTier.Reward
	}
	return ActiveOutletsBonusResult{
		Percent:       percent,
		ActiveCount:   activeCount,
		TotalAssigned: totalAssigned,
		Bonus:         bonus,
		Tier:          activeTier,
	}
}
