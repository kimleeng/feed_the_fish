class_name PondRenderSprite
extends Node2D
## A small, subdivided textured mesh supplies actual in-between shapes.  The
## image is never cross-faded over a second body, which would soften the art.

const Art = preload("res://godot/scripts/art_library.gd")
const FlightParts = preload("res://godot/shaders/flight_parts.gdshader")
const COLUMNS := 7
const ROWS := 5
# Source-space head pins measured in the registered 320px flight drawings.
# Screen-space front/back views keep the crown high; projecting a circular
# heading into this illustration would incorrectly lower the south-facing head.
const FLIGHT_HEAD_PINS := {
	"e": Vector2(216, 134), "se": Vector2(215, 148),
	"s": Vector2(159, 137), "sw": Vector2(108, 150),
	"w": Vector2(111, 133), "nw": Vector2(115, 120),
	"n": Vector2(160, 118), "ne": Vector2(211, 130),
}
var mesh := Polygon2D.new()
var flight_body := Polygon2D.new()
var atlas := ""
var frame_name := ""
var data: Dictionary = {}
var source_size := Vector2.ONE
var source_origin := Vector2.ZERO
var base_points := PackedVector2Array()
var cropped_region := Rect2()
var foot_origin := false
var desired_height := 1.0
var reference_scale := 1.0
var _wing_material := ShaderMaterial.new()
var _body_material := ShaderMaterial.new()
var _body_frame := ""

func _init() -> void:
	add_child(mesh)
	mesh.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(flight_body)
	flight_body.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	flight_body.visible = false
	_wing_material.shader = FlightParts
	_body_material.shader = FlightParts
	_body_material.set_shader_parameter("body_only", true)
	flight_body.material = _body_material

func set_frame(next_atlas: String, next_name: String, height: float, feet := false) -> void:
	desired_height = height
	if atlas == next_atlas and frame_name == next_name and foot_origin == feet:
		reference_scale = height / Art.reference_height(atlas, frame_name)
		return
	atlas = next_atlas
	frame_name = next_name
	foot_origin = feet
	data = Art.frame_data(atlas, frame_name)
	if data.is_empty():
		visible = false
		return
	mesh.texture = Art.raw_texture(str(data.image))
	var source: Dictionary = data.sourceSize
	var region: Dictionary = data.frame
	var trim: Dictionary = data.spriteSourceSize
	source_size = Vector2(float(source.w), float(source.h))
	source_origin = Vector2(source_size.x * 0.5, source_size.y if feet else source_size.y * 0.5)
	reference_scale = height / float(data.referenceHeight)
	cropped_region = Rect2(float(trim.x), float(trim.y), float(region.w), float(region.h))
	_build_mesh(cropped_region, Vector2(float(region.x), float(region.y)))

func crop_source(rect: Rect2) -> void:
	if data.is_empty():
		return
	var trim: Dictionary = data.spriteSourceSize
	var region: Dictionary = data.frame
	var clipped := Rect2(float(trim.x), float(trim.y), float(region.w), float(region.h)).intersection(rect)
	if clipped.size.x <= 0.0 or clipped.size.y <= 0.0:
		visible = false
		return
	if cropped_region == clipped:
		return
	cropped_region = clipped
	_build_mesh(clipped, Vector2(float(region.x), float(region.y)) + clipped.position - Vector2(float(trim.x), float(trim.y)))

func _build_mesh(region: Rect2, uv_origin: Vector2) -> void:
	base_points.clear()
	var coordinates := PackedVector2Array()
	var polygons: Array[PackedInt32Array] = []
	var row_steps: Array[float] = []
	for row in range(ROWS + 1):
		row_steps.append(float(row) / ROWS)
	if atlas == "bird-flyers":
		# Put an actual vertex row on the shoulder hinge so a downward beat
		# never stretches the shoulder across a triangle spanning both sides.
		var hinge := (source_size.y * 0.49 - region.position.y) / region.size.y
		if hinge > 0.0 and hinge < 1.0:
			row_steps.append(hinge)
			row_steps.sort()
	for row in range(row_steps.size()):
		for column in range(COLUMNS + 1):
			var fraction := Vector2(float(column) / COLUMNS, row_steps[row])
			base_points.append(region.position + fraction * region.size)
			coordinates.append(uv_origin + fraction * region.size)
	for row in range(row_steps.size() - 1):
		for column in range(COLUMNS):
			var corner := row * (COLUMNS + 1) + column
			polygons.append(PackedInt32Array([corner, corner + 1, corner + COLUMNS + 2]))
			polygons.append(PackedInt32Array([corner, corner + COLUMNS + 2, corner + COLUMNS + 1]))
	mesh.uv = coordinates
	mesh.polygon = base_points
	mesh.polygons = polygons

