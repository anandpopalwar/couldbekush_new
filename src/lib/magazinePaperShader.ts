/**
 * A magazine cover as a sheet of coated paper — the deck's cards, drawn by
 * lib/magazinePaper.ts.
 *
 * Two spaces are in play:
 *  - card space, where the sheet is modelled and deformed: unscaled CSS px,
 *    y up, origin at the card's centre, z toward the viewer. The camera looks
 *    at it from where the page's eye really is, relative to this card.
 *  - frame space, where it is lit: the deck's CSS space (px, y down, origin at
 *    the centre of deck-frame), turned by the frame's cursor tilt. The eye sits
 *    at the frame's perspective distance and the studio (an HDRI) is fixed in
 *    the room, so the reflection moves only because the paper does — by the
 *    deck carrying it, the tilt turning it, or the sheet flexing.
 *
 * The sheet: while the deck moves, its trailing edge curls back away from the
 * viewer with the curl growing along it (the leading edge stays flat and runs
 * a little ahead), it bows slightly across its width, and a faint ripple runs
 * down the curl. All of it is scaled by `uBend`, the deck's own spring, so at
 * rest the geometry is exactly the flat card and the picture is exactly the
 * artwork. The curl is integrated along the sheet, so it keeps its length as
 * it bends instead of stretching.
 *
 * The surface, bottom up: printed ink (the artwork, with the deck's scrim),
 * the paper — lit by the room's diffuse light relative to how the flat card is
 * lit, so only a bend changes it — and a clear coat reflecting the studio at
 * two roughnesses, weighted by Fresnel. The paper under the coat is a height
 * field (fibre, tooth, orange peel) that tips the normal by a fraction of a
 * degree, so the reflections break up the way they do on coated stock.
 */

const deformChunk = /* glsl */ `
uniform vec2 uCardSize;
// Signed curl of the trailing edge, radians: positive while the cards travel
// down the screen (bottom edge leading).
uniform float uBend;
// px the leading edge runs ahead at this curl.
uniform float uLead;
uniform float uCrossBow;
uniform float uRipple;
uniform float uTime;

const int CURL_STEPS = 12;

vec3 deform(vec2 p) {
  float phi = abs(uBend);
  if (phi < 1e-5) return vec3(p, 0.0);
  float lead = uBend > 0.0 ? 1.0 : -1.0;
  float h = uCardSize.y;
  // Distance along the sheet from its leading edge, px. Not clamped to the
  // sheet: the mesh's antialiasing pad reaches a couple of px past both
  // edges and has to carry on along the curve. Clamped, the pad collapsed
  // onto the edge, its normal came out zero and normalised to NaN, and the
  // GPU dropped the edge rows of triangles — the sheet lost ~6px at each end
  // the moment it curled at all, and snapped back when it lay flat.
  float a = lead > 0.0 ? p.y + 0.5 * h : 0.5 * h - p.y;

  // theta(s) = phi * s^2: flat at the leading edge, curling toward the
  // trailing one. Walk the arc so the sheet keeps its length.
  float stepLen = a / float(CURL_STEPS);
  float along = 0.0;
  float depth = 0.0;
  for (int i = 0; i < CURL_STEPS; i++) {
    float s = (float(i) + 0.5) * stepLen / h;
    float theta = phi * s * s;
    along += stepLen * cos(theta);
    depth += stepLen * sin(theta);
  }
  float s = a / h;

  float y = lead > 0.0 ? -0.5 * h + along - uLead : 0.5 * h - along + uLead;
  float z = -depth;
  // Across the width, the middle of the sheet lags the edges a touch.
  float x = p.x / (0.5 * uCardSize.x);
  z -= uCrossBow * phi * (1.0 - x * x) * (0.4 + 0.6 * s);
  // And a ripple travels down the curl, only where it's curled.
  z += uRipple * phi * s * s * sin(s * 7.0 - uTime * 8.0 + x * 0.6);
  return vec3(p.x, y, z);
}
`;

