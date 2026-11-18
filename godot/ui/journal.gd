class_name VisitJournal
extends ColorRect

func layout(portrait: bool, viewport_height: int) -> void:
	var tall := portrait and viewport_height >= 720
	position = Vector2(0, 360) if portrait else Vector2(480, 40)
	size = Vector2(480, viewport_height - 360) if portrait else Vector2(160, 320)
	$Rule.size = Vector2(480, 1) if portrait else Vector2(1, 320)
	$Heading.add_theme_font_size_override(&"font_size", 23 if tall else 17)
	$Hint.add_theme_font_size_override(&"font_size", 13 if tall else 9)
	if tall:
		$Heading.position = Vector2(22, 15)
		$Stock.position = Vector2(324, 10)
		$Ledger.position = Vector2(22, 65)
		$Actions.position = Vector2(22, size.y - 92)
		$Hint.position = Vector2(22, size.y - 41)
		$Hint.size = Vector2(437, 40)
	elif portrait:
		$Heading.position = Vector2(15, 9)
		$Stock.position = Vector2(15, 35)
		$Ledger.position = Vector2(171, 19)
		$Actions.position = Vector2(329, 25)
		$Hint.position = Vector2(15, 136)
		$Hint.size = Vector2(450, 30)
	else:
		$Heading.position = Vector2(13, 8)
		$Stock.position = Vector2(13, 34)
		$Ledger.position = Vector2(13, 90)
		$Actions.position = Vector2(13, 212)
		$Hint.position = Vector2(13, 271)
		$Hint.size = Vector2(134, 44)
	var width := 436.0 if tall else 134.0
	var band := (size.y - 165.0) / 3.0
	var row := 0
	for field in ["Score", "Fed", "Best", "Spent", "FishShare"]:
		var caption: Label = $Ledger.get_node(field + "Label")
		var value: Label = $Ledger.get_node(field)
		if tall and row < 4:
			var column_x := (row % 2) * 224.0
			var baseline := roundf(floorf(row / 2.0) * band + band * 0.13)
			caption.position = Vector2(column_x, baseline)
			value.position = Vector2(column_x, baseline + 22)
			value.size = Vector2(205, 33)
			value.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
			value.add_theme_font_override(&"font", get_theme_font(&"font", &"Heading"))
			value.add_theme_font_size_override(&"font_size", 25)
		else:
			var baseline := roundf(2.0 * band) + 7 if tall else float(row * 20 + (7 if row == 4 else 0))
			caption.position = Vector2(0, baseline)
			value.position = Vector2(width - 78.0, baseline)
			value.size = Vector2(78, 24 if tall else 15)
			value.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			value.remove_theme_font_override(&"font")
			value.add_theme_font_size_override(&"font_size", 16 if tall else 11)
		caption.size = Vector2(118 if tall else 76, 22 if tall else 15)
		caption.add_theme_font_size_override(&"font_size", 15 if tall else 10)
		row += 1
	$Ledger/Divider.position.y = roundf(band * 2.0) if tall else 81.0
	$Ledger/Divider.size.x = width
	%Share.position.y = $Ledger/Divider.position.y + (40.0 if tall else 25.0)
	%Share.size = Vector2(width, 6 if tall else 4)
	%Throw.size = Vector2(212, 42) if tall else Vector2(134, 24)
	%Machine.position = Vector2(224, 0) if tall else Vector2(0, 29)
	%Machine.size = %Throw.size
	for action: Button in [%Throw, %Machine]:
		action.add_theme_font_size_override(&"font_size", 15 if tall else 11)


func update_values(throws: int, score: int, fed: int, population: int, best: int, fish_units: int, bird_units: int, spent: int) -> void:
	%Throws.text = str(throws)
	%Supply.fraction = throws / float(GardenVisit.SERVING)
	%Score.text = str(score)
	%Fed.text = "%d / %d" % [fed, population]
	%Best.text = str(best)
	%Spent.text = "%d kr" % spent
	var total := fish_units + bird_units
	var share := float(fish_units) / total if total else 0.0
	%Share.fraction = share
	%FishShare.text = "%d%%" % roundi(share * 100.0) if total else "—"
	%Throw.disabled = throws == 0
