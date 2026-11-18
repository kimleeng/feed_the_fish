shader_type canvas_item;
render_mode unshaded;

// Sample the painted reflection again above submerged sprites. Only horizontal
// whole-pixel offsets are allowed, so the bank and the fish keep their outlines.
uniform float water_time = 0.0;
void fragment() {
    vec2 pixel = floor(UV / TEXTURE_PIXEL_SIZE);
    vec2 shore = (pixel - vec2(240.0, 157.0)) / vec2(213.0, 94.0);
    if (dot(shore, shore) > 1.0) {
        discard;
    }
    float row = floor(pixel.y / 2.0);
    float wave = sin(row * 0.61 + water_time * 1.5) + sin(row * 0.27 - water_time * 0.84);
    float shift = sign(wave) * step(0.82, abs(wave));
    vec3 paint = texture(TEXTURE, UV + vec2(shift * TEXTURE_PIXEL_SIZE.x, 0.0)).rgb;
    float reflection = smoothstep(0.4, 0.87, dot(paint, vec3(0.30, 0.59, 0.11)));
    COLOR = vec4(paint, 0.18 + 0.33 * reflection);
}