func pose(mode := "still", phase := 0.0, heading := 0.0, amplitude := 1.0, wing_extent := 1.0, hand_shift := Vector2.ZERO, mirror := false) -> void:
	if data.is_empty():
		return
	var vertices := PackedVector2Array()
	var axis := Vector2(cos(heading), sin(heading) * 0.85).normalized()
	var normal := Vector2(-axis.y, axis.x)
	var hand: Vector2 = Vector2(float(data.get("hand", {}).get("x", source_size.x * 0.35)), float(data.get("hand", {}).get("y", source_size.y * 0.5)))
	flight_body.visible = mode == "flight"
	mesh.material = _wing_material if mode == "flight" else null
	if mode == "flight":
		_prepare_flight_body(heading, mirror)
	for original: Vector2 in base_points:
		var point := original - source_origin
		if mode == "swim":
			var along := point.dot(axis) / maxf(source_size.x, source_size.y)
			var tail := pow(clampf(0.38 - along, 0.0, 0.85), 2.0)
			point += normal * sin(phase - along * 4.5) * tail * source_size.x * 0.038 * amplitude
		elif mode == "paddle":
			var below := smoothstep(source_size.y * 0.38, source_size.y * 0.86, original.y)
			point.x += sin(phase) * below * source_size.x * 0.012 * amplitude
			point.y += sin(phase * 0.5) * source_size.y * 0.0035 * amplitude
		elif mode == "flight":
			var root := source_size.y * 0.49
			# A signed fold from one source keeps the registered feather roots.
			# The fixed torso/head uses the identical pixels throughout the beat.
			if original.y < root:
				point.y = root - source_origin.y + (original.y - root) * wing_extent
				point.x += sin(phase) * absf(original.y - root) * 0.016
		elif mode == "human":
			var torso := 1.0 - smoothstep(source_size.y * 0.55, source_size.y * 0.96, original.y)
			point.x += sin(phase) * torso * source_size.x * 0.004 * amplitude
			point.y += sin(phase * 2.0) * torso * source_size.y * 0.0018 * amplitude
		elif mode == "throw":
			var radius := source_size.y * 0.24
			var influence := pow(clampf(1.0 - original.distance_to(hand) / radius, 0.0, 1.0), 1.5)
			point += hand_shift / maxf(reference_scale, 0.0001) * influence
		point *= reference_scale
		if mirror:
			point.x = -point.x
		vertices.append(point)
	mesh.polygon = vertices

func _prepare_flight_body(heading: float, mirror: bool) -> void:
	var parts := frame_name.split("-")
	# The raised-wing drawing exposes the belly.  The downstroke drawing has
	# feathers across it, so using that as a torso would leave a second wing.
	var name := "%s-%s-0" % [parts[0], parts[1]]
	var direction_names := ["e", "se", "s", "sw", "w", "nw", "n", "ne"]
	var view: int = direction_names.find(parts[1])
	var view_heading := float(view) * PI / 4.0 if view >= 0 else heading
	var torso_center := Vector2(source_size.x * 0.5, source_size.y * 0.565)
	var torso_radius := Vector2(34.0 + absf(cos(view_heading)) * 26.0, 24.0 + absf(sin(view_heading)) * 16.0)
	var head_center: Vector2 = FLIGHT_HEAD_PINS.get(parts[1], Vector2(160, 134))
	var head_radius := Vector2(27.0 + absf(cos(view_heading)) * 12.0, 31.0)
	var tail_center := source_size * Vector2(0.5 - cos(view_heading) * 0.20, 0.565 - sin(view_heading) * 0.05)
	var tail_radius := Vector2(25.0 + absf(cos(view_heading)) * 13.0, 24.0)
	var body_data := Art.frame_data(atlas, name)
	if body_data.is_empty():
		flight_body.visible = false
		return
	if _body_frame != name:
		_body_frame = name
		flight_body.texture = Art.raw_texture(str(body_data.image))
		var region: Dictionary = body_data.frame
		flight_body.uv = PackedVector2Array([Vector2(float(region.x), float(region.y)), Vector2(float(region.x + region.w), float(region.y)), Vector2(float(region.x + region.w), float(region.y + region.h)), Vector2(float(region.x), float(region.y + region.h))])
	var body_vertices := PackedVector2Array()
	for corner: Vector2 in [Vector2.ZERO, Vector2(source_size.x, 0), source_size, Vector2(0, source_size.y)]:
		var point := (corner - source_origin) * reference_scale
		if mirror:
			point.x = -point.x
		body_vertices.append(point)
	flight_body.polygon = body_vertices
	for material: ShaderMaterial in [_wing_material, _body_material]:
		var region: Dictionary = body_data.frame if material == _body_material else data.frame
		material.set_shader_parameter("frame_origin", Vector2(float(region.x), float(region.y)))
		material.set_shader_parameter("torso_center", torso_center)
		material.set_shader_parameter("torso_radius", torso_radius)
		material.set_shader_parameter("head_center", head_center)
		material.set_shader_parameter("head_radius", head_radius)
		material.set_shader_parameter("tail_center", tail_center)
		material.set_shader_parameter("tail_radius", tail_radius)

func point_from_source(point: Vector2, mirror := false) -> Vector2:
	var result := (point - source_origin) * reference_scale
	if mirror:
		result.x = -result.x
	return result

func visible_top() -> float:
	if data.is_empty():
		return 0.0
	return (float(data.spriteSourceSize.y) - source_origin.y) * reference_scale
