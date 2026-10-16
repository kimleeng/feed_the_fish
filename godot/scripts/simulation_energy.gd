extends RefCounted
## Feeding history survives individual meals and provides reusable hunger state.

const RECENT_MEAL_SECONDS := 20.0
const BOOST_DURATION_SECONDS := 2.0
const BOOST_SPEED_MULTIPLIER := 1.4
const BOOST_RECHARGE_SECONDS := 30.0
const HUNGRY_RECHARGE_MODIFIER := 2.0
const FED_RECHARGE_MODIFIER := 1.0


static func has_eaten_recently(animal: Dictionary, time: float) -> bool:
	return animal.last_ate_at != null and time - float(animal.last_ate_at) < RECENT_MEAL_SECONDS


static func record_feeding(animal: Dictionary, amount: float, time: float) -> void:
	if amount <= 0.0:
		return
	animal.last_ate_at = time
	animal.total_eaten += amount
	animal.boosting = false


static func _recharge(animal: Dictionary, time: float, seconds: float) -> float:
	var recent_seconds := 0.0
	if animal.last_ate_at != null:
		recent_seconds = clampf(float(animal.last_ate_at) + RECENT_MEAL_SECONDS - (time - seconds), 0.0, seconds)
	var used := 0.0
	for segment in [[recent_seconds, FED_RECHARGE_MODIFIER], [seconds - recent_seconds, HUNGRY_RECHARGE_MODIFIER]]:
		var charging := minf(float(segment[0]), maxf(0.0, 1.0 - animal.boost_charge) * BOOST_RECHARGE_SECONDS / float(segment[1]))
		animal.boost_charge = minf(1.0, animal.boost_charge + charging * float(segment[1]) / BOOST_RECHARGE_SECONDS)
		used += charging
	return used


## Returns the average speed multiplier across this simulation step, including
## frames crossing an empty/full reserve or the twenty-second hunger boundary.
static func step_boost(animal: Dictionary, time: float, seconds: float, pursuing: bool) -> float:
	if seconds <= 0.0:
		return 1.0
	if not pursuing:
		animal.boosting = false
		_recharge(animal, time, seconds)
		return 1.0
	var remaining := seconds
	if not animal.boosting:
		remaining -= _recharge(animal, time, seconds)
		if animal.boost_charge < 1.0 - 0.000000001:
			return 1.0
		animal.boost_charge = 1.0
		animal.boosting = true
	var boosted_seconds := minf(remaining, animal.boost_charge * BOOST_DURATION_SECONDS)
	animal.boost_charge = maxf(0.0, animal.boost_charge - boosted_seconds / BOOST_DURATION_SECONDS)
	if animal.boost_charge < 0.000000001:
		animal.boost_charge = 0.0
		animal.boosting = false
		_recharge(animal, time, remaining - boosted_seconds)
	return 1.0 + (BOOST_SPEED_MULTIPLIER - 1.0) * boosted_seconds / seconds