export const paperVertexShader = /* glsl */ `
${deformChunk}
// Where the card is in the deck, for lighting in frame space.
uniform float uScale;
uniform float uOffsetY;
uniform mat3 uFrame;
uniform float uThickness;
uniform float uSheet; // 0 the printed face, 1 the sheet's underside

varying vec2 vUv;
varying vec2 vPx;
varying vec3 vFramePos;
varying vec3 vFrameNormal;
varying vec3 vFrameTangent;

vec3 toFrame(vec3 local) {
  // card space (y up) → frame space (y down), scaled as the deck scales it
  return uFrame * vec3(local.x * uScale, -local.y * uScale + uOffsetY, local.z * uScale);
}

void main() {
  vec2 p = position.xy;
  vec3 q = deform(p);
  vec3 dx = deform(p + vec2(1.0, 0.0)) - q;
  vec3 dy = deform(p + vec2(0.0, 1.0)) - q;
  vec3 n = normalize(cross(dx, dy) + vec3(0.0, 0.0, 1e-6));
  // The underside sits one paper thickness behind the face.
  q -= n * uThickness * uSheet;

  vUv = uv;
  vPx = vec2(p.x + 0.5 * uCardSize.x, 0.5 * uCardSize.y - p.y);
  vFramePos = toFrame(q);
  vFrameNormal = uFrame * vec3(n.x, -n.y, n.z);
  vFrameTangent = uFrame * normalize(vec3(dx.x, -dx.y, dx.z));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
}
`;

export const paperFragmentShader = /* glsl */ `
#define PAPER_PI 3.141592653589793
uniform vec2 uCardSize;
uniform float uRadius;
uniform mat3 uFrame;
uniform vec3 uEye;
uniform float uSheet;

// The artwork, and the part of it the card shows (object-cover, hover zoom).
uniform sampler2D uMap;
uniform vec4 uUvRect;
// The deck's scrim over the artwork: black at the foot, clear at the middle,
// a little at the head.
uniform vec2 uScrim;
uniform vec3 uStock;

// The studio, prefiltered at three roughnesses.
uniform sampler2D uEnvGloss;
uniform sampler2D uEnvHaze;
uniform sampler2D uEnvIrr;
uniform float uEnvYaw;
uniform float uEnvPitch;
uniform float uExposure;
uniform vec3 uCoat; // clear coat, sheen, grazing lift
uniform float uFresnelPower;

uniform float uMicroNormal;
uniform float uPeelNormal;
uniform float uDensity;
uniform float uSeed;

varying vec2 vUv;
varying vec2 vPx;
varying vec3 vFramePos;
varying vec3 vFrameNormal;
varying vec3 vFrameTangent;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Value noise with its analytic gradient: (value, d/dx, d/dy).
vec3 noised(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y,
              du * (vec2(b - a, c - a) + k * u.yx));
}

// One layer of the paper's height field, on a turned lattice so value
// noise's grid never lines up into a weave. Gradient in height per px.
vec3 layer(vec2 px, vec2 freq, vec2 shift, float turn) {
  mat2 r = mat2(cos(turn), sin(turn), -sin(turn), cos(turn));
  vec3 n = noised((r * px) * freq + shift);
  return vec3(n.x - 0.5, transpose(r) * (n.yz * freq));
}

// Frame-space direction (y down) → the baked equirect (u = 0.5 looks down
// -z, v = 0 straight up), with the room turned by uEnvYaw and tipped by
// uEnvPitch.
vec3 env(sampler2D map, vec3 dir) {
  vec3 d = normalize(vec3(dir.x, -dir.y, dir.z));
  float cp = cos(uEnvPitch);
  float sp = sin(uEnvPitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  vec2 uv = vec2(atan(d.x, -d.z) / (2.0 * PAPER_PI) + 0.5 + uEnvYaw,
                 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PAPER_PI);
  return texture2D(map, uv).rgb;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toGamma(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

void main() {
  // The sheet's outline: a rounded rect, antialiased over one screen px. The
  // mesh reaches a little past it, so the edge fades out inside geometry
  // rather than stopping on an aliased triangle edge.
  vec2 fromCentre = vPx - 0.5 * uCardSize;
  vec2 q = abs(fromCentre) - (0.5 * uCardSize - uRadius);
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float coverage = clamp(0.5 - dist / max(fwidth(dist), 1e-4), 0.0, 1.0);
  if (coverage <= 0.0) discard;

  // ── the paper under the coat ──
  vec2 seed = vec2(uSeed * 17.13, uSeed * 7.77);
  float nyquist = 0.3 * uDensity;
  vec3 fibre = layer(vPx, vec2(0.12, min(0.55, nyquist)), seed, 0.08);
  vec3 grain = layer(vPx, vec2(min(1.2, nyquist)), seed + 31.0, 0.61) +
               0.5 * layer(vPx, vec2(min(2.0, nyquist * 0.8)), seed + 57.0, 1.37);
  vec3 peel = layer(vPx, vec2(1.0 / 46.0), seed + 11.0, 0.33) +
              0.5 * layer(vPx, vec2(1.0 / 19.0), seed + 91.0, 2.1);
  // Height rising in +x tips the normal toward -x. Card px are y down, as
  // frame space is.
  vec2 tip = (0.55 * fibre.yz + grain.yz) * uMicroNormal + peel.yz * uPeelNormal;

  vec3 N0 = normalize(vFrameNormal);
  vec3 T = normalize(vFrameTangent - N0 * dot(vFrameTangent, N0));
  vec3 B = cross(N0, T);
  vec3 N = normalize(N0 - T * tip.x - B * tip.y);
  if (!gl_FrontFacing) N = -N;

  vec3 V = normalize(uEye - vFramePos);
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);

  // The room's diffuse light on this bit of paper, against what the flat,
  // untilted card receives — so a flat card is exactly its artwork, and only
  // a bend lightens or shades it.
  vec3 flatNormal = uFrame * vec3(0.0, 0.0, 1.0);
  float shade = luma(env(uEnvIrr, N)) / max(luma(env(uEnvIrr, flatNormal)), 1e-4);
  shade = clamp(mix(1.0, shade, 0.85), 0.5, 1.3);

  vec3 base;
  bool underside = uSheet > 0.5 || !gl_FrontFacing;
  if (underside) {
    // The stock: its underside, and its edge as the sheet curls.
    base = toLinear(uStock) * shade * 0.92;
  } else {
    vec2 uv = vUv * uUvRect.xy + uUvRect.zw;
    vec3 ink = texture2D(uMap, uv).rgb; // sRGB texture → linear
    // The scrim is a CSS gradient, so it's mixed in sRGB like one.
    float t = 1.0 - vUv.y; // 0 at the head
    float scrim = t > 0.5 ? uScrim.x * (t - 0.5) * 2.0 : uScrim.y * (0.5 - t) * 2.0;
    base = toLinear(toGamma(ink) * (1.0 - scrim)) * shade;
  }

  // ── the clear coat ──
  float F = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);
  float tooth = 1.0 + 0.05 * grain.x + 0.03 * fibre.x;
  vec3 coat = env(uEnvGloss, R) * uCoat.x + env(uEnvHaze, R) * uCoat.y * (1.0 + 0.12 * peel.x);
  vec3 lift = env(uEnvHaze, R) * uCoat.z * pow(1.0 - NdotV, uFresnelPower);
  vec3 spec = (coat * F * tooth + lift) * uExposure;
  if (underside) spec *= 0.35; // uncoated

  // Light off the coat adds to the print and saturates toward white.
  vec3 color = 1.0 - (1.0 - clamp(base, 0.0, 1.0)) * exp(-spec);

  gl_FragColor = vec4(color, coverage);
  #include <colorspace_fragment>
}
`;

