shader_type canvas_item;
render_mode unshaded;

// Preserve the original head and torso while feathers pass behind them.
uniform vec2 frame_origin = vec2(0.0);
uniform vec2 torso_center = vec2(160.0, 169.0);
uniform vec2 torso_radius = vec2(58.0, 29.0);
uniform vec2 head_center = vec2(219.0, 138.0);
uniform vec2 head_radius = vec2(39.0, 30.0);
uniform vec2 tail_center = vec2(96.0, 173.0);
uniform vec2 tail_radius = vec2(30.0, 17.0);
uniform bool body_only = false;

float ellipse_mask(vec2 point, vec2 center, vec2 radius) {
	float distance_from_center = length((point - center) / radius);
	return 1.0 - smoothstep(0.91, 1.04, distance_from_center);
}

void fragment() {
	vec2 source = UV * vec2(textureSize(TEXTURE, 0)) - frame_origin;
	float body = max(ellipse_mask(source, torso_center, torso_radius),
		max(ellipse_mask(source, head_center, head_radius),
		ellipse_mask(source, tail_center, tail_radius)));
	COLOR.a *= body_only ? body : 1.0 - body;
}
