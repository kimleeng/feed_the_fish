class_name PondArt
extends RefCounted
## TexturePacker atlases retain their original, untrimmed canvases.  In particular,
## changing direction must never move the waterline, feet, or a fish's centre.

const ART_ROOT := "res://public/art/"
const ATLAS_FILES := {
	"fish-swimmers": "fish-swimmers-animation.json",
	"bird-swimmers": "bird-swimmers-animation.json",
	"turtle-swimmer": "turtle-swimmer-animation.json",
	"animal-eating": "animal-eating-animation.json",
	"dock-thrower": "dock-thrower-animation.json",
	"garden-observers": "garden-observers-animation.json",
	"garden-employee": "garden-employee-animation.json",
	"people-walking": "people-walking.json",
	"bird-flyers": "bird-flyers.json",
	"pellet-stock": "pellet-stock.json",
	"scene-machine-empty": "scene-machine-empty.json",
}

static var _atlases: Dictionary = {}
static var _textures: Dictionary = {}
static var _frames: Dictionary = {}

static func raw_texture(filename: String) -> Texture2D:
	if not _textures.has(filename):
		var path := filename if filename.begins_with("res://") else ART_ROOT + filename
		var texture := load(path) as Texture2D
		if texture == null:
			push_warning("Pond artwork could not load: " + path)
		_textures[filename] = texture
	return _textures[filename] as Texture2D

static func _load_atlas(atlas: String) -> void:
	if _atlases.has(atlas):
		return
	var frames: Dictionary = {}
	_atlases[atlas] = frames
	var filename: String = ATLAS_FILES.get(atlas, atlas + ".json")
	var file := FileAccess.open(ART_ROOT + filename, FileAccess.READ)
	if file == null:
		push_warning("Pond atlas could not load: " + filename)
		return
	var parsed = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		return
	if parsed.has("textures"):
		for page: Dictionary in parsed.textures:
			_read_page(frames, page.frames, str(page.image))
	else:
		_read_page(frames, parsed.get("frames", {}), str(parsed.get("meta", {}).get("image", atlas + ".png")))

static func _read_page(frames: Dictionary, entries, image: String) -> void:
	if entries is Array:
		for entry: Dictionary in entries:
			_register_frame(frames, str(entry.filename), entry, image)
	else:
		for name in entries:
			_register_frame(frames, str(name), entries[name], image)

static func _register_frame(frames: Dictionary, name: String, data: Dictionary, image: String) -> void:
	var result := data.duplicate(true)
	result["image"] = image
	if not result.has("referenceHeight"):
		result["referenceHeight"] = float(result.get("sourceSize", {}).get("h", result.frame.h))
	# Expose all the browser's pin metadata, rather than only familiar fields.
	result["customData"] = {}
	for key in result:
		if key not in ["frame", "rotated", "trimmed", "spriteSourceSize", "sourceSize", "image", "customData", "filename"]:
			result.customData[key] = result[key]
	frames[name] = result

static func frame_data(atlas: String, name: String) -> Dictionary:
	_load_atlas(atlas)
	return _atlases.get(atlas, {}).get(name, {})

static func has_frame(atlas: String, name: String) -> bool:
	return not frame_data(atlas, name).is_empty()

static func frame(atlas: String, name: String) -> AtlasTexture:
	var key := atlas + "/" + name
	if _frames.has(key):
		return _frames[key] as AtlasTexture
	var data := frame_data(atlas, name)
	if data.is_empty():
		push_warning("Missing pond frame: " + key)
		return null
	var result := AtlasTexture.new()
	result.atlas = raw_texture(str(data.image))
	var region: Dictionary = data.frame
	result.region = Rect2(float(region.x), float(region.y), float(region.w), float(region.h))
	var source: Dictionary = data.get("sourceSize", {"w": region.w, "h": region.h})
	var trim: Dictionary = data.get("spriteSourceSize", {"x": 0, "y": 0})
	result.margin = Rect2(float(trim.x), float(trim.y), float(source.w) - float(region.w), float(source.h) - float(region.h))
	result.filter_clip = true
	_frames[key] = result
	return result

static func reference_height(atlas: String, name: String) -> float:
	return maxf(1.0, float(frame_data(atlas, name).get("referenceHeight", 1.0)))

static func hand_icon(index: int) -> AtlasTexture:
	var cell := clampi(index, 0, 15)
	var key := "hand-icon/%d" % cell
	if _frames.has(key):
		return _frames[key] as AtlasTexture
	var texture := raw_texture("hand-icons.png")
	if texture == null:
		return null
	var size := texture.get_size() / 4.0
	var result := AtlasTexture.new()
	result.atlas = texture
	result.region = Rect2(Vector2(cell % 4, cell / 4) * size, size)
	result.filter_clip = true
	_frames[key] = result
	return result