/**
 * The shadow the sheet casts on the surface it lies just above. Two layers,
 * as a photographed magazine has: a small, darker contact shadow tucked
 * under the sheet, and a larger, lighter ambient shadow that fades out over
 * a long tail. Neither is a fixed rectangle — at each point it's cast from
 * how high that part of the sheet is:
 *  - the height is the sheet's resting lift, less the curl (a trailing edge
 *    curling back comes down toward the surface) and less the cursor tilt
 *    (the edge turned away from the viewer is the one nearer the surface);
 *  - lower means tighter, darker, and less offset; higher means softer,
 *    fainter, and pushed further along the light;
 *  - the offset follows the studio's key light — the same LED panel the coat
 *    reflects (uLightDir, frame space) — turned into the card's own frame, so
 *    light from the top left casts down and to the right, and the tilt moves
 *    it a hair;
 *  - while the deck moves it spreads a touch (uMotion, from the bend spring,
 *    so it settles back with the sheet rather than on its own).
 * Drawn before the sheet, in card space, on a quad covering the canvas.
 */
export const shadowVertexShader = /* glsl */ `
varying vec2 vPos;

void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const shadowFragmentShader = /* glsl */ `
uniform vec2 uCardSize;
uniform float uBend;
uniform float uCrossBow;
uniform float uScale;
uniform mat3 uFrame;
// The sheet's footprint in card space (y up): x0, y0, x1, y1.
uniform vec4 uFootprint;
uniform vec3 uLightDir;
uniform vec3 uShadowColor;
uniform float uShadowStrength;
uniform float uMotion;
// The sheet's resting height above the surface, px.
uniform float uLift;
uniform float uTiltLift;
uniform vec2 uContact;  // alpha, blur per px of height
uniform vec3 uAmbient;  // alpha, blur per px of height, tail share
// The quad's own extent (the canvas), card space. The shadow is faded to
// nothing before it, so the canvas's edge can never show as a line.
uniform vec4 uBounds;

varying vec2 vPos;

float erfApprox(float x) {
  float s = sign(x);
  float a = abs(x);
  float t = 1.0 + (0.278393 + (0.230389 + 0.078108 * a * a) * a) * a;
  t *= t;
  return s - s / (t * t);
}

// A rect's shadow: the rect convolved with a Gaussian, exactly, per axis.
float boxShadow(vec2 p, vec4 rect, float sigma) {
  vec4 d = vec4(p - rect.xy, rect.zw - p) / (sigma * 1.41421356);
  return (0.5 + 0.5 * erfApprox(d.x)) * (0.5 + 0.5 * erfApprox(d.y)) *
         (0.5 + 0.5 * erfApprox(d.z)) * (0.5 + 0.5 * erfApprox(d.w));
}

// How far the curl has brought this part of the sheet back toward the
// surface, px: the vertex shader's curl, integrated in closed form (two terms
// of sin's series are within a few % at the deck's largest curl), plus the
// bow across the width. No loop — this runs for every pixel of the canvas.
float curlDepth(vec2 p) {
  float phi = abs(uBend);
  if (phi < 1e-5) return 0.0;
  float h = uCardSize.y;
  float a = clamp(uBend > 0.0 ? p.y + 0.5 * h : 0.5 * h - p.y, 0.0, h);
  float r = a / h;
  float depth = h * (phi * r * r * r / 3.0 - phi * phi * phi * pow(r, 7.0) / 42.0);
  float x = clamp(p.x / (0.5 * uCardSize.x), -1.0, 1.0);
  return depth + uCrossBow * phi * (1.0 - x * x) * (0.4 + 0.6 * r);
}

void main() {
  // Height above the surface here, in frame px. The frame's third row turns a
  // point on the card into its depth: tilted away from the eye is nearer the
  // surface behind.
  vec3 row = vec3(uFrame[0][2], uFrame[1][2], uFrame[2][2]);
  float tilt = dot(row, vec3(vPos.x * uScale, -vPos.y * uScale, 0.0));
  float height = max(uLift - curlDepth(vPos) * uScale + tilt * uTiltLift, 0.5);

  // The key light, in the card's own frame; each px of height pushes the
  // shadow this far along the surface (frame px, y down) — away from the light.
  vec3 light = transpose(uFrame) * normalize(uLightDir);
  vec2 along = -light.xy / max(light.z, 0.2);
  vec2 shift = vec2(along.x, -along.y) * height / uScale; // card space, y up

  float spread = 1.0 + 0.3 * uMotion;
  float nearness = clamp(uLift / height, 0.5, 1.6);

  // Contact: under the sheet, inset a touch, barely offset.
  vec4 contactRect = uFootprint + vec4(2.0, 2.0, -2.0, -2.0) + vec4(shift, shift) * 0.35;
  float contactBlur = (1.0 + uContact.y * height) * spread / uScale;
  float contact = uContact.x * nearness * boxShadow(vPos, contactRect, contactBlur);

  // Ambient: wider and softer, along the light, with a long faint tail.
  vec4 ambientRect = uFootprint + vec4(4.0, 4.0, -4.0, -4.0) + vec4(shift, shift);
  float ambientBlur = (5.0 + uAmbient.y * height) * spread / uScale;
  float ambient = uAmbient.x *
    ((1.0 - uAmbient.z) * boxShadow(vPos, ambientRect, ambientBlur) +
     uAmbient.z * boxShadow(vPos, ambientRect + vec4(-3.0, -6.0, 3.0, 0.0), ambientBlur * 1.9));

  vec4 edge = vec4(vPos - uBounds.xy, uBounds.zw - vPos);
  float window = smoothstep(0.0, 16.0, min(min(edge.x, edge.y), min(edge.z, edge.w)));
  float alpha = (1.0 - (1.0 - contact) * (1.0 - ambient)) * uShadowStrength * window;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uShadowColor, alpha);
  #include <colorspace_fragment>
}
`;
